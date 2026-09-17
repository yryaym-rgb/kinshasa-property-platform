/**
 * payment-initiate — creates a payment and hands it to the provider.
 *
 *  1. CORS + method check
 *  2. Authenticate (JWT)
 *  3. Parse body (zod)
 *  4. Idempotency: same key within 5 min → return existing payment
 *  5. Load contract, verify tenant / bailleur / amount
 *  6. Create payment (state = validating) + history
 *  7. Validate business rules → INITIATE (validating → pending)
 *  8. Provider adapter → initiate()
 *  9. Persist providerTransactionId, move to pending/processing/requires_action
 * 10. Return { paymentId, state, providerTransactionId, redirectUrl }
 *
 * Any error after the row exists → state = failed with a reason. Always an
 * audit_logs entry. The frontend never writes to `paiements` directly.
 */

import { z } from 'zod';
import {
  authenticate,
  badRequest,
  clientIp,
  conflict,
  errorResponse,
  forbidden,
  handlePreflight,
  json,
  notFound,
  readJson,
  requireMethod,
  unprocessable,
  userAgent,
} from '../_shared/auth.ts';
import { DbError, getContract, getProviderRow, type PaymentRow, serviceClient, transitionPayment, writeAuditLog } from '../_shared/db.ts';
import { APP_URL, PAYMENT_EXPIRY_MINUTES, PLATFORM_FEE_RATE, SUPABASE_URL } from '../_shared/env.ts';
import { isUniqueViolation, isValidIdempotencyKey, lookupIdempotencyKey } from '../_shared/idempotency.ts';
import { createLogger } from '../_shared/logger.ts';
import { getProviderAdapter, getProviderConfig, isProviderKey, ProviderError, providerKeyToDbMethod } from '../_shared/providers/index.ts';
import { providerStatusToEvent, transition } from '../_shared/stateMachine.ts';
import { runPostSuccessPipeline } from '../_shared/pipeline.ts';

const PHONE_RE = /^\+243[0-9]{9}$/;

const BodySchema = z.object({
  contractId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000_000),
  rentAmount: z.number().positive().max(1_000_000_000),
  currency: z.enum(['CDF', 'USD']).default('CDF'),
  method: z.string().min(2).max(30),
  phone: z.string().regex(PHONE_RE, 'Format attendu +243XXXXXXXXX').optional(),
  periode: z.string().regex(/^\d{4}-\d{2}$/),
  idempotencyKey: z.string().min(8).max(100),
  description: z.string().max(200).optional(),
  returnUrl: z.string().url().max(500).optional(),
});

