/**
 * payment-refund — admin / landlord-only reversal of a succeeded payment.
 *
 *  1. Authenticate; allow admin, gestionnaire, or the landlord of the contract.
 *  2. Payment must be `succeeded` (or `disputed`), provider must support
 *     refunds, and `paid_at` must be within the provider's refund window.
 *  3. provider.refund() — sandbox simulator or real API (TODO in production).
 *  4. State → `refunded` (REFUND) with the provider refund id.
 *  5. Reverse the fiscal side: impôt → `annule`, ledger reversal rows,
 *     landlord balance recomputed, calculs_fiscaux annotated.
 *  6. Notify tenant + landlord, audit everything.
 *
 * Partial refunds: the amount is recorded, the ledger reversal is
 * proportional, but the payment state is still `refunded` (the state machine
 * has no partial state; the amount lives in provider_metadata.refund).
 */

import { z } from 'zod';
import {
  authenticate,
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
import { DbError, getContract, getPayment, getProviderRow, serviceClient, transitionPayment, writeAuditLog } from '../_shared/db.ts';
import { DEFAULT_REFUND_WINDOW_DAYS } from '../_shared/env.ts';
import { createLogger } from '../_shared/logger.ts';
import { getProviderAdapter, getProviderConfig, isProviderKey, ProviderError } from '../_shared/providers/index.ts';
import { transition } from '../_shared/stateMachine.ts';

const BodySchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.number().positive().optional(),
  reason: z.string().min(3).max(500),
});

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const log = createLogger('payment-refund', req);
  const db = serviceClient();

  try {
    requireMethod(req, 'POST');
    const user = await authenticate(req);
    const body = BodySchema.parse(await readJson(req));
    const ip = clientIp(req);
    const ua = userAgent(req);
    const plog = log.child({ paymentId: body.paymentId, userId: user.id });

    const payment = await getPayment(db, body.paymentId);
    if (!payment) throw notFound('payment_not_found', 'Paiement introuvable');
    const contract = await getContract(db, payment.contrat_id);
    if (!contract) throw notFound('contract_not_found', 'Contrat introuvable');

    // 1. Permission
    const isLandlord = user.bailleurId !== null && contract.bailleur_id === user.bailleurId;
    const isAdmin = user.role === 'admin' || user.role === 'gestionnaire';
    if (!isLandlord && !isAdmin) throw forbidden('Seul le bailleur ou un administrateur peut rembourser');

    // 2. Eligibility
    if (payment.state !== 'succeeded' && payment.state !== 'disputed') {
      throw conflict('refund_not_allowed', `Un paiement « ${payment.state} » ne peut pas être remboursé`);
    }
    if (!payment.provider || !isProviderKey(payment.provider)) throw unprocessable('method_unavailable', 'Fournisseur inconnu');
    const providerRow = await getProviderRow(db, payment.provider);
    if (!providerRow?.supports_refund) throw unprocessable('refund_not_allowed', 'Ce mode de paiement ne permet pas le remboursement');

    const windowDays = Number(providerRow.refund_window_days ?? DEFAULT_REFUND_WINDOW_DAYS);
    const paidAt = payment.paid_at ? new Date(payment.paid_at).getTime() : new Date(payment.created_at).getTime();
    if (Date.now() - paidAt > windowDays * 86_400_000) {
      throw conflict('refund_window_expired', `Le délai de remboursement (${windowDays} jours) est dépassé`);
    }

    const total = Number(payment.montant);
    const amount = body.amount ?? total;
    if (amount > total + 0.5) throw unprocessable('invalid_amount', 'Le montant dépasse le paiement initial');
    const ratio = Math.min(1, amount / total);

    const adapter = getProviderAdapter(payment.provider);
    if (!adapter.refund) throw unprocessable('refund_not_allowed', 'Remboursement non supporté par cet opérateur');
    const config = getProviderConfig(payment.provider);

    // 3. Provider
    let refund;
    try {
      refund = await adapter.refund(config, payment.provider_transaction_id ?? payment.reference, amount, body.reason);
    } catch (error) {
      const code = error instanceof ProviderError ? error.code : 'provider_error';
      plog.warn('provider refund failed', { code });
      await writeAuditLog(db, { userId: user.id, action: 'payment.refund_failed', entityType: 'paiements', entityId: payment.id, newData: { code, amount, reason: body.reason }, ip, userAgent: ua });
      throw unprocessable(code, error instanceof Error ? error.message : 'Échec du remboursement chez l’opérateur');
    }
    if (refund.status === 'failed') {
      await writeAuditLog(db, { userId: user.id, action: 'payment.refund_rejected', entityType: 'paiements', entityId: payment.id, newData: { refund, amount }, ip, userAgent: ua });
      throw unprocessable('provider_rejected', refund.message ?? 'Remboursement refusé par l’opérateur');
    }

    // 4. State → refunded
    const updated = await transitionPayment(db, {
      paymentId: payment.id,
      from: payment.state,
      to: transition(payment.state, 'REFUND'),
      event: 'REFUND',
      reason: body.reason,
      actor: `user:${user.id}`,
      metadata: { amount, providerRefundId: refund.providerRefundId, providerStatus: refund.status },
      patch: {
        provider_metadata: {
          ...(payment.provider_metadata ?? {}),
          refund: { amount, ratio, providerRefundId: refund.providerRefundId, status: refund.status, reason: body.reason, by: user.id, at: new Date().toISOString(), raw: refund.raw },
        },
      },
    });

    // 5. Fiscal reversal — never delete: mark and append reversal rows.
    let taxReversed = false;
    {
      const { data: impot } = await db.from('impots').select('id, montant, status').eq('paiement_id', payment.id).maybeSingle();
      if (impot && impot.status !== 'paye') {
        const { error } = await db
          .from('impots')
          .update({ status: 'annule', montant_precedent: impot.montant, recalcule_at: new Date().toISOString(), detail_calcul: { refund: { amount, ratio, reason: body.reason, at: new Date().toISOString() } } })
          .eq('id', impot.id);
        if (error) throw new DbError('impots.cancel', error.message);
        taxReversed = true;
      } else if (impot?.status === 'paye') {
        // Already remitted to the DGI: the obligation stays; flag for manual regularisation.
        plog.warn('impôt already paid to DGI — manual regularisation required', { impotId: impot.id });
        await db.from('anomalies_fiscales').upsert(
          {
            type: 'refund_after_tax_paid',
            severite: 'high',
            bailleur_id: contract.bailleur_id,
            contrat_id: contract.id,
            paiement_id: payment.id,
            titre: 'Remboursement après reversement de l’impôt',
            description: `Le paiement ${payment.reference} a été remboursé (${amount} ${payment.currency}) alors que l’impôt ${impot.id} est déjà réglé.`,
            signaux: { impotId: impot.id, montantImpot: impot.montant, refundAmount: amount },
            action_suggeree: 'Régulariser le trop-perçu avec la DGI',
            empreinte: `refund_after_tax_paid:${payment.id}`,
          },
          { onConflict: 'empreinte', ignoreDuplicates: true },
        );
      }

      const { data: entries } = await db.from('ledger_entries').select('*').eq('paiement_id', payment.id).is('reversal_of', null);
      if (entries && entries.length > 0) {
        const { data: alreadyReversed } = await db.from('ledger_entries').select('reversal_of').eq('paiement_id', payment.id).not('reversal_of', 'is', null);
        const reversedIds = new Set((alreadyReversed ?? []).map((r: { reversal_of: string }) => r.reversal_of));
        const reversals = entries
          .filter((e: { id: string }) => !reversedIds.has(e.id))
          .map((e: { id: string; account_type: string; account_id: string | null; direction: string; amount: number; currency: string }) => ({
            paiement_id: payment.id,
            account_type: e.account_type,
            account_id: e.account_id,
            direction: e.direction === 'credit' ? 'debit' : 'credit',
            amount: Math.round(Number(e.amount) * ratio * 100) / 100,
            currency: e.currency,
            description: `Remboursement ${payment.reference} — ${body.reason}`,
            reversal_of: e.id,
            metadata: { refund: true, ratio, providerRefundId: refund.providerRefundId },
          }));
        if (reversals.length > 0) {
          const { error } = await db.from('ledger_entries').insert(reversals);
          if (error) throw new DbError('ledger_entries.reverse', error.message);
        }
      }

      // Recompute landlord balances from the journal.
      const { data: sums } = await db.from('ledger_entries').select('direction, amount').eq('account_type', 'bailleur').eq('account_id', contract.bailleur_id);
      const solde = (sums ?? []).reduce((acc: number, e: { direction: string; amount: number }) => acc + (e.direction === 'credit' ? Number(e.amount) : -Number(e.amount)), 0);
      const { data: dus } = await db.from('impots').select('montant').eq('bailleur_id', contract.bailleur_id).in('status', ['calcule', 'declare', 'en_retard']);
      const impotsDus = (dus ?? []).reduce((acc: number, i: { montant: number }) => acc + Number(i.montant), 0);
      await db.from('bailleurs').update({ solde_disponible: Math.round(solde * 100) / 100, total_impots_dus: impotsDus }).eq('id', contract.bailleur_id);

      if (taxReversed) {
        await db.from('calculs_fiscaux').update({ notes: `Annulé — remboursement du ${new Date().toISOString()} (${body.reason})` }).eq('paiement_id', payment.id);
      }
    }

    // 6. Notifications + audit
    const fmt = `${Math.round(amount).toLocaleString('fr-CD')} ${payment.currency}`;
    const rows = [
      { user_id: contract.locataire_id, title: 'Remboursement effectué', message: `Votre paiement ${payment.reference} (${payment.periode}) a été remboursé : ${fmt}.`, type: 'payment', metadata: { payment_id: payment.id, refund: true } },
    ];
    if (contract.bailleur?.user_id) {
      rows.push({ user_id: contract.bailleur.user_id, title: 'Paiement remboursé', message: `Le loyer ${payment.periode} (${payment.reference}) a été remboursé au locataire : ${fmt}.`, type: 'payment', metadata: { payment_id: payment.id, refund: true } });
    }
    await db.from('notifications').insert(rows);

    await writeAuditLog(db, {
      userId: user.id,
      action: 'payment.refunded',
      entityType: 'paiements',
      entityId: payment.id,
      oldData: { state: payment.state, montant: total },
      newData: { state: updated.state, refundedAmount: amount, providerRefundId: refund.providerRefundId, taxReversed, reason: body.reason },
      ip,
      userAgent: ua,
    });

    plog.info('refund completed', { amount, providerRefundId: refund.providerRefundId, taxReversed });
    return json(req, {
      paymentId: payment.id,
      state: updated.state,
      refundedAmount: amount,
      providerRefundId: refund.providerRefundId,
      taxReversed,
    });
  } catch (error) {
    log.error('payment-refund failed', error);
    return errorResponse(req, error, log.requestId);
  }
});
