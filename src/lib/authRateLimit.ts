/**
 * Client-side throttling of authentication attempts. This is a UX guard that
 * mirrors the server-side limits enforced by Supabase Auth: it never replaces
 * them, but it stops the user from hammering the API and explains the wait.
 *
 * Each policy tracks failures inside a sliding window; exceeding the limit
 * locks the action for `baseLockMs`, doubling on every consecutive lock
 * (exponential backoff) up to `maxLockMs`.
 */

export type RateLimitKey = 'login' | 'otp-verify' | 'otp-send' | 'password-reset';

interface Policy {
  maxAttempts: number;
  windowMs: number;
  baseLockMs: number;
  maxLockMs: number;
}

const MINUTE = 60_000;

const POLICIES: Record<RateLimitKey, Policy> = {
  login: { maxAttempts: 5, windowMs: 15 * MINUTE, baseLockMs: 15 * MINUTE, maxLockMs: 2 * 60 * MINUTE },
  'otp-verify': { maxAttempts: 3, windowMs: 5 * MINUTE, baseLockMs: 5 * MINUTE, maxLockMs: 60 * MINUTE },
  'otp-send': { maxAttempts: 3, windowMs: 15 * MINUTE, baseLockMs: 15 * MINUTE, maxLockMs: 60 * MINUTE },
  'password-reset': { maxAttempts: 3, windowMs: 15 * MINUTE, baseLockMs: 15 * MINUTE, maxLockMs: 60 * MINUTE },
};

interface Record_ {
  attempts: number[];
  lockedUntil: number;
  lockCount: number;
}

export interface LockState {
  locked: boolean;
  remainingMs: number;
  attemptsLeft: number;
}

const STORAGE_PREFIX = 'eloyer-auth-rl:';
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function read(key: RateLimitKey): Record_ {
  try {
    const raw = storage()?.getItem(STORAGE_PREFIX + key);
    if (raw) return JSON.parse(raw) as Record_;
  } catch {
    /* corrupted entry — start fresh */
  }
  return { attempts: [], lockedUntil: 0, lockCount: 0 };
}

function write(key: RateLimitKey, record: Record_): void {
  try {
    storage()?.setItem(STORAGE_PREFIX + key, JSON.stringify(record));
  } catch {
    /* quota exceeded or storage disabled — degrade silently */
  }
  listeners.forEach((fn) => fn());
}

function prune(record: Record_, policy: Policy, now: number): Record_ {
  return { ...record, attempts: record.attempts.filter((ts) => now - ts < policy.windowMs) };
}

export function getLockState(key: RateLimitKey, now = Date.now()): LockState {
  const policy = POLICIES[key];
  const record = prune(read(key), policy, now);
  if (record.lockedUntil > now) {
    return { locked: true, remainingMs: record.lockedUntil - now, attemptsLeft: 0 };
  }
  return {
    locked: false,
    remainingMs: 0,
    attemptsLeft: Math.max(0, policy.maxAttempts - record.attempts.length),
  };
}

/**
 * Registers one attempt (a failed sign-in, an OTP mismatch, an SMS send…).
 * Returns the resulting state so the caller can render the right message.
 */
export function recordAttempt(key: RateLimitKey, now = Date.now()): LockState {
  const policy = POLICIES[key];
  const record = prune(read(key), policy, now);
  record.attempts.push(now);

  if (record.attempts.length >= policy.maxAttempts) {
    const lockMs = Math.min(policy.baseLockMs * 2 ** record.lockCount, policy.maxLockMs);
    record.lockedUntil = now + lockMs;
    record.lockCount += 1;
    record.attempts = [];
  }

  write(key, record);
  return getLockState(key, now);
}

/** Clears failures after a success. The backoff multiplier is kept for an hour. */
export function resetAttempts(key: RateLimitKey): void {
  const record = read(key);
  write(key, { attempts: [], lockedUntil: 0, lockCount: record.lockCount });
}

export function subscribeRateLimit(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** "15 min" / "45 s" — human-readable remaining time. */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds >= 60) return `${Math.ceil(totalSeconds / 60)} min`;
  return `${totalSeconds} s`;
}

/** "00:45" — for countdown displays. */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
