/**
 * payment-verify — smart status endpoint (the polling half of the hybrid hook).
 *
 *  - Terminal state          → answer from the DB, never call the provider.
 *  - Checked < 5 s ago       → rate-limited: answer from the DB.
 *  - Checked < 10 s ago      → still fresh: answer from the DB.
 *  - Otherwise               → provider.verify(); the verdict goes through the
 *                              SAME settlement path as the webhook, so a
 *                              success discovered by polling runs the full
 *                              downstream pipeline exactly once.
 *  - Past expires_at and the provider still says pending → TIMEOUT.
 *  - Succeeded payments with queued pipeline jobs → jobs retried opportunistically.
 *
 * Body: { paymentId, force? }   (force skips the rate limit — staff only)
 */

import { z } from 'zod';
import {
  authenticate,
  clientIp,
  errorResponse,
  forbidden,
  handlePreflight,
  isStaff,
  json,
  notFound,
  readJson,
  requireMethod,
  userAgent,
} from '../_shared/auth.ts';
import { getContract, getPayment, type PaymentRow, serviceClient, writeAuditLog } from '../_shared/db.ts';
import { VERIFY_MIN_INTERVAL_SECONDS, VERIFY_PROVIDER_STALENESS_SECONDS } from '../_shared/env.ts';
import { createLogger } from '../_shared/logger.ts';
import { retryQueuedJobs } from '../_shared/pipeline.ts';
import { getProviderAdapter, getProviderConfig, isProviderKey, ProviderError } from '../_shared/providers/index.ts';
import { applyProviderVerdict, isSettled } from '../_shared/settlement.ts';
import { isInFlight, isPaymentState } from '../_shared/stateMachine.ts';

const BodySchema = z.object({
  paymentId: z.string().uuid(),
  force: z.boolean().optional(),
});

interface VerifyResponse {
  paymentId: string;
  state: string;
  status: string;
  failureReason: string | null;
  providerTransactionId: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  providerChecked: boolean;
  receiptId: string | null;
  receiptCode: string | null;
  impotId: string | null;
  pipeline: Record<string, unknown>;
  /** Hint for the client: how long to wait before polling again. */
  nextPollMs: number;
  rateLimited?: boolean;
}

