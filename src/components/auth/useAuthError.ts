import { useCallback } from 'react';
import { useT, type MessageKey } from '@/i18n';
import { formatRemaining, getLockState, type RateLimitKey } from '@/lib/authRateLimit';

interface AuthErrorLike {
  name: string;
  code: string;
}

function isAuthErrorLike(error: unknown): error is AuthErrorLike {
  return typeof error === 'object' && error !== null && (error as AuthErrorLike).name === 'AuthError';
}

/**
 * Turns a thrown error into a friendly, non-revealing French message. The
 * `invalidKey` lets each page phrase "wrong credentials" in its own words.
 */
export function useAuthErrorMessage() {
  const t = useT();

  return useCallback(
    (error: unknown, options: { invalidKey?: MessageKey; lockKey?: RateLimitKey } = {}): string => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return t('common.error.offline');

      if (isAuthErrorLike(error)) {
        switch (error.code) {
          case 'rate_limited': {
            const remaining = options.lockKey ? getLockState(options.lockKey).remainingMs : 0;
            return t('common.error.tooMany', { duration: formatRemaining(remaining || 15 * 60_000) });
          }
          case 'invalid_credentials':
            return t(options.invalidKey ?? 'login.error.invalid');
          case 'otp_invalid':
          case 'otp_expired':
            return t(options.invalidKey ?? 'otp.error.incorrect', { count: getLockState('otp-verify').attemptsLeft });
          case 'network':
            return t('common.error.offline');
          case 'weak_password':
            return t('register.password.error');
          default:
            return t('common.error.generic');
        }
      }
      return t('common.error.generic');
    },
    [t],
  );
}
