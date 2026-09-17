import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  availableEvents,
  canRetryInitiation,
  canTransition,
  InvalidTransitionError,
  isFinal,
  isInFlight,
  isSuccessful,
  isTerminal,
  PAYMENT_EVENTS,
  PAYMENT_STATES,
  providerStatusToEvent,
  transition,
  type PaymentEvent,
  type PaymentState,
} from '@/services/payment/stateMachine';
import { expectedMirror, MIRRORS } from '../../scripts/sync-edge-shared.mjs';

/** Every legal transition of the spec, as (from, event, to). */
const LEGAL: Array<[PaymentState, PaymentEvent, PaymentState]> = [
  ['draft', 'VALIDATE', 'validating'],
  ['draft', 'USER_CANCELLED', 'cancelled'],
  // Validation passes but the provider has not been called yet: stays in `validating` until INITIATE.
  ['validating', 'VALIDATION_SUCCESS', 'validating'],
  ['validating', 'VALIDATION_FAILED', 'failed'],
  ['validating', 'INITIATE', 'pending'],
  ['validating', 'USER_CANCELLED', 'cancelled'],
  ['pending', 'PROVIDER_ACCEPTED', 'processing'],
  ['pending', 'PROVIDER_REQUIRES_ACTION', 'requires_action'],
  ['pending', 'PROVIDER_SUCCESS', 'succeeded'],
  ['pending', 'PROVIDER_FAILED', 'failed'],
  ['pending', 'USER_CANCELLED', 'cancelled'],
  ['pending', 'TIMEOUT', 'expired'],
  ['processing', 'PROVIDER_REQUIRES_ACTION', 'requires_action'],
  ['processing', 'PROVIDER_SUCCESS', 'succeeded'],
  ['processing', 'PROVIDER_FAILED', 'failed'],
  ['processing', 'TIMEOUT', 'expired'],
  ['requires_action', 'USER_ACTION_COMPLETED', 'processing'],
  ['requires_action', 'PROVIDER_SUCCESS', 'succeeded'],
  ['requires_action', 'PROVIDER_FAILED', 'failed'],
  ['requires_action', 'USER_CANCELLED', 'cancelled'],
  ['requires_action', 'TIMEOUT', 'expired'],
  ['expired', 'PROVIDER_SUCCESS', 'succeeded'],
  ['succeeded', 'REFUND', 'refunded'],
  ['succeeded', 'DISPUTE', 'disputed'],
  ['disputed', 'REFUND', 'refunded'],
];

describe('payment state machine — transition table', () => {
  it.each(LEGAL)('%s --%s--> %s', (from, event, to) => {
    expect(canTransition(from, event)).toBe(to);
    expect(transition(from, event)).toBe(to);
  });

  it('rejects every transition that is not in the table', () => {
    const legal = new Set(LEGAL.map(([f, e]) => `${f}:${e}`));
    for (const from of PAYMENT_STATES) {
      for (const event of PAYMENT_EVENTS) {
        if (legal.has(`${from}:${event}`)) continue;
        expect(canTransition(from, event), `${from} --${event}--> should be illegal`).toBeNull();
        expect(() => transition(from, event)).toThrow(InvalidTransitionError);
      }
    }
  });

  it('never lets money states regress', () => {
    expect(canTransition('succeeded', 'PROVIDER_FAILED')).toBeNull();
    expect(canTransition('succeeded', 'USER_CANCELLED')).toBeNull();
    expect(canTransition('succeeded', 'TIMEOUT')).toBeNull();
    expect(canTransition('refunded', 'PROVIDER_SUCCESS')).toBeNull();
  });

  it('final states have no outgoing events', () => {
    for (const state of ['failed', 'cancelled', 'refunded'] as PaymentState[]) {
      expect(availableEvents(state)).toEqual([]);
      expect(isFinal(state)).toBe(true);
    }
  });

  it('exposes the InvalidTransitionError context', () => {
    try {
      transition('failed', 'PROVIDER_SUCCESS');
      expect.unreachable();
    } catch (e) {
      const err = e as InvalidTransitionError;
      expect(err).toBeInstanceOf(InvalidTransitionError);
      expect(err.from).toBe('failed');
      expect(err.event).toBe('PROVIDER_SUCCESS');
    }
  });
});

describe('payment state machine — predicates', () => {
  it('isTerminal', () => {
    for (const s of ['succeeded', 'failed', 'cancelled', 'expired', 'refunded', 'disputed'] as PaymentState[]) expect(isTerminal(s)).toBe(true);
    for (const s of ['draft', 'validating', 'pending', 'processing', 'requires_action'] as PaymentState[]) expect(isTerminal(s)).toBe(false);
  });

  it('isSuccessful covers every state where money was received', () => {
    expect(isSuccessful('succeeded')).toBe(true);
    expect(isSuccessful('refunded')).toBe(true);
    expect(isSuccessful('disputed')).toBe(true);
    expect(isSuccessful('failed')).toBe(false);
    expect(isSuccessful('expired')).toBe(false);
  });

  it('isInFlight is exactly the polling set', () => {
    const inFlight = PAYMENT_STATES.filter(isInFlight);
    expect(inFlight).toEqual(['pending', 'processing', 'requires_action']);
  });

  it('canRetryInitiation only from safe states', () => {
    expect(PAYMENT_STATES.filter(canRetryInitiation)).toEqual(['draft', 'validating', 'failed', 'expired']);
  });

  it('maps provider statuses to events shared by verify and webhook', () => {
    expect(providerStatusToEvent('processing')).toBe('PROVIDER_ACCEPTED');
    expect(providerStatusToEvent('requires_action')).toBe('PROVIDER_REQUIRES_ACTION');
    expect(providerStatusToEvent('succeeded')).toBe('PROVIDER_SUCCESS');
    expect(providerStatusToEvent('failed')).toBe('PROVIDER_FAILED');
    expect(providerStatusToEvent('cancelled')).toBe('USER_CANCELLED');
    expect(providerStatusToEvent('expired')).toBe('TIMEOUT');
    expect(providerStatusToEvent('pending')).toBeNull();
  });
});

describe('edge mirror', () => {
  it('supabase/functions/_shared/stateMachine.ts is byte-identical to the frontend module (+ header)', () => {
    for (const { source, target } of MIRRORS) {
      const actual = readFileSync(resolve(__dirname, '../..', target), 'utf8');
      expect(actual, `${target} out of sync — run: npm run sync:edge`).toBe(expectedMirror(source));
    }
  });
});
