/**
 * Settlement — turns a provider verdict into a state-machine transition and,
 * on success, runs the post-success pipeline.
 *
 * Both payment-verify (pull) and payment-webhook (push) call
 * `applyProviderVerdict`, so "what happens when the operator says X" exists
 * exactly once. The function is idempotent: an event that is illegal from
 * the current state (e.g. a duplicate success) is ignored and reported, never
 * applied twice.
 */

import { type DbClient, type PaymentRow, transitionPayment } from './db.ts';
import type { Logger } from './logger.ts';
import { runPostSuccessPipeline, type PipelineResult } from './pipeline.ts';
import { canTransition, isPaymentState, type PaymentEvent, type PaymentState, providerStatusToEvent } from './stateMachine.ts';

export type ProviderVerdictStatus = 'pending' | 'processing' | 'requires_action' | 'succeeded' | 'failed' | 'cancelled' | 'expired';

export interface ProviderVerdict {
  status: ProviderVerdictStatus;
  /** Normalised failure code (insufficient_funds, user_cancelled, …). */
  failureReason?: string;
  providerReference?: string;
  paidAt?: string;
  amount?: number;
  currency?: string;
  raw?: unknown;
}

export interface SettlementOptions {
  /** Who is asserting the verdict: `provider:orange_money`, `webhook:…`, `system`. */
  actor: string;
  /** Free-text reason for the history row. */
  reason?: string;
  /** Extra data for the history row. */
  metadata?: Record<string, unknown>;
  /** Run the post-success pipeline synchronously when the payment succeeds (default true). */
  runPipeline?: boolean;
}

export interface SettlementResult {
  payment: PaymentRow;
  /** True when the state actually changed. */
  changed: boolean;
  event: PaymentEvent | null;
  /** Why nothing changed (`no_event`, `illegal_transition`, `already_terminal`). */
  ignoredReason?: string;
  pipeline?: PipelineResult;
}

export async function applyProviderVerdict(
  db: DbClient,
  payment: PaymentRow,
  verdict: ProviderVerdict,
  log: Logger,
  options: SettlementOptions,
): Promise<SettlementResult> {
  const from = payment.state;
  if (!isPaymentState(from)) throw new Error(`État de paiement inconnu : ${from}`);

  const event = providerStatusToEvent(verdict.status);
  if (!event) {
    return { payment, changed: false, event: null, ignoredReason: 'no_event' };
  }

  const to = canTransition(from, event);
  if (!to) {
    // Duplicate webhook, late failure after success, etc. Never mutate.
    log.warn('provider verdict ignored (illegal transition)', { from, event, status: verdict.status, actor: options.actor });
    return { payment, changed: false, event, ignoredReason: isSettled(from) ? 'already_terminal' : 'illegal_transition' };
  }

  // Amount mismatch between what the provider settled and what we recorded is
  // a red flag: we still record the state (money moved) but flag it loudly.
  const amountMismatch = verdict.amount !== undefined && Math.abs(Number(verdict.amount) - Number(payment.montant)) > 0.5;
  if (amountMismatch) {
    log.error('provider amount differs from payment amount', undefined, { expected: payment.montant, received: verdict.amount });
  }

  const previousMeta = payment.provider_metadata ?? {};
  const patch = {
    failure_reason: to === 'succeeded' ? null : (verdict.failureReason ?? (to === 'expired' ? 'provider_timeout' : to === 'cancelled' ? 'user_cancelled' : to === 'failed' ? 'provider_rejected' : payment.failure_reason)),
    paid_at: to === 'succeeded' ? (verdict.paidAt ?? new Date().toISOString()) : undefined,
    provider_metadata: {
      ...previousMeta,
      providerReference: verdict.providerReference ?? previousMeta.providerReference ?? null,
      settledAmount: verdict.amount ?? null,
      settledCurrency: verdict.currency ?? null,
      amountMismatch,
      lastVerdict: { status: verdict.status, at: new Date().toISOString(), actor: options.actor },
      lastRaw: verdict.raw ?? null,
    },
  };

  const updated = await transitionPayment(db, {
    paymentId: payment.id,
    from,
    to,
    event,
    reason: options.reason ?? `Verdict opérateur : ${verdict.status}`,
    actor: options.actor,
    metadata: { ...options.metadata, providerStatus: verdict.status, failureReason: verdict.failureReason ?? null, amountMismatch },
    patch,
  });

  log.info('payment transitioned', { from, to, event, actor: options.actor });

  let pipeline: PipelineResult | undefined;
  if (to === 'succeeded' && options.runPipeline !== false) {
    pipeline = await runPostSuccessPipeline(db, updated.id, log, { actor: options.actor });
  }

  return { payment: updated, changed: true, event, pipeline };
}

/** True when nothing more can come from the provider for this payment. */
export function isSettled(state: string): state is PaymentState {
  return state === 'succeeded' || state === 'failed' || state === 'cancelled' || state === 'refunded' || state === 'disputed';
}
