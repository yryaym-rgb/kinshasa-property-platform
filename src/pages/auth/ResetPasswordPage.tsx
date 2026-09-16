import { lazy, Suspense, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';
import { newPasswordSchema, validate, type FieldErrors } from '@/validations/authSchemas';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthCard, AuthCardHeader } from '@/components/auth/AuthCard';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { SuccessMark } from '@/components/auth/SuccessMark';
import { TrustFooter } from '@/components/auth/TrustFooter';
import { Alert, AuthButton, useShake } from '@/components/auth/primitives';
import { useAuthErrorMessage } from '@/components/auth/useAuthError';
import { AlertCircleIcon, ArrowRightIcon, KeyIcon } from '@/components/landing/icons';

const PasswordStrengthMeter = lazy(() =>
  import('@/components/auth/PasswordStrengthMeter').then((m) => ({ default: m.PasswordStrengthMeter })),
);

type Field = 'password' | 'confirm';

/**
 * Target of both reset paths: the e-mail recovery link (Supabase exchanges the
 * URL token for a session before React mounts) and the SMS code flow (the OTP
 * page lands here with a fresh session). Without a session the link is stale.
 */
export function ResetPasswordPage() {
  const t = useT();
  const { session, loading, updatePassword, logout } = useAuth();
  const describeError = useAuthErrorMessage();
  const [shakeProps, shake] = useShake();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Fetch the meter as soon as the form is on screen so it never pops in mid-typing.
  useEffect(() => {
    if (session) void import('@/components/auth/PasswordStrengthMeter');
  }, [session]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const result = validate<typeof newPasswordSchema, Field>(newPasswordSchema, { password, confirm });
    if (!result.success) {
      setErrors(result.errors);
      shake();
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (error) {
      setFormError(describeError(error));
      shake();
    } finally {
      setSubmitting(false);
    }
  };

  let body: ReactNode;

  if (done) {
    body = (
      <SuccessMark title={t('reset.success')} description={t('reset.success.sub')}>
        <div className="mt-8">
          {/* The recovery session is dropped so the citizen signs in with the new password. */}
          <AuthButton icon={<ArrowRightIcon size={18} />} iconPosition="right" arrow onClick={() => void logout('password-updated')}>
            {t('reset.toLogin')}
          </AuthButton>
        </div>
      </SuccessMark>
    );
  } else if (loading && !session) {
    body = (
      <div className="auth-center flex min-h-[320px] flex-col items-center justify-center" role="status" aria-live="polite">
        <span className="auth-spinner h-8 w-8 border-drc-gray-200 text-drc-blue-ink" aria-hidden="true" />
        <p className="auth-muted mt-4">{t('common.loading')}</p>
      </div>
    );
  } else if (!session) {
    body = (
      <div className="auth-enter">
        <AuthCardHeader
          align="center"
          size="md"
          badge={<AlertCircleIcon size={28} />}
          badgeTone="red"
          title={t('reset.expired.title')}
          subtitle={t('reset.expired.sub')}
        />
        <div className="mt-8 flex flex-col gap-4">
          <Link to={ROUTES.FORGOT_PASSWORD} className="auth-btn auth-btn--primary">
            {t('reset.expired.cta')}
            <ArrowRightIcon size={18} />
          </Link>
          <Link to={ROUTES.LOGIN} className="auth-link text-center text-[14px]">
            {t('forgot.back')}
          </Link>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <AuthCardHeader align="center" size="md" badge={<KeyIcon size={28} />} title={t('reset.title')} subtitle={t('reset.sub')} />

        <form
          className={cn('auth-form auth-enter mt-8', shakeProps.className)}
          onAnimationEnd={shakeProps.onAnimationEnd}
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
        >
          <div className="auth-form" style={{ gap: 12 }}>
            <PasswordInput
              id="reset-password"
              label={t('register.password')}
              placeholder={t('register.password.placeholder')}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password ? t(errors.password) : undefined}
              aria-describedby="password-strength"
              autoFocus
              required
            />
            <Suspense fallback={<div aria-hidden="true" style={{ minHeight: 96 }} />}>
              <PasswordStrengthMeter password={password} />
            </Suspense>
          </div>

          <PasswordInput
            id="reset-confirm"
            label={t('register.confirm')}
            placeholder={t('register.confirm.placeholder')}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm ? t(errors.confirm) : undefined}
            success={confirm && confirm === password ? t('register.confirm.match') : undefined}
            required
          />

          {formError ? <Alert>{formError}</Alert> : null}

          <AuthButton
            type="submit"
            loading={submitting}
            loadingLabel={t('reset.submitting')}
            icon={<ArrowRightIcon size={18} />}
            iconPosition="right"
            arrow
          >
            {t('reset.submit')}
          </AuthButton>
        </form>
      </>
    );
  }

  return (
    <AuthLayout title={t('reset.pageTitle')} variant="centered">
      <AuthCard>{body}</AuthCard>
      <TrustFooter />
    </AuthLayout>
  );
}
