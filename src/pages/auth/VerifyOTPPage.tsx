import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCountdown, useLockout } from '@/hooks/useLockout';
import { useT } from '@/i18n';
import { AUTH_CONFIG, OTP_CONFIG } from '@/config/app.config';
import { ROUTES } from '@/config/routes';
import { formatCountdown, formatRemaining } from '@/lib/authRateLimit';
import { getPendingFlow } from '@/lib/authStorage';
import { formatE164ForDisplay } from '@/lib/phone';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthCard, AuthCardHeader } from '@/components/auth/AuthCard';
import { OTPInput } from '@/components/auth/OTPInput';
import { SuccessMark } from '@/components/auth/SuccessMark';
import { TrustFooter } from '@/components/auth/TrustFooter';
import { Alert } from '@/components/auth/primitives';
import { useAuthErrorMessage } from '@/components/auth/useAuthError';
import { authToast } from '@/components/auth/toast';
import { MessageIcon } from '@/components/landing/icons';

type Status = 'idle' | 'verifying' | 'error' | 'success';

const SUCCESS_REDIRECT_MS = 1200;

export function VerifyOTPPage() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyCode, resendCode } = useAuth();
  const describeError = useAuthErrorMessage();
  const verifyLock = useLockout('otp-verify');
  const sendLock = useLockout('otp-send');
  const countdown = useCountdown(OTP_CONFIG.resendDelaySeconds);

  const pending = getPendingFlow();
  const phone = searchParams.get('phone') ?? pending?.phone ?? '';
  const backTo = pending?.type === 'register' ? ROUTES.REGISTER : pending?.type === 'reset' ? ROUTES.FORGOT_PASSWORD : ROUTES.LOGIN;

  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [resending, setResending] = useState(false);
  const redirectTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(redirectTimer.current), []);

  const handleComplete = useCallback(
    async (value: string) => {
      if (status === 'verifying' || status === 'success' || verifyLock.locked) return;
      setStatus('verifying');
      setError(null);
      try {
        const { redirectTo } = await verifyCode(phone, value);
        setStatus('success');
        redirectTimer.current = window.setTimeout(() => navigate(redirectTo, { replace: true }), SUCCESS_REDIRECT_MS);
      } catch (err) {
        setStatus('error');
        setCode('');
        setShakeKey((k) => k + 1);
        const locked = verifyLock.locked || /rate_limited/.test((err as { code?: string })?.code ?? '');
        setError(locked ? t('otp.error.locked') : describeError(err, { invalidKey: 'otp.error.incorrect', lockKey: 'otp-verify' }));
      }
    },
    [status, verifyLock.locked, verifyCode, phone, navigate, t, describeError],
  );

  const handleResend = async () => {
    if (!countdown.done || sendLock.locked || resending) return;
    setResending(true);
    setError(null);
    try {
      await resendCode(phone);
      countdown.restart();
      setStatus('idle');
      setCode('');
      authToast(t('otp.resent'));
    } catch (err) {
      setError(describeError(err, { lockKey: 'otp-send' }));
    } finally {
      setResending(false);
    }
  };

  if (!phone) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  const locked = verifyLock.locked;
  const inputStatus = status === 'error' ? 'error' : status === 'success' ? 'success' : 'idle';

  return (
    <AuthLayout title={t('otp.pageTitle')} variant="centered">
      <AuthCard>
        {status === 'success' ? (
          <SuccessMark title={t('otp.success')} description={t('otp.success.sub')} />
        ) : (
          <div className="auth-enter">
            <AuthCardHeader
              align="center"
              size="md"
              badge={<MessageIcon size={28} />}
              title={t('otp.title')}
              subtitle={t('otp.sub')}
            >
              <p className="auth-phone-display">{formatE164ForDisplay(phone)}</p>
              <Link to={backTo} className="auth-link auth-link--muted mt-2 inline-block text-[13px]">
                {t('otp.changeNumber')}
              </Link>
            </AuthCardHeader>

            <div className="mt-8">
              <OTPInput
                value={code}
                onChange={(next) => {
                  setCode(next);
                  if (status === 'error') setStatus('idle');
                }}
                onComplete={(value) => void handleComplete(value)}
                status={inputStatus}
                disabled={locked || status === 'verifying'}
                shakeKey={shakeKey}
                autoFocus
              />
            </div>

            {/* Fixed-height status region: spinner, error or lock notice — no layout shift. */}
            <div className="mt-5 min-h-[52px]" aria-live="polite" aria-atomic="true">
              {status === 'verifying' ? (
                <p className="auth-muted flex items-center justify-center gap-2">
                  <span className="auth-spinner border-drc-gray-200 text-drc-blue-ink" aria-hidden="true" />
                  {t('otp.verifying')}
                </p>
              ) : locked ? (
                <Alert tone="warn">
                  {t('otp.error.locked')} {t('common.error.tooMany', { duration: formatRemaining(verifyLock.remainingMs) })}
                </Alert>
              ) : error ? (
                <Alert>{error}</Alert>
              ) : null}
            </div>

            <div className="mt-6 text-center">
              <p className="auth-muted">{t('otp.notReceived')}</p>
              <button
                type="button"
                className="auth-link mt-1 text-[14px] disabled:cursor-default disabled:text-drc-gray-400 disabled:no-underline"
                onClick={() => void handleResend()}
                disabled={!countdown.done || sendLock.locked || resending}
                aria-disabled={!countdown.done || sendLock.locked}
              >
                {sendLock.locked
                  ? t('otp.error.smsLimit', { duration: formatRemaining(sendLock.remainingMs) })
                  : countdown.done
                    ? t('otp.resend')
                    : t('otp.resendIn', { time: formatCountdown(countdown.remaining) })}
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]">
              <button
                type="button"
                className="auth-link auth-link--muted"
                onClick={() => authToast(t('otp.callUnavailable'), 'info')}
              >
                {t('otp.viaCall')}
              </button>
            </div>

            <p className="auth-small mt-8 text-center">{t('otp.help', { phone: AUTH_CONFIG.supportPhone })}</p>
          </div>
        )}
      </AuthCard>
      <TrustFooter />
    </AuthLayout>
  );
}
