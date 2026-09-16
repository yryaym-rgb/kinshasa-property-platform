import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLockout } from '@/hooks/useLockout';
import { useT, type MessageKey } from '@/i18n';
import { KINSHASA_COMMUNES } from '@/config/app.config';
import { ROUTES, getDashboardPathForRole } from '@/config/routes';
import {
  EMPTY_DRAFT,
  loadRegisterDraft,
  saveRegisterDraft,
  type RegisterDraft,
  type RegisterRole,
} from '@/lib/authStorage';
import { cn } from '@/lib/cn';
import { registerProfileSchema, validate, type FieldErrors } from '@/validations/authSchemas';
import { AuthLayout, type AuthPanelProps } from '@/components/auth/AuthLayout';
import { AuthCard, AuthCardHeader } from '@/components/auth/AuthCard';
import { AuthStepper } from '@/components/auth/AuthStepper';
import { ProfileSelector } from '@/components/auth/ProfileSelector';
import { PhoneInput } from '@/components/auth/PhoneInput';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { TrustFooter } from '@/components/auth/TrustFooter';
import { Alert, AuthButton, Checkbox, SelectField, TextField, useShake } from '@/components/auth/primitives';
import { useAuthErrorMessage } from '@/components/auth/useAuthError';
import { authToast } from '@/components/auth/toast';
import { ArrowLeftIcon, ArrowRightIcon, AtIcon, HomeIcon, KeyIcon, MapPinIcon, UserIcon } from '@/components/landing/icons';

// Heavy, below-the-first-interaction widgets stream in while the citizen fills step 1.
const DocumentUpload = lazy(() => import('@/components/auth/DocumentUpload').then((m) => ({ default: m.DocumentUpload })));
const PasswordStrengthMeter = lazy(() =>
  import('@/components/auth/PasswordStrengthMeter').then((m) => ({ default: m.PasswordStrengthMeter })),
);
const preloadStepWidgets = () => {
  void import('@/components/auth/DocumentUpload');
  void import('@/components/auth/PasswordStrengthMeter');
};

type Step = 1 | 2 | 3;
type DetailsField = 'fullName' | 'phone' | 'email' | 'commune' | 'address' | 'document';
type SecurityField = 'password' | 'confirm' | 'pin' | 'acceptTerms';

const AUTOSAVE_TOAST_MS = 20_000;
const STEP_TITLES: Record<Step, { title: MessageKey; sub: MessageKey }> = {
  1: { title: 'register.step1.title', sub: 'register.step1.sub' },
  2: { title: 'register.step2.title', sub: 'register.step2.sub' },
  3: { title: 'register.step3.title', sub: 'register.step3.sub' },
};

const isProfessional = (role: RegisterRole | null) => role === 'bailleur' || role === 'agence';
const hasProgress = (draft: RegisterDraft) => draft.step > 1 || Boolean(draft.role || draft.fullName || draft.phone);