function toResponse(p: PaymentRow, extra: { redirectUrl?: string; message?: string; idempotentReplay: boolean }) {
  return {
    paymentId: p.id,
    reference: p.reference,
    state: p.state,
    providerTransactionId: p.provider_transaction_id,
    redirectUrl: extra.redirectUrl ?? (p.provider_metadata?.redirectUrl as string | undefined),
    message: extra.message,
    expiresAt: p.expires_at,
    idempotentReplay: extra.idempotentReplay,
  };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const log = createLogger('payment-initiate', req);
  const db = serviceClient();
  let paymentId: string | null = null;
  let userId: string | null = null;

  try {
    requireMethod(req, 'POST');
    const user = await authenticate(req);
    userId = user.id;
    const body = BodySchema.parse(await readJson(req));
    const ip = clientIp(req);
    const ua = userAgent(req);

    if (!isValidIdempotencyKey(body.idempotencyKey)) throw badRequest('validation_failed', 'Clé d’idempotence invalide');
    if (!isProviderKey(body.method)) throw unprocessable('method_unavailable', `Mode de paiement inconnu : ${body.method}`);

    // 4. Idempotency
    const idem = await lookupIdempotencyKey(db, body.idempotencyKey, user.id);
    if (idem.kind === 'replay') {
      log.info('idempotent replay', { paymentId: idem.payment.id, state: idem.payment.state });
      return json(req, toResponse(idem.payment, { idempotentReplay: true }), 200, { 'Idempotent-Replayed': 'true' });
    }
    if (idem.kind === 'stale') throw conflict('duplicate_payment', 'Clé d’idempotence expirée — relancez le paiement');

    // 5. Contract + authorisation
    const contract = await getContract(db, body.contractId);
    if (!contract) throw notFound('contract_not_found', 'Contrat introuvable');
    const isTenant = contract.locataire_id === user.id;
    const isLandlord = user.bailleurId !== null && contract.bailleur_id === user.bailleurId;
    const staff = ['admin', 'gestionnaire', 'agence'].includes(user.role);
    if (!isTenant && !isLandlord && !staff) throw forbidden('Vous n’êtes pas partie à ce contrat');
    if (contract.status !== 'actif') throw unprocessable('contract_inactive', 'Le contrat n’est pas actif');
    if (body.currency !== contract.currency) throw unprocessable('invalid_amount', `Devise attendue : ${contract.currency}`);

    // Amount sanity: rent must match the contract (partial payments are a
    // provider capability we do not enable yet); total must cover the rent.
    const rent = Number(contract.loyer_mensuel);
    if (Math.abs(body.rentAmount - rent) > 0.5) {
      throw unprocessable('invalid_amount', `Le loyer attendu est de ${rent} ${contract.currency}`);
    }
    if (body.amount < body.rentAmount) throw unprocessable('invalid_amount', 'Le montant total doit couvrir le loyer');

    // Provider catalogue limits
    const providerRow = await getProviderRow(db, body.method);
    if (!providerRow || !providerRow.is_active) throw unprocessable('method_unavailable', 'Mode de paiement indisponible');
    if (providerRow.requires_phone && !body.phone) throw unprocessable('invalid_phone', 'Numéro Mobile Money requis');
    if (body.amount < Number(providerRow.min_amount)) throw unprocessable('amount_below_minimum', `Minimum ${providerRow.min_amount}`);
    if (body.amount > Number(providerRow.max_amount)) throw unprocessable('amount_above_maximum', `Maximum ${providerRow.max_amount}`);

    // Period already paid?
    const { data: paid } = await db
      .from('paiements')
      .select('id')
      .eq('contrat_id', contract.id)
      .eq('periode', body.periode)
      .in('state', ['succeeded', 'disputed'])
      .limit(1);
    if (paid && paid.length > 0) throw conflict('period_already_paid', 'Le loyer de cette période a déjà été réglé');

    // 6. Create the row in `validating`
    const expiresAt = new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60_000).toISOString();
    const feeRate = Number(providerRow.fee_percentage) / 100;
    const breakdown = {
      rentAmount: body.rentAmount,
      taxRate: null, // authoritative value set by the tax engine on success
      taxAmount: Math.max(0, Math.round(body.amount - body.rentAmount - Math.round(body.rentAmount * PLATFORM_FEE_RATE) - Math.round(body.rentAmount * feeRate))),
      platformFeeRate: PLATFORM_FEE_RATE,
      platformFee: Math.round(body.rentAmount * PLATFORM_FEE_RATE),
      mobileMoneyFeeRate: feeRate,
      mobileMoneyFee: Math.round(body.rentAmount * feeRate) + Number(providerRow.fee_fixed),
      total: body.amount,
      estimated: true,
    };

    const insert = {
      contrat_id: contract.id,
      montant: body.amount,
      currency: body.currency,
      method: providerKeyToDbMethod(body.method),
      provider: body.method,
      periode: body.periode,
      state: 'validating',
      status: 'en_attente',
      metadata: { phone: body.phone ?? null, provider_key: body.method, rent_amount: body.rentAmount, description: body.description ?? null },
      idempotency_key: body.idempotencyKey,
      tax_calculation: breakdown,
      expires_at: expiresAt,
      client_ip: ip,
      user_agent: ua,
      initiated_by: user.id,
      attempt_count: 0,
    };

    let payment: PaymentRow;
    {
      const { data, error } = await db.from('paiements').insert(insert).select('*').single();
      if (error) {
        if (isUniqueViolation(error)) {
          // Lost the race against a concurrent request with the same key.
          const again = await lookupIdempotencyKey(db, body.idempotencyKey, user.id);
          if (again.kind === 'replay') return json(req, toResponse(again.payment, { idempotentReplay: true }), 200, { 'Idempotent-Replayed': 'true' });
        }
        throw new DbError('paiements.insert', error.message);
      }
      payment = data as PaymentRow;
    }
    paymentId = payment.id;
    const plog = log.child({ paymentId, provider: body.method, userId: user.id });

    await db.from('payment_state_history').insert({
      paiement_id: payment.id,
      from_state: 'draft',
      to_state: 'validating',
      event: 'VALIDATE',
      reason: 'Paiement créé, validation du contrat et du montant',
      actor: `user:${user.id}`,
      metadata: { ip, method: body.method },
    });

    // 7. validating → pending (INITIATE)
    payment = await transitionPayment(db, {
      paymentId: payment.id,
      from: 'validating',
      to: transition('validating', 'INITIATE'),
      event: 'INITIATE',
      reason: `Envoi à ${providerRow.display_name}`,
      actor: `user:${user.id}`,
    });

    // 8. Provider
    const adapter = getProviderAdapter(body.method);
    const config = getProviderConfig(body.method);
    const notifyUrl = `${SUPABASE_URL}/functions/v1/payment-webhook?provider=${body.method}`;
    const returnUrl = body.returnUrl ?? `${APP_URL}/locataire/paiements/succes?id=${payment.id}`;

    let init;
    try {
      init = await adapter.initiate(config, {
        amount: body.amount,
        currency: body.currency,
        phone: body.phone,
        reference: payment.reference,
        description: body.description ?? `Loyer ${body.periode} — ${contract.logement?.code ?? contract.code}`,
        returnUrl,
        notifyUrl,
        metadata: { paymentId: payment.id, contractId: contract.id },
      });
    } catch (error) {
      const code = error instanceof ProviderError ? error.code : 'provider_error';
      payment = await transitionPayment(db, {
        paymentId: payment.id,
        from: null,
        to: 'failed',
        event: 'PROVIDER_FAILED',
        reason: error instanceof Error ? error.message : String(error),
        actor: `provider:${body.method}`,
        metadata: { code },
        patch: { failure_reason: code },
      });
      await writeAuditLog(db, { userId: user.id, action: 'payment.initiate_failed', entityType: 'paiements', entityId: payment.id, newData: { code, provider: body.method }, ip, userAgent: ua });
      plog.warn('provider initiate failed', { code });
      return json(req, toResponse(payment, { idempotentReplay: false, message: undefined }), 200);
    }

    // 9. Persist provider result
    const event = providerStatusToEvent(init.status);
    const patch = {
      provider_transaction_id: init.providerTransactionId,
      provider_metadata: { redirectUrl: init.redirectUrl ?? null, message: init.message ?? null, sandbox: config.sandbox, raw: init.raw },
      failure_reason: init.status === 'failed' ? (init.failureCode ?? 'provider_rejected') : null,
    };

    if (event) {
      payment = await transitionPayment(db, {
        paymentId: payment.id,
        from: 'pending',
        to: transition('pending', event),
        event,
        reason: init.message ?? `Réponse ${providerRow.display_name} : ${init.status}`,
        actor: `provider:${body.method}`,
        patch,
      });
    } else {
      const { data, error } = await db.from('paiements').update(patch).eq('id', payment.id).select('*').single();
      if (error) throw new DbError('paiements.update', error.message);
      payment = data as PaymentRow;
    }

    await writeAuditLog(db, {
      userId: user.id,
      action: 'payment.initiated',
      entityType: 'paiements',
      entityId: payment.id,
      newData: { state: payment.state, provider: body.method, amount: body.amount, rentAmount: body.rentAmount, periode: body.periode, providerTransactionId: init.providerTransactionId },
      ip,
      userAgent: ua,
    });

    // Instant success (sandbox force-success, synchronous providers): run the pipeline now.
    if (payment.state === 'succeeded') {
      await runPostSuccessPipeline(db, payment.id, plog, { actor: `provider:${body.method}` });
    }

    plog.info('payment initiated', { state: payment.state, providerTransactionId: init.providerTransactionId });
    return json(req, toResponse(payment, { redirectUrl: init.redirectUrl, message: init.message, idempotentReplay: false }), 201);
  } catch (error) {
    log.error('payment-initiate failed', error, { paymentId });
    if (paymentId) {
      try {
        await transitionPayment(db, {
          paymentId,
          from: null,
          to: 'failed',
          event: 'VALIDATION_FAILED',
          reason: error instanceof Error ? error.message : String(error),
          actor: 'system',
          patch: { failure_reason: (error as { code?: string }).code ?? 'unknown' },
        });
      } catch {
        // Already terminal — nothing to do.
      }
    }
    await writeAuditLog(db, {
      userId,
      action: 'payment.initiate_error',
      entityType: 'paiements',
      entityId: paymentId,
      newData: { error: error instanceof Error ? error.message : String(error), code: (error as { code?: string }).code ?? null },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return errorResponse(req, error, log.requestId);
  }
});
