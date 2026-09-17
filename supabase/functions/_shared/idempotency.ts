/**
 * Idempotency for payment-initiate.
 *
 * Strategy (docs/PAYMENT_ARCHITECTURE.md § Idempotency):
 * 1. The frontend generates `idempotencyKey` once per wizard attempt.
 * 2. `paiements.idempotency_key` is UNIQUE (migration 005).
 * 3. Within the window (5 min) a repeated key returns the *existing* payment
 *    verbatim, without touching the provider.
 * 4. Outside the window the key is considered stale: we refuse (409) rather
 *    than silently create a second payment, forcing the client to mint a new
 *    key — a stale replay is almost always a bug or a double-tap after a long
 *    pause.
 * 5. Two concurrent requests with the same key race on the UNIQUE index: the
 *    loser gets 23505 and re-reads the winner's row.
 *
 * Webhooks have their own idempotency: `payment_webhooks (provider,
 * provider_event_id)` UNIQUE — see payment-webhook/index.ts.
 */

import { IDEMPOTENCY_WINDOW_MS } from './env.ts';
import type { DbClient, PaymentRow } from './db.ts';
import { DbError } from './db.ts';
import { conflict } from './auth.ts';

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;

export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === 'string' && IDEMPOTENCY_KEY_PATTERN.test(key);
}

export type IdempotencyLookup =
  | { kind: 'miss' }
  | { kind: 'replay'; payment: PaymentRow }
  | { kind: 'stale'; payment: PaymentRow };

export async function lookupIdempotencyKey(db: DbClient, key: string, userId: string): Promise<IdempotencyLookup> {
  const { data, error } = await db.from('paiements').select('*').eq('idempotency_key', key).maybeSingle();
  if (error) throw new DbError('idempotency.lookup', error.message);
  if (!data) return { kind: 'miss' };

  const payment = data as PaymentRow;

  // A key must never leak another user's payment.
  if (payment.initiated_by && payment.initiated_by !== userId) {
    throw conflict('duplicate_payment', 'Clé d’idempotence déjà utilisée');
  }

  const age = Date.now() - new Date(payment.created_at).getTime();
  return age <= IDEMPOTENCY_WINDOW_MS ? { kind: 'replay', payment } : { kind: 'stale', payment };
}

/** Postgres unique_violation. */
export function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505';
}

/**
 * Deterministic key for internal, non-user-initiated operations (e.g. the
 * webhook-triggered tax calculation for a payment) so retries are safe.
 */
export function derivedKey(prefix: string, ...parts: string[]): string {
  return `${prefix}:${parts.join(':')}`.slice(0, 100);
}
