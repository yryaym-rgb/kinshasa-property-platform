/**
 * Retry with exponential backoff + full jitter.
 *
 * Rules (docs/PAYMENT_ARCHITECTURE.md § Retries):
 * - Max 3 attempts by default.
 * - Only idempotent operations may be retried (`idempotent: true` is required;
 *   the caller asserts it — e.g. payment-initiate carries an idempotency key,
 *   payment-verify is read-only).
 * - Never retry after the user cancelled (`user_cancelled`, `AbortError`).
 * - Non-retryable error codes stop immediately.
 */

import { isRetryableError, PaymentError } from '@/utils/paymentErrors';

export interface RetryPolicy {
  /** Total attempts including the first one. */
  maxAttempts: number;
  /** Delay before the second attempt. */
  baseDelayMs: number;
  /** Upper bound for a single delay. */
  maxDelayMs: number;
  /** Exponential growth factor. */
  factor: number;
  /** Full jitter: delay = random(0, computed). */
  jitter: boolean;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 4000,
  factor: 2,
  jitter: true,
};

export interface RetryOptions {
  policy?: Partial<RetryPolicy>;
  /** Must be true — refusing to retry non-idempotent calls is the whole point. */
  idempotent: boolean;
  signal?: AbortSignal;
  /** Override the default "is this error retryable" decision. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export function computeDelay(attempt: number, policy: RetryPolicy, random: () => number = Math.random): number {
  const exp = Math.min(policy.maxDelayMs, policy.baseDelayMs * Math.pow(policy.factor, Math.max(0, attempt - 1)));
  if (!policy.jitter) return exp;
  return Math.round(random() * exp);
}

export function isUserCancellation(error: unknown): boolean {
  if (error instanceof PaymentError) return error.code === 'user_cancelled';
  if (error && typeof error === 'object') {
    const e = error as { name?: string; code?: string };
    return e.name === 'AbortError' || e.code === 'user_cancelled';
  }
  return false;
}

export function defaultShouldRetry(error: unknown): boolean {
  if (isUserCancellation(error)) return false;
  if (error instanceof PaymentError) return error.retryable;
  if (error && typeof error === 'object') {
    const e = error as { code?: string; name?: string; message?: string };
    if (e.code) return isRetryableError(e.code);
    if (e.name === 'TypeError' && /fetch|network/i.test(e.message ?? '')) return true;
  }
  return false;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      reject(abortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function abortError(): Error {
  const err = new Error('Opération annulée');
  err.name = 'AbortError';
  return err;
}

/**
 * Runs `fn` with the retry policy. Throws the last error when attempts are
 * exhausted or the error is not retryable.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  if (!options.idempotent) {
    throw new Error('withRetry: refus de réessayer une opération non idempotente');
  }

  const policy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, ...options.policy };
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    if (options.signal?.aborted) throw abortError();
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const isLast = attempt >= policy.maxAttempts;
      if (isLast || isUserCancellation(error) || !shouldRetry(error, attempt)) {
        throw error;
      }
      const delay = computeDelay(attempt, policy);
      options.onRetry?.(error, attempt, delay);
      await sleep(delay, options.signal);
    }
  }

  throw lastError;
}
