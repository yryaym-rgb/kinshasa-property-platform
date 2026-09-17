/**
 * MIRROR of src/services/payment/stateMachine.ts — do not edit here.
 *
 * Supabase bundles Edge Functions from the supabase/functions directory only,
 * so the dependency-free state machine is mirrored into _shared. A unit test
 * (src/services/payment/__tests__/stateMachine.test.ts) fails when the two
 * copies diverge. Edit the frontend file, then run `npm run sync:edge`.
 */

/**
 * Payment transaction state machine — single source of truth for every
 * lifecycle transition. Pure and dependency-free so it is shared verbatim by
 * the Vite frontend and the Deno Edge Functions
 * (`supabase/functions/_shared/stateMachine.ts` is a byte-for-byte mirror,
 * refreshed with `npm run sync:edge` and guarded by a unit test).
 *
 * State diagram: docs/PAYMENT_ARCHITECTURE.md
 */

export type PaymentState =
  | 'draft' // User building payment
  | 'validating' // Checking contract, tenant, amount
  | 'pending' // Sent to provider, awaiting
  | 'processing' // Provider accepted, processing
  | 'requires_action' // User action needed (OTP, redirect)
  | 'succeeded' // Money confirmed received
  | 'failed' // Provider rejected
  | 'cancelled' // User cancelled
  | 'expired' // Timed out
  | 'refunded' // Refunded
  | 'disputed'; // Chargeback / dispute

export type PaymentEvent =
  | 'VALIDATE'
  | 'VALIDATION_SUCCESS'
  | 'VALIDATION_FAILED'
  | 'INITIATE'
  | 'PROVIDER_ACCEPTED'
  | 'PROVIDER_REQUIRES_ACTION'
  | 'USER_ACTION_COMPLETED'
  | 'PROVIDER_SUCCESS'
  | 'PROVIDER_FAILED'
  | 'USER_CANCELLED'
  | 'TIMEOUT'
  | 'REFUND'
  | 'DISPUTE';

export const PAYMENT_STATES: readonly PaymentState[] = [
  'draft',
  'validating',
  'pending',
  'processing',
  'requires_action',
  'succeeded',
  'failed',
  'cancelled',
  'expired',
  'refunded',
  'disputed',
] as const;

export const PAYMENT_EVENTS: readonly PaymentEvent[] = [
  'VALIDATE',
  'VALIDATION_SUCCESS',
  'VALIDATION_FAILED',
  'INITIATE',
  'PROVIDER_ACCEPTED',
  'PROVIDER_REQUIRES_ACTION',
  'USER_ACTION_COMPLETED',
  'PROVIDER_SUCCESS',
  'PROVIDER_FAILED',
  'USER_CANCELLED',
  'TIMEOUT',
  'REFUND',
  'DISPUTE',
] as const;

/**
 * Full transition table. A missing entry means the event is illegal in that
 * state — `canTransition` returns null and callers must not mutate anything.
 *
 * Notable design choices:
 * - `VALIDATION_SUCCESS` leads to `pending` only after `INITIATE` is sent to
 *   the provider; `validating → pending` is therefore driven by `INITIATE`.
 * - `PROVIDER_SUCCESS` is accepted from `pending`, `processing` AND
 *   `requires_action` because webhooks can arrive out of order.
 * - A webhook success arriving after a client-side `expired` verdict is
 *   honoured (money moved) — `expired → succeeded` is legal.
 * - Terminal money states (`succeeded`) can only move to `refunded`/`disputed`.
 */
const TRANSITIONS: Readonly<Record<PaymentState, Partial<Record<PaymentEvent, PaymentState>>>> = {
  draft: {
    VALIDATE: 'validating',
    USER_CANCELLED: 'cancelled',
  },
  validating: {
    VALIDATION_SUCCESS: 'validating',
    VALIDATION_FAILED: 'failed',
    INITIATE: 'pending',
    USER_CANCELLED: 'cancelled',
  },
  pending: {
    PROVIDER_ACCEPTED: 'processing',
    PROVIDER_REQUIRES_ACTION: 'requires_action',
    PROVIDER_SUCCESS: 'succeeded',
    PROVIDER_FAILED: 'failed',
    USER_CANCELLED: 'cancelled',
    TIMEOUT: 'expired',
  },
  processing: {
    PROVIDER_REQUIRES_ACTION: 'requires_action',
    PROVIDER_SUCCESS: 'succeeded',
    PROVIDER_FAILED: 'failed',
    TIMEOUT: 'expired',
  },
  requires_action: {
    USER_ACTION_COMPLETED: 'processing',
    PROVIDER_SUCCESS: 'succeeded',
    PROVIDER_FAILED: 'failed',
    USER_CANCELLED: 'cancelled',
    TIMEOUT: 'expired',
  },
  succeeded: {
    REFUND: 'refunded',
    DISPUTE: 'disputed',
  },
  failed: {},
  cancelled: {},
  expired: {
    // Late provider confirmation after a local timeout: the money did move.
    PROVIDER_SUCCESS: 'succeeded',
  },
  refunded: {},
  disputed: {
    REFUND: 'refunded',
  },
};

