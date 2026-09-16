import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { CheckIcon } from '@/components/landing/icons';

interface AuthStepperProps {
  steps: readonly string[];
  /** 1-based index of the active step. */
  current: number;
}

/** Dots connected by lines; completed dots carry a checkmark, the active one is larger. */
export function AuthStepper({ steps, current }: AuthStepperProps) {
  const t = useT();

  return (
    <ol className="auth-stepper" aria-label={t('register.stepLabel', { current, total: steps.length })}>
      {steps.map((label, i) => {
        const index = i + 1;
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            className={cn('auth-stepper__item', done && 'auth-stepper__item--done', active && 'auth-stepper__item--active')}
            aria-current={active ? 'step' : undefined}
          >
            <span className="auth-stepper__dot" aria-hidden="true">
              {done ? <CheckIcon size={15} /> : index}
            </span>
            <span className="auth-stepper__label">
              <span className="sr-only">{t('register.stepLabel', { current: index, total: steps.length })} — </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