export function RegisterPage() {
  const t = useT();
  const { isAuthenticated, user, startRegistration } = useAuth();
  const describeError = useAuthErrorMessage();
  const smsLock = useLockout('otp-send');
  const [shakeProps, shake] = useShake();

  // Draft state is restored synchronously so the first render already shows the saved step.
  const [draft, setDraft] = useState<RegisterDraft>(() => loadRegisterDraft() ?? EMPTY_DRAFT);
  const restored = useRef(hasProgress(draft));
  const [idFile, setIdFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pin, setPin] = useState('');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [detailErrors, setDetailErrors] = useState<FieldErrors<DetailsField>>({});
  const [securityErrors, setSecurityErrors] = useState<FieldErrors<SecurityField>>({});
  const [roleError, setRoleError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dirtySinceToast = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const step = draft.step;

  const patch = useCallback((changes: Partial<RegisterDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    dirtySinceToast.current = true;
  }, []);

  /* ── Autosave: persist on change, confirm every 20 s ─────────── */
  useEffect(() => {
    saveRegisterDraft(draft);
  }, [draft]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (dirtySinceToast.current) {
        dirtySinceToast.current = false;
        authToast(t('register.saved'));
      }
    }, AUTOSAVE_TOAST_MS);
    return () => window.clearInterval(id);
  }, [t]);

  useEffect(() => {
    if (restored.current) {
      restored.current = false;
      authToast(t('register.restored'), 'info');
    }
  }, [t]);

  useEffect(() => {
    if (step >= 2) preloadStepWidgets();
  }, [step]);

  const goTo = (next: Step, dir: 1 | -1) => {
    setDirection(dir);
    setFormError(null);
    patch({ step: next });
    requestAnimationFrame(() => {
      if (window.scrollY > 80) window.scrollTo({ top: 0, behavior: 'auto' });
      headingRef.current?.focus({ preventScroll: true });
    });
  };

  /* ── Step validation ──────────────────────────────────────────── */
  const validateStep1 = () => {
    const result = validate(registerProfileSchema, { role: draft.role });
    setRoleError(result.success ? undefined : t('register.role.error'));
    return result.success;
  };

  const validateStep2 = async () => {
    const { registerDetailsSchema } = await import('@/validations/registerDetailsSchema');
    const result = validate<typeof registerDetailsSchema, DetailsField>(registerDetailsSchema, {
      fullName: draft.fullName,
      phone: draft.phone,
      email: draft.email,
      commune: draft.commune,
      address: draft.address,
    });
    const errors: FieldErrors<DetailsField> = { ...result.errors };
    if (isProfessional(draft.role)) {
      if (!draft.email.trim() && !errors.email) errors.email = 'register.email.required';
      if (!idFile && !errors.document) errors.document = 'register.idDoc.required';
    }
    setDetailErrors(errors);
    if (Object.keys(errors).length > 0) {
      const first = Object.keys(errors)[0];
      document.getElementById(`register-${first}`)?.focus();
      return false;
    }
    return true;
  };

  const validateStep3 = async () => {
    const { registerSecuritySchema } = await import('@/validations/registerSecuritySchema');
    const result = validate<typeof registerSecuritySchema, SecurityField>(registerSecuritySchema, {
      password,
      confirm,
      pin,
      acceptTerms: draft.acceptTerms,
    });
    setSecurityErrors(result.errors);
    if (!result.success) {
      const first = Object.keys(result.errors)[0];
      document.getElementById(`register-${first}`)?.focus();
    }
    return result.success;
  };

  const handleContinue = async (e: FormEvent) => {
    e.preventDefault();
    const ok = step === 1 ? validateStep1() : step === 2 ? await validateStep2() : true;
    if (!ok) {
      shake();
      return;
    }
    if (step < 3) goTo((step + 1) as Step, 1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || smsLock.locked) return;
    if (!(await validateStep3())) {
      shake();
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await startRegistration(draft, password, idFile);
    } catch (error) {
      setFormError(describeError(error, { lockKey: 'otp-send' }));
      shake();
      setSubmitting(false);
    }
  };

  const stepLabels = [t('register.step1.label'), t('register.step2.label'), t('register.step3.label')];
  const panel: AuthPanelProps = {
    headline: t('panel.register.headline'),
    subheadline: t('panel.register.sub'),
    bullets: [t('panel.register.bullet1'), t('panel.register.bullet2'), t('panel.register.bullet3')],
    testimonial: { quote: t('panel.register.quote'), author: t('panel.register.author') },
    steps: { labels: stepLabels, current: step },
  };

  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  const emailHelp = isProfessional(draft.role) ? t('register.email.help.pro') : t('register.email.help.locataire');

  return (
    <AuthLayout title={t('register.pageTitle')} variant="split" panel={panel}>
      <AuthCard>
        <AuthStepper steps={stepLabels} current={step} />

        <div className="mt-8">
          <AuthCardHeader
            title={t(STEP_TITLES[step].title)}
            subtitle={t(STEP_TITLES[step].sub)}
            size={step === 1 ? 'lg' : 'md'}
            id="register-title"
          />
        </div>

        <form
          key={step}
          className={cn('auth-form auth-step-enter mt-8', shakeProps.className)}
          style={{ '--step-dir': direction === 1 ? '16px' : '-16px' } as React.CSSProperties}
          onAnimationEnd={shakeProps.onAnimationEnd}
          onSubmit={step === 3 ? (e) => void handleSubmit(e) : handleContinue}
          aria-labelledby="register-title"
          noValidate
        >
          {/* Focus target announced on step change */}
          <span ref={headingRef} tabIndex={-1} className="sr-only">
            {t('register.stepLabel', { current: step, total: 3 })} — {t(STEP_TITLES[step].title)}
          </span>

          {step === 1 ? (
            <ProfileSelector
              value={draft.role}
              onChange={(role) => {
                patch({ role });
                setRoleError(undefined);
              }}
              error={roleError}
              labelledBy="register-title"
            />
          ) : null}

          {step === 2 ? (
            <>
              <TextField
                id="register-fullName"
                label={t('register.fullName')}
                placeholder={t('register.fullName.placeholder')}
                icon={<UserIcon size={20} />}
                autoComplete="name"
                autoCapitalize="words"
                value={draft.fullName}
                onChange={(e) => patch({ fullName: e.target.value })}
                error={detailErrors.fullName ? t(detailErrors.fullName) : undefined}
                autoFocus
                required
              />
              <PhoneInput
                id="register-phone"
                label={t('register.phone')}
                help={t('register.phone.help')}
                value={draft.phone}
                onChange={(phone) => patch({ phone })}
                error={detailErrors.phone ? t(detailErrors.phone) : undefined}
                required
              />
              <TextField
                id="register-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="off"
                label={t('register.email')}
                hint={isProfessional(draft.role) ? undefined : `(${t('common.optional').toLowerCase()})`}
                placeholder={t('login.email.placeholder')}
                icon={<AtIcon size={20} />}
                help={emailHelp}
                value={draft.email}
                onChange={(e) => patch({ email: e.target.value })}
                error={detailErrors.email ? t(detailErrors.email) : undefined}
                required={isProfessional(draft.role)}
              />
              <SelectField
                id="register-commune"
                label={t('register.commune')}
                icon={<MapPinIcon size={20} />}
                placeholder={t('register.commune.placeholder')}
                options={KINSHASA_COMMUNES}
                value={draft.commune}
                onChange={(e) => patch({ commune: e.target.value as RegisterDraft['commune'] })}
                error={detailErrors.commune ? t(detailErrors.commune) : undefined}
                autoComplete="address-level2"
                required
              />
              <TextField
                id="register-address"
                label={t('register.address')}
                hint={`(${t('common.optional').toLowerCase()})`}
                placeholder={t('register.address.placeholder')}
                icon={<HomeIcon size={20} />}
                autoComplete="street-address"
                value={draft.address}
                onChange={(e) => patch({ address: e.target.value })}
              />
              <Suspense fallback={<div aria-hidden="true" style={{ minHeight: 170 }} />}>
                <DocumentUpload
                  file={idFile}
                  onChange={(file) => {
                    setIdFile(file);
                    patch({ document: file ? { name: file.name, size: file.size, type: file.type } : null });
                    setDetailErrors((errors) => ({ ...errors, document: undefined }));
                  }}
                  label={t('register.idDoc')}
                  hint={isProfessional(draft.role) ? undefined : `(${t('common.optional').toLowerCase()})`}
                  help={t('register.idDoc.help')}
                  error={detailErrors.document ? t(detailErrors.document) : undefined}
                  stale={draft.document}
                />
              </Suspense>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="auth-form" style={{ gap: 12 }}>
                <PasswordInput
                  id="register-password"
                  label={t('register.password')}
                  placeholder={t('register.password.placeholder')}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={securityErrors.password ? t(securityErrors.password) : undefined}
                  aria-describedby="password-strength"
                  autoFocus
                  required
                />
                <Suspense fallback={<div aria-hidden="true" style={{ minHeight: 96 }} />}>
                  <PasswordStrengthMeter password={password} />
                </Suspense>
              </div>
              <PasswordInput
                id="register-confirm"
                label={t('register.confirm')}
                placeholder={t('register.confirm.placeholder')}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={securityErrors.confirm ? t(securityErrors.confirm) : undefined}
                success={confirm && confirm === password ? t('register.confirm.match') : undefined}
                required
              />
              <TextField
                id="register-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                label={t('register.pin')}
                hint={`(${t('common.optional').toLowerCase()})`}
                placeholder="••••"
                icon={<KeyIcon size={20} />}
                help={t('register.pin.help')}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                error={securityErrors.pin ? t(securityErrors.pin) : undefined}
                mono
              />
              <div className="grid gap-4 pt-1">
                <Checkbox
                  id="register-acceptTerms"
                  checked={draft.acceptTerms}
                  onChange={(e) => {
                    patch({ acceptTerms: e.target.checked });
                    if (e.target.checked) setSecurityErrors((errors) => ({ ...errors, acceptTerms: undefined }));
                  }}
                  error={securityErrors.acceptTerms ? t(securityErrors.acceptTerms) : undefined}
                  required
                  label={
                    <>
                      {t('register.terms.prefix')}
                      <Link to="/conditions" className="auth-link" target="_blank" rel="noreferrer">
                        {t('common.terms')}
                      </Link>
                      {t('register.terms.and')}
                      <Link to="/confidentialite" className="auth-link" target="_blank" rel="noreferrer">
                        {t('common.privacy')}
                      </Link>
                    </>
                  }
                />
                <Checkbox
                  id="register-notifications"
                  checked={draft.notifications}
                  onChange={(e) => patch({ notifications: e.target.checked })}
                  label={t('register.notifications')}
                />
              </div>
            </>
          ) : null}

          {formError ? <Alert>{formError}</Alert> : null}

          <div className={cn('auth-actions', step === 1 && 'mt-2')}>
            {step > 1 ? (
              <AuthButton variant="outline" onClick={() => goTo((step - 1) as Step, -1)} icon={<ArrowLeftIcon size={18} />} aria-label={t('common.back')}>
                <span className="hidden sm:inline">{t('common.back')}</span>
              </AuthButton>
            ) : null}
            <AuthButton
              type="submit"
              loading={submitting}
              loadingLabel={t('register.submitting')}
              disabled={step === 3 && smsLock.locked}
              icon={<ArrowRightIcon size={18} />}
              iconPosition="right"
              arrow
            >
              {step === 3 ? t('register.submit') : t('common.continue')}
            </AuthButton>
          </div>
        </form>

        <p className="auth-muted mt-8 text-center">
          {t('register.hasAccount')}{' '}
          <Link to={ROUTES.LOGIN} className="auth-link">
            {t('register.login')}
          </Link>
        </p>

        <TrustFooter />
      </AuthCard>
    </AuthLayout>
  );
}