async function buildResponse(db: ReturnType<typeof serviceClient>, p: PaymentRow, providerChecked: boolean, rateLimited = false): Promise<VerifyResponse> {
  const pipeline = (p.pipeline ?? {}) as Record<string, { result?: Record<string, unknown> }>;
  let receiptId = (pipeline.receipt?.result?.receiptId as string | undefined) ?? null;
  let receiptCode = (pipeline.receipt?.result?.receiptCode as string | undefined) ?? null;
  const impotId = (pipeline.tax?.result?.impotId as string | undefined) ?? null;

  // Fallback for payments settled before the pipeline checkpoint existed.
  if (p.state === 'succeeded' && !receiptId) {
    const { data } = await db.from('recus').select('id, code').eq('paiement_id', p.id).maybeSingle();
    if (data) {
      receiptId = data.id as string;
      receiptCode = data.code as string;
    }
  }

  const inFlight = isPaymentState(p.state) && isInFlight(p.state);
  return {
    paymentId: p.id,
    state: p.state,
    status: p.status,
    failureReason: p.failure_reason,
    providerTransactionId: p.provider_transaction_id,
    paidAt: p.paid_at,
    expiresAt: p.expires_at,
    providerChecked,
    receiptId,
    receiptCode,
    impotId,
    pipeline: p.pipeline ?? {},
    nextPollMs: inFlight ? VERIFY_MIN_INTERVAL_SECONDS * 1000 : 0,
    rateLimited: rateLimited || undefined,
  };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const log = createLogger('payment-verify', req);
  const db = serviceClient();

  try {
    requireMethod(req, 'POST');
    const user = await authenticate(req);
    const body = BodySchema.parse(await readJson(req));
    const plog = log.child({ paymentId: body.paymentId, userId: user.id });

    let payment = await getPayment(db, body.paymentId);
    if (!payment) throw notFound('payment_not_found', 'Paiement introuvable');

    // Authorisation: payer, landlord of the contract, or staff.
    const contract = await getContract(db, payment.contrat_id);
    const isTenant = contract?.locataire_id === user.id;
    const isLandlord = user.bailleurId !== null && contract?.bailleur_id === user.bailleurId;
    if (!isTenant && !isLandlord && !isStaff(user) && payment.initiated_by !== user.id) {
      throw forbidden('Vous n’avez pas accès à ce paiement');
    }

    // 1. Terminal → straight from the DB.
    if (isSettled(payment.state) || payment.state === 'expired') {
      if (payment.state === 'succeeded') {
        const retried = await retryQueuedJobs(db, payment.id, plog).catch((e) => {
          plog.warn('opportunistic pipeline retry failed', { error: String(e) });
          return [];
        });
        if (retried.length > 0) payment = (await getPayment(db, payment.id)) ?? payment;
      }
      return json(req, await buildResponse(db, payment, false));
    }

    // Draft/validating never reached the provider — nothing to verify yet.
    if (!payment.provider_transaction_id || !payment.provider || !isPaymentState(payment.state) || !isInFlight(payment.state)) {
      return json(req, await buildResponse(db, payment, false));
    }

    // 2. Rate limit + staleness.
    const lastCheck = payment.last_verified_at ? new Date(payment.last_verified_at).getTime() : 0;
    const ageSec = (Date.now() - lastCheck) / 1000;
    const force = body.force === true && isStaff(user);
    if (!force && ageSec < VERIFY_MIN_INTERVAL_SECONDS) {
      return json(req, await buildResponse(db, payment, false, true), 200, { 'Retry-After': String(VERIFY_MIN_INTERVAL_SECONDS) });
    }
    if (!force && ageSec < VERIFY_PROVIDER_STALENESS_SECONDS) {
      return json(req, await buildResponse(db, payment, false));
    }

    // Claim the check slot first so concurrent pollers do not all hit the provider.
    const nowIso = new Date().toISOString();
    const { data: claimed } = await db
      .from('paiements')
      .update({ last_verified_at: nowIso })
      .eq('id', payment.id)
      .or(`last_verified_at.is.null,last_verified_at.lt.${new Date(Date.now() - VERIFY_MIN_INTERVAL_SECONDS * 1000).toISOString()}`)
      .select('id');
    if (!force && (!claimed || claimed.length === 0)) {
      return json(req, await buildResponse(db, payment, false, true));
    }

    // 3. Ask the provider.
    if (!isProviderKey(payment.provider)) {
      return json(req, await buildResponse(db, payment, false));
    }
    const adapter = getProviderAdapter(payment.provider);
    const config = getProviderConfig(payment.provider);

    let verdict;
    try {
      verdict = await adapter.verify(config, payment.provider_transaction_id);
    } catch (error) {
      // Provider unreachable: not a payment failure. Report current state and let the client retry.
      const code = error instanceof ProviderError ? error.code : 'provider_error';
      plog.warn('provider verify failed', { code, error: error instanceof Error ? error.message : String(error) });
      await writeAuditLog(db, { userId: user.id, action: 'payment.verify_provider_error', entityType: 'paiements', entityId: payment.id, newData: { code }, ip: clientIp(req), userAgent: userAgent(req) });
      return json(req, await buildResponse(db, payment, true));
    }

    const expired = payment.expires_at !== null && new Date(payment.expires_at).getTime() < Date.now();
    const effectiveStatus = verdict.status === 'pending' && expired ? 'expired' : verdict.status;

    const result = await applyProviderVerdict(
      db,
      payment,
      { status: effectiveStatus, failureReason: verdict.failureReason, providerReference: verdict.providerReference, paidAt: verdict.paidAt, amount: verdict.amount, currency: verdict.currency, raw: verdict.raw },
      plog,
      { actor: `provider:${payment.provider}`, reason: effectiveStatus === 'expired' ? 'Délai dépassé sans confirmation de l’opérateur' : `Vérification : ${verdict.status}`, metadata: { via: 'payment-verify', requestedBy: user.id } },
    );
    payment = result.payment;

    if (!result.changed && verdict.status === 'pending') {
      // Nothing new — but a pending provider status still counts as a check.
      payment = (await getPayment(db, payment.id)) ?? payment;
    }

    await writeAuditLog(db, {
      userId: user.id,
      action: result.changed ? 'payment.verified_transition' : 'payment.verified',
      entityType: 'paiements',
      entityId: payment.id,
      newData: { providerStatus: verdict.status, state: payment.state, changed: result.changed, pipelineOk: result.pipeline?.ok ?? null },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    plog.info('verify done', { state: payment.state, providerStatus: verdict.status, changed: result.changed });
    return json(req, await buildResponse(db, payment, true));
  } catch (error) {
    log.error('payment-verify failed', error);
    return errorResponse(req, error, log.requestId);
  }
});
