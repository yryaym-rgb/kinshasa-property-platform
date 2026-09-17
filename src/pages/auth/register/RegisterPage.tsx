import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLockout } from '@/hooks/useLockout';
import { useT, type MessageKey } from '@/i18n';
import { ROUTES, getDashboardPathForRole } from '@/config/routes';
import { EMPTY_DRAFT, loadRegisterDraft, saveRegisterDraft, type RegisterDraft } from '@/lib/authStorage';
import { cn } from '@/lib/cn';
import { whenIdle } from '@/lib/idle';
import { lazyRoute } from '@/lib/lazyRoute';
import { getSupabase } from '@/lib/lazySupabase';
import type { FieldErrors } from '@/validations/authSchemas';
import { AuthLayout, type AuthPanelProps } from '@/components/auth/AuthLayout';
import { AuthCard, AuthCardHeader } from '@/components/auth/AuthCard';
import { AuthStepper } from '@/components/auth/AuthStepper';
import { TrustFooter } from '@/components/auth/TrustFooter';
import { Alert, AuthButton, useShake } from '@/components/auth/primitives';
import { useAuthErrorMessage } from '@/components/auth/useAuthError';
import { authToast } from '@/components/auth/toast';
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/landing/icons';
import { Step1Profile, validateStep1 } from './steps/Step1Profile';
import { StepSkeleton } from './steps/StepSkeleton';
import { focusFirstError, type DetailsField, type SecurityField, type Step } from './wizard';

/*
 * Only step 1 ships in the initial chunk. Steps 2 and 3 (and their schemas,
 * the phone/commune/document widgets and the strength meter) are separate
 * chunks fetched while the citizen is still on the previous step, so they are
 * in memory by the time "Continuer" is pressed. `lazyRoute` renders
 * synchronously once preloaded, so the skeleton only shows on a cold, slow
 * network.
 */
const Step2Info = lazyRoute(() => import('./steps/Step2Info').then((m) => m.Step2Info));
const Step3Security = lazyRoute(() => import('./steps/Step3Security').then((m) => m.Step3Security));

const STEP_LOADERS: Record<Exclude<Step, 1>, () => Promise<void>> = {
  2: Step2Info.preload,
  3: Step3Security.preload,
};

/** Called by the route preloader so a restored draft on step 2/3 renders without a skeleton. */
export function preloadRegisterStep(): Promise<void> {
  const step = loadRegisterDraft()?.step ?? 1;
  return step === 1 ? Promise.resolve() : STEP_LOADERS[step]();
}

const AUTOSAVE_TOAST_MS = 20_000;
const STEP_TITLES: Record<Step, { title: MessageKey; sub: MessageKey }> = {
  1: { title: 'register.step1.title', sub: 'register.step1.sub' },
  2: { title: 'register.step2.title', sub: 'register.step2.sub' },
  3: { title: 'register.step3.title', sub: 'register.step3.sub' },
};

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

  /* ── Warm the next step while this one is idle ───────────────── */
  useEffect(() => {
    if (step === 1) return whenIdle(() => void Step2Info.preload());
    if (step === 2) return whenIdle(() => void Step3Security.preload());
    // Step 3 submits to Supabase: fetch the SDK now so the tap on "Créer mon compte" is instant.
    return whenIdle(() => void getSupabase().catch(() => undefined));
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

  /* ── Step validation (each step validates with its own schema) ─ */
  const runStep1 = () => {
    const ok = validateStep1(draft.role);
    setRoleError(ok ? undefined : t('register.role.error'));
    return ok;
  };

  const runStep2 = async () => {
    const { validateStep2 } = await import('./steps/Step2Info');
    const errors = validateStep2(draft, idFile);
    setDetailErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors);
      return false;
    }
    return true;
  };

  const runStep3 = async () => {
    const { validateStep3 } = await import('./steps/Step3Security');
    const errors = validateStep3({ password, confirm, pin, acceptTerms: draft.acceptTerms });
    setSecurityErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors);
      return false;
    }
    return true;
  };

  const handleContinue = async (e: FormEvent) => {
    e.preventDefault();
    const ok = step === 1 ? runStep1() : step === 2 ? await runStep2() : true;
    if (!ok) {
      shake();
      return;
    }
    if (step < 3) goTo((step + 1) as Step, 1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || smsLock.locked) return;
    if (!(await runStep3())) {
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

  return (
    <AuthLayout title={t('register.pageTitle')} variant="split" panel={panel} indexable>
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
            <Step1Profile
              value={draft.role}
              onChange={(role) => {
                patch({ role });
                setRoleError(undefined);
              }}
              error={roleError}
            />
          ) : (
            <Suspense fallback={<StepSkeleton step={step} />}>
              {step === 2 ? (
                <Step2Info
                  draft={draft}
                  patch={patch}
                  idFile={idFile}
                  onFileChange={(file) => {
                    setIdFile(file);
                    patch({ document: file ? { name: file.name, size: file.size, type: file.type } : null });
                    setDetailErrors((errors) => ({ ...errors, document: undefined }));
                  }}
                  errors={detailErrors}
                />
              ) : (
                <Step3Security
                  values={{ password, confirm, pin, acceptTerms: draft.acceptTerms }}
                  onPasswordChange={setPassword}
                  onConfirmChange={setConfirm}
                  onPinChange={setPin}
                  notifications={draft.notifications}
                  patch={patch}
                  errors={securityErrors}
                  onErrorsChange={setSecurityErrors}
                />
              )}
            </Suspense>
          )}

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
