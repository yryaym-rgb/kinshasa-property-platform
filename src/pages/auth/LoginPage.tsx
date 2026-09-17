import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLockout } from '@/hooks/useLockout';
import { useT } from '@/i18n';
import { ROUTES, getDashboardPathForRole } from '@/config/routes';
import { formatRemaining } from '@/lib/authRateLimit';
import { toE164 } from '@/lib/phone';
import { cn } from '@/lib/cn';
import { loginEmailSchema, loginPhoneSchema, phoneDigitsSchema, validate, type FieldErrors } from '@/validations/authSchemas';
import { AuthLayout, type AuthPanelProps } from '@/components/auth/AuthLayout';
import { AuthCard, AuthCardHeader } from '@/components/auth/AuthCard';
import { PhoneInput } from '@/components/auth/PhoneInput';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { TrustFooter } from '@/components/auth/TrustFooter';
import { Alert, AuthButton, Checkbox, Divider, Tabs, TextField, useShake } from '@/components/auth/primitives';
import { useAuthErrorMessage } from '@/components/auth/useAuthError';
import { ArrowRightIcon, AtIcon, MessageIcon, PhoneIcon } from '@/components/landing/icons';

type Method = 'phone' | 'email';
type Field = 'phone' | 'email' | 'password';

export function LoginPage() {
  const t = useT();
  const { isAuthenticated, user, login, sendLoginCode } = useAuth();
  const [searchParams] = useSearchParams();
  const describeError = useAuthErrorMessage();
  const loginLock = useLockout('login');
  const smsLock = useLockout('otp-send');
  const [shakeProps, shake] = useShake();

  const [method, setMethod] = useState<Method>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'password' | 'sms' | null>(null);
  const identifierRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  // Focus the identifier when the tab changes (initial focus comes from autoFocus).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    identifierRef.current?.focus();
    setErrors({});
    setFormError(null);
  }, [method]);

  const panel: AuthPanelProps = {
    headline: t('panel.login.headline'),
    subheadline: t('panel.login.sub'),
    bullets: [t('panel.login.bullet1'), t('panel.login.bullet2'), t('panel.login.bullet3')],
    testimonial: { quote: t('panel.login.quote'), author: t('panel.login.author') },
  };

  // Session check runs in parallel with first paint; redirect as soon as it resolves.
  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  const notice =
    searchParams.get('reason') === 'inactivity'
      ? t('login.inactivity')
      : searchParams.get('reason') === 'password-updated'
        ? t('login.passwordUpdated')
        : null;

  const fail = (message: string) => {
    setFormError(message);
    shake();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || loginLock.locked) return;
    setFormError(null);

    const result =
      method === 'phone'
        ? validate<typeof loginPhoneSchema, Field>(loginPhoneSchema, { phone, password })
        : validate<typeof loginEmailSchema, Field>(loginEmailSchema, { email, password });
    if (!result.success) {
      setErrors(result.errors);
      shake();
      return;
    }
    setErrors({});

    setSubmitting('password');
    try {
      await login(
        method === 'phone'
          ? { method, phone: toE164(phone), password, rememberMe }
          : { method, email: email.trim(), password, rememberMe },
      );
    } catch (error) {
      fail(describeError(error, { invalidKey: 'login.error.invalid', lockKey: 'login' }));
    } finally {
      setSubmitting(null);
    }
  };

  const handleSms = async () => {
    if (submitting || smsLock.locked) return;
    if (!validate(phoneDigitsSchema, phone).success) {
      setErrors({ phone: 'login.error.phone' });
      identifierRef.current?.focus();
      shake();
      return;
    }
    setErrors({});
    setFormError(null);
    setSubmitting('sms');
    try {
      await sendLoginCode(toE164(phone), rememberMe);
    } catch (error) {
      fail(describeError(error, { lockKey: 'otp-send' }));
      setSubmitting(null);
    }
  };

  const attemptsHint =
    !loginLock.locked && loginLock.attemptsLeft < 5 && formError
      ? ` ${t('login.error.attemptsLeft', { count: loginLock.attemptsLeft })}`
      : '';

  return (
    <AuthLayout title={t('login.pageTitle')} variant="split" panel={panel} indexable>
      <AuthCard>
        <AuthCardHeader title={t('login.title')} subtitle={t('login.subtitle')} />

        <div className="auth-enter">
          {notice ? (
            <Alert tone="info" className="mt-6">
              {notice}
            </Alert>
          ) : null}

          <div className="mt-8">
            <Tabs<Method>
              label={t('login.title')}
              value={method}
              onChange={setMethod}
              tabs={[
                { id: 'phone', label: t('login.tab.phone'), icon: <PhoneIcon size={18} /> },
                { id: 'email', label: t('login.tab.email'), icon: <AtIcon size={18} /> },
              ]}
            />
          </div>

          {/* `tabpanel` is not an allowed role on <form>, so the panel is a wrapper. */}
          <div id={`auth-tab-panel-${method}`} role="tabpanel" aria-labelledby={`auth-tab-${method}`}>
            <form
              className={cn('auth-form mt-6', shakeProps.className)}
              onAnimationEnd={shakeProps.onAnimationEnd}
              onSubmit={(e) => void handleSubmit(e)}
              noValidate
            >
              {method === 'phone' ? (
                <PhoneInput
                  key="phone"
                  ref={identifierRef}
                  id="login-phone"
                  value={phone}
                  onChange={setPhone}
                  error={errors.phone ? t(errors.phone) : undefined}
                  autoFocus
                  required
                />
              ) : (
                <TextField
                  key="email"
                  ref={identifierRef}
                  id="login-email"
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
                  autoFocus
                  required
                />
              )}
  
              <PasswordInput
                id="login-password"
                label={t('login.password.label')}
                placeholder={t('login.password.placeholder')}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password ? t(errors.password) : undefined}
                required
              />
  
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <Checkbox
                  id="login-remember"
                  label={t('login.remember')}
                  hint={t('login.remember.hint')}
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <Link to={ROUTES.FORGOT_PASSWORD} className="auth-link mt-0.5 text-[14px]">
                  {t('login.forgot')}
                </Link>
              </div>
  
              {formError ? (
                <Alert id="login-error">
                  {formError}
                  {attemptsHint}
                </Alert>
              ) : loginLock.locked ? (
                <Alert tone="warn">{t('login.error.locked', { duration: formatRemaining(loginLock.remainingMs) })}</Alert>
              ) : null}
  
              <AuthButton
                type="submit"
                loading={submitting === 'password'}
                loadingLabel={t('login.submitting')}
                disabled={loginLock.locked || submitting === 'sms'}
                icon={<ArrowRightIcon size={18} />}
                iconPosition="right"
                arrow
              >
                {t('login.submit')}
              </AuthButton>
            </form>
          </div>

          <div className="mt-6">
            <Divider>{t('common.or')}</Divider>
          </div>

          <div className="mt-6">
            {method === 'phone' ? (
              <AuthButton
                variant="outline"
                icon={<MessageIcon size={20} />}
                onClick={() => void handleSms()}
                loading={submitting === 'sms'}
                disabled={smsLock.locked || submitting === 'password'}
              >
                {t('login.alt.sms')}
              </AuthButton>
            ) : (
              <AuthButton variant="outline" icon={<PhoneIcon size={20} />} onClick={() => setMethod('phone')}>
                {t('login.alt.phone')}
              </AuthButton>
            )}
          </div>

          <p className="auth-muted mt-8 text-center">
            {t('login.noAccount')}{' '}
            <Link to={ROUTES.REGISTER} className="auth-link">
              {t('login.create')}
            </Link>
          </p>

          <TrustFooter />
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
