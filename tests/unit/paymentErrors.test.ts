import { describe, expect, it } from 'vitest';
import {
  getPaymentErrorMessage,
  isRetryableError,
  mapEdgeError,
  normalizeErrorCode,
  PAYMENT_ERROR_MESSAGES,
  PaymentError,
} from '@/utils/paymentErrors';

describe('payment error mapping — French messages', () => {
  it.each([
    ['insufficient_funds', 'Solde insuffisant sur votre compte Mobile Money.'],
    ['phone_not_registered', "Ce numéro n'est pas enregistré auprès de l'opérateur."],
    ['user_cancelled', 'Vous avez annulé le paiement.'],
    ['provider_timeout', "Le service de l'opérateur ne répond pas. Réessayez."],
    ['duplicate_payment', 'Ce paiement a déjà été effectué.'],
  ])('%s → "%s"', (code, message) => {
    expect(getPaymentErrorMessage(code)).toBe(message);
  });

  it('every code has a non-empty French message', () => {
    for (const [code, message] of Object.entries(PAYMENT_ERROR_MESSAGES)) {
      expect(message.length, code).toBeGreaterThan(10);
    }
  });

  it('normalises provider aliases and unknown codes', () => {
    expect(normalizeErrorCode('insufficient_balance')).toBe('insufficient_funds');
    expect(normalizeErrorCode('invalid_msisdn')).toBe('invalid_phone');
    expect(normalizeErrorCode('timeout')).toBe('provider_timeout');
    expect(normalizeErrorCode('INSUFFICIENT_FUNDS')).toBe('insufficient_funds');
    expect(normalizeErrorCode('something-weird')).toBe('unknown');
    expect(normalizeErrorCode(null)).toBe('unknown');
  });

  it('classifies retryability', () => {
    expect(isRetryableError('provider_timeout')).toBe(true);
    expect(isRetryableError('network_error')).toBe(true);
    expect(isRetryableError('user_cancelled')).toBe(false);
    expect(isRetryableError('insufficient_funds')).toBe(false);
    expect(isRetryableError('duplicate_payment')).toBe(false);
  });
});

describe('mapEdgeError', () => {
  it('reads the {error:{code}} body of a FunctionsHttpError', async () => {
    const response = new Response(JSON.stringify({ error: { code: 'period_already_paid', message: 'x' } }), { status: 409 });
    const err = await mapEdgeError({ name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: response });
    expect(err).toBeInstanceOf(PaymentError);
    expect(err.code).toBe('period_already_paid');
    expect(err.status).toBe(409);
    expect(err.userMessage).toBe(PAYMENT_ERROR_MESSAGES.period_already_paid);
  });

  it('falls back to the HTTP status when the body is not JSON', async () => {
    const err = await mapEdgeError({ name: 'FunctionsHttpError', message: '', context: new Response('nope', { status: 401 }) });
    expect(err.code).toBe('unauthorized');
  });

  it('maps fetch failures to network_error (retryable)', async () => {
    const err = await mapEdgeError({ name: 'FunctionsFetchError', message: 'Failed to send a request' });
    expect(err.code).toBe('network_error');
    expect(err.retryable).toBe(true);
  });

  it('passes PaymentError through untouched', async () => {
    const original = new PaymentError('wrong_pin');
    expect(await mapEdgeError(original)).toBe(original);
  });
});
