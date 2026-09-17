import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeDelay, DEFAULT_RETRY_POLICY, defaultShouldRetry, withRetry } from '@/services/payment/retryPolicy';
import { PaymentError } from '@/utils/paymentErrors';

const NO_DELAY = { baseDelayMs: 0, maxDelayMs: 0, jitter: false };

describe('retry policy', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('refuses non-idempotent operations outright', async () => {
    const fn = vi.fn();
    await expect(withRetry(fn, { idempotent: false })).rejects.toThrow(/non idempotente/);
    expect(fn).not.toHaveBeenCalled();
  });

  it('retries retryable errors up to 3 attempts then throws the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new PaymentError('provider_timeout'));
    const promise = withRetry(fn, { idempotent: true, policy: NO_DELAY });
    const settled = promise.catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const error = (await settled) as PaymentError;
    expect(error.code).toBe('provider_timeout');
    expect(fn).toHaveBeenCalledTimes(DEFAULT_RETRY_POLICY.maxAttempts);
  });

  it('returns the first successful result', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new PaymentError('provider_unavailable')).mockResolvedValueOnce('ok');
    const promise = withRetry(fn, { idempotent: true, policy: NO_DELAY });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('never retries after a user cancellation', async () => {
    const fn = vi.fn().mockRejectedValue(new PaymentError('user_cancelled'));
    await expect(withRetry(fn, { idempotent: true, policy: NO_DELAY })).rejects.toMatchObject({ code: 'user_cancelled' });
    expect(fn).toHaveBeenCalledTimes(1);

    const abort = vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(withRetry(abort, { idempotent: true, policy: NO_DELAY })).rejects.toThrow('aborted');
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it('stops immediately on non-retryable business errors', async () => {
    const fn = vi.fn().mockRejectedValue(new PaymentError('insufficient_funds'));
    await expect(withRetry(fn, { idempotent: true, policy: NO_DELAY })).rejects.toMatchObject({ code: 'insufficient_funds' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('honours an aborted signal between attempts', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockImplementation(() => {
      controller.abort();
      return Promise.reject(new PaymentError('provider_timeout'));
    });
    const promise = withRetry(fn, { idempotent: true, signal: controller.signal, policy: { ...NO_DELAY, baseDelayMs: 10, maxDelayMs: 10 } });
    const settled = promise.catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    expect(((await settled) as Error).name).toBe('AbortError');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reports each retry with its delay', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValueOnce(new PaymentError('provider_error')).mockResolvedValueOnce(1);
    const promise = withRetry(fn, { idempotent: true, policy: NO_DELAY, onRetry });
    await vi.runAllTimersAsync();
    await promise;
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0]?.[1]).toBe(1);
  });
});

describe('computeDelay', () => {
  const policy = { ...DEFAULT_RETRY_POLICY, jitter: false };

  it('grows exponentially and is capped', () => {
    expect(computeDelay(1, policy)).toBe(500);
    expect(computeDelay(2, policy)).toBe(1000);
    expect(computeDelay(3, policy)).toBe(2000);
    expect(computeDelay(10, policy)).toBe(policy.maxDelayMs);
  });

  it('applies full jitter within [0, exp]', () => {
    expect(computeDelay(2, { ...policy, jitter: true }, () => 0)).toBe(0);
    expect(computeDelay(2, { ...policy, jitter: true }, () => 0.5)).toBe(500);
    expect(computeDelay(2, { ...policy, jitter: true }, () => 1)).toBe(1000);
  });
});

describe('defaultShouldRetry', () => {
  it('uses the canonical retryability of PaymentError', () => {
    expect(defaultShouldRetry(new PaymentError('rate_limited'))).toBe(true);
    expect(defaultShouldRetry(new PaymentError('contract_inactive'))).toBe(false);
  });

  it('treats fetch TypeErrors as transient', () => {
    expect(defaultShouldRetry(new TypeError('Failed to fetch'))).toBe(true);
    expect(defaultShouldRetry(new TypeError('x is not a function'))).toBe(false);
  });
});