/** Returns the next state, or `null` when the event is illegal in `from`. */
export function canTransition(from: PaymentState, event: PaymentEvent): PaymentState | null {
  return TRANSITIONS[from]?.[event] ?? null;
}

export class InvalidTransitionError extends Error {
  readonly from: PaymentState;
  readonly event: PaymentEvent;
  constructor(from: PaymentState, event: PaymentEvent) {
    super(`Transition illégale : ${event} depuis l'état « ${from} »`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.event = event;
  }
}

/** Like `canTransition` but throws — for code paths where illegality is a bug. */
export function transition(from: PaymentState, event: PaymentEvent): PaymentState {
  const next = canTransition(from, event);
  if (!next) throw new InvalidTransitionError(from, event);
  return next;
}

const TERMINAL_STATES: ReadonlySet<PaymentState> = new Set(['succeeded', 'failed', 'cancelled', 'expired', 'refunded', 'disputed']);
const SUCCESSFUL_STATES: ReadonlySet<PaymentState> = new Set(['succeeded', 'refunded', 'disputed']);
const IN_FLIGHT_STATES: ReadonlySet<PaymentState> = new Set(['pending', 'processing', 'requires_action']);
const FINAL_STATES: ReadonlySet<PaymentState> = new Set(['failed', 'cancelled', 'refunded']);

/** No further user-driven progress is possible (a late webhook may still upgrade `expired`). */
export function isTerminal(state: PaymentState): boolean {
  return TERMINAL_STATES.has(state);
}

/** Money was received from the tenant at some point (even if later refunded/disputed). */
export function isSuccessful(state: PaymentState): boolean {
  return SUCCESSFUL_STATES.has(state);
}

/** Awaiting the provider — the realtime/polling hook keeps watching these. */
export function isInFlight(state: PaymentState): boolean {
  return IN_FLIGHT_STATES.has(state);
}

/** Absolutely no transition left. */
export function isFinal(state: PaymentState): boolean {
  return FINAL_STATES.has(state);
}

/** Retrying an initiation is only safe from these states (idempotent operations only). */
export function canRetryInitiation(state: PaymentState): boolean {
  return state === 'draft' || state === 'validating' || state === 'failed' || state === 'expired';
}

export function isPaymentState(value: unknown): value is PaymentState {
  return typeof value === 'string' && (PAYMENT_STATES as readonly string[]).includes(value);
}

export function isPaymentEvent(value: unknown): value is PaymentEvent {
  return typeof value === 'string' && (PAYMENT_EVENTS as readonly string[]).includes(value);
}

/** Legal events for a state (useful for admin tooling and tests). */
export function availableEvents(state: PaymentState): PaymentEvent[] {
  return Object.keys(TRANSITIONS[state]) as PaymentEvent[];
}

/**
 * Maps a provider-normalised status to the event that expresses it.
 * Used by payment-verify and payment-webhook so both paths share one mapping.
 */
export function providerStatusToEvent(
  status: 'pending' | 'processing' | 'requires_action' | 'succeeded' | 'failed' | 'cancelled' | 'expired',
): PaymentEvent | null {
  switch (status) {
    case 'processing':
      return 'PROVIDER_ACCEPTED';
    case 'requires_action':
      return 'PROVIDER_REQUIRES_ACTION';
    case 'succeeded':
      return 'PROVIDER_SUCCESS';
    case 'failed':
      return 'PROVIDER_FAILED';
    case 'cancelled':
      return 'USER_CANCELLED';
    case 'expired':
      return 'TIMEOUT';
    case 'pending':
    default:
      return null;
  }
}

/** French label per state for UI badges. */
export const PAYMENT_STATE_LABELS: Readonly<Record<PaymentState, string>> = {
  draft: 'Brouillon',
  validating: 'Vérification',
  pending: 'En attente',
  processing: 'En cours',
  requires_action: 'Action requise',
  succeeded: 'Réussi',
  failed: 'Échoué',
  cancelled: 'Annulé',
  expired: 'Expiré',
  refunded: 'Remboursé',
  disputed: 'Contesté',
};

/** A single row of `payment_state_history`. */
export interface PaymentStateTransition {
  id: string;
  paiement_id: string;
  from_state: PaymentState | null;
  to_state: PaymentState;
  event: PaymentEvent;
  reason: string | null;
  actor: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
