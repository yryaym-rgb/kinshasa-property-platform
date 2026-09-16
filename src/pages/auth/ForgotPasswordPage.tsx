import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCountdown, useLockout } from '@/hooks/useLockout';
import { useT } from '@/i18n';
import { OTP_CONFIG } from '@/config/app.config';
import { ROUTES } from '@/config/routes';
import { formatCountdown, formatRemaining } from '@/lib/authRateLimit';
import { formatE164ForDisplay, toE164 } from '@/lib/phone';
import { cn } from '@/lib/cn';
import { emailSchema, phoneDigitsSchema, validate, type FieldErrors } from '@/validations/authSchemas';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthCard, AuthCardHeader } from '@/components/auth/AuthCard';
import { PhoneInput } from '@/components/auth/PhoneInput';
import { SuccessMark } from '@/components/auth/SuccessMark';
import { TrustFooter } from '@/components/auth/TrustFooter';
import { Alert, AuthButton, Tabs, TextField, useShake } from '@/components/auth/primitives';
import { useAuthErrorMessage } from '@/components/auth/useAuthError';
import { authToast } from '@/components/auth/toast';
import { ArrowLeftIcon, ArrowRightIcon, AtIcon, KeyIcon, PhoneIcon } from '@/components/landing/icons';

type Method = 'phone' | 'email';
type Field = 'phone' | 'email';

export function ForgotPasswordPage() {
  const t = useT();
  const navigate = useNavigate();
  const { requestPasswordReset } = useAuth();
  const describeError = useAuthErrorMessage();
  const resetLock = useLockout('password-reset');
  const countdown = useCountdown(OTP_CONFIG.resendDelaySeconds, false);
  const [shakeProps, shake] = useShake();

  const [method, setMethod] = useState<Method>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  /** Identifier (E.164 or email) the request was sent to; non-null means success state. */
  const [sentTo, setSentTo] = useState<{ method: Method; target: string } | null>(null);
  const identifierRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    identifierRef.current?.focus();
    setErrors({});
    setFormError(null);
  }, [method]);

  const send = async (): Promise<boolean> => {
    if (method === 'phone') {
      await requestPasswordReset({ method, phone: toE164(phone) });
    } else {
      await requestPasswordReset({ method, email: email.trim() });
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || resetLock.locked) return;
    setFormError(null);

    const result =
      method === 'phone' ? validate(phoneDigitsSchema, phone) : validate(emailSchema, email);
    if (!result.success) {
      setErrors({ [method]: method === 'phone' ? 'login.error.phone' : 'login.error.email' });
      identifierRef.current?.focus();
      shake();
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      await send();
      setSentTo({ method, target: method === 'phone' ? toE164(phone) : email.trim() });
      countdown.restart();
    } catch (error) {
      setFormError(describeError(error, { lockKey: 'password-reset' }));
      shake();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!countdown.done || resending || resetLock.locked) return;
    setResending(true);
    try {
      await send();
      countdown.restart();
      authToast(t('otp.resent'));
    } catch (error) {
      authToast(describeError(error, { lockKey: 'password-reset' }), 'info');
    } finally {
      setResending(false);
    }
  };

  const backLink = (
    <Link to={ROUTES.LOGIN} className="auth-back">
      <ArrowLeftIcon size={16} />
      {t('forgot.back')}
    </Link>
  );

  if (sentTo) {
    const displayTarget = sentTo.method === 'phone' ? formatE164ForDisplay(sentTo.target) : sentTo.target;
    return (
      <AuthLayout title={t('forgot.pageTitle')} variant="centered">
        <AuthCard>
          <SuccessMark
            title={sentTo.method === 'phone' ? t('forgot.success.phone') : t('forgot.success.email')}
            description={
              sentTo.method === 'phone'
                ? t('forgot.success.sub.phone', { target: displayTarget })
                : t('forgot.success.sub.email', { target: displayTarget })
            }
          >
            <div className="mt-8 flex flex-col gap-3">
              {sentTo.method === 'phone' ? (
                <AuthButton
                  icon={<ArrowRightIcon size={18} />}
                  iconPosition="right"
                  arrow
                  onClick={() => navigate(`${ROUTES.VERIFY}?phone=${encodeURIComponent(sentTo.target)}`)}
                >
                  {t('forgot.success.enterCode')}
                </AuthButton>
              ) : null}

              <button
                type="button"
                className="auth-link text-[14px] disabled:cursor-default disabled:text-drc-gray-400 disabled:no-underline"
                onClick={() => void handleResend()}
                disabled={!countdown.done || resending || resetLock.locked}
              >
                {resetLock.locked
                  ? t('common.error.tooMany', { duration: formatRemaining(resetLock.remainingMs) })
                  : countdown.done
                    ? t('otp.resend')
                    : t('otp.resendIn', { time: formatCountdown(countdown.remaining) })}
              </button>
            </div>

            <div className="mt-8 flex justify-center">{backLink}</div>
          </SuccessMark>
        </AuthCard>
        <TrustFooter />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('forgot.pageTitle')} variant="centered">
      <AuthCard>
        <div className="mb-6">{backLink}</div>

        <AuthCardHeader
          align="center"
          size="md"
          badge={<KeyIcon size={28} />}
          badgeTone="yellow"
          title={t('forgot.title')}
          subtitle={t('forgot.sub')}
        />

        <div className="auth-enter">
          <div className="mt-8">
            <Tabs<Method>
              label={t('forgot.title')}
              value={method}
              onChange={setMethod}
              idPrefix="forgot-tab"
              tabs={[
                { id: 'phone', label: t('login.tab.phone'), icon: <PhoneIcon size={18} /> },
                { id: 'email', label: t('login.tab.email'), icon: <AtIcon size={18} /> },
              ]}
            />
          </div>

          <form
            id={`forgot-tab-panel-${method}`}
            role="tabpanel"
            aria-labelledby={`forgot-tab-${method}`}
            className={cn('auth-form mt-6', shakeProps.className)}
            onAnimationEnd={shakeProps.onAnimationEnd}
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
          >
            {method === 'phone' ? (
              <PhoneInput
                key="phone"
                ref={identifierRef}
                id="forgot-phone"
                value={phone}
                onChange={setPhone}
                error={errors.phone ? t(errors.phone) : undefined}
                help={t('forgot.help.phone')}
                autoFocus
                required
              />
            ) : (
              <TextField
                key="email"
                ref={identifierRef}
                id="forgot-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="off"
                label={t('login.email.label')}
                placeholder={t('login.email.placeholder')}
                icon={<AtIcon size={20} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email ? t(errors.email) : undefined}
                help={t('forgot.help.email')}
                autoFocus
                required
              />
            )}

            {formError ? (
              <Alert>{formError}</Alert>
            ) : resetLock.locked ? (
              <Alert tone="warn">{t('common.error.tooMany', { duration: formatRemaining(resetLock.remainingMs) })}</Alert>
            ) : null}

            <AuthButton
              type="submit"
              loading={submitting}
              loadingLabel={t('forgot.submitting')}
              disabled={resetLock.locked}
              icon={<ArrowRightIcon size={18} />}
              iconPosition="right"
              arrow
            >
              {t('forgot.submit')}
            </AuthButton>
          </form>

          <TrustFooter />
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
