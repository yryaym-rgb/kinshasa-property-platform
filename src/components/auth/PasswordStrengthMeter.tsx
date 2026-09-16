import { useMemo } from 'react';
import { useT, type MessageKey } from '@/i18n';
import { evaluatePassword, type PasswordChecks } from '@/lib/password';
import { cn } from '@/lib/cn';
import { CheckIcon } from '@/components/landing/icons';

const RULES: ReadonlyArray<{ key: keyof PasswordChecks; label: MessageKey }> = [
  { key: 'minLength', label: 'strength.rule.length' },
  { key: 'uppercase', label: 'strength.rule.upper' },
  { key: 'digit', label: 'strength.rule.digit' },
  { key: 'symbol', label: 'strength.rule.symbol' },
];

interface PasswordStrengthMeterProps {
  password: string;
  id?: string;
}

/** Live strength meter: three segments, a verdict announced to screen readers, and a rule checklist. */
export function PasswordStrengthMeter({ password, id = 'password-strength' }: PasswordStrengthMeterProps) {
  const t = useT();
  const evaluation = useMemo(() => evaluatePassword(password), [password]);
  const { strength, checks } = evaluation;

  const verdict =
    strength === 'weak'
      ? { label: t('strength.weak'), hint: t('strength.weak.hint') }
      : strength === 'medium'
        ? { label: t('strength.medium'), hint: t('strength.medium.hint') }
        : strength === 'strong'
          ? { label: t('strength.strong'), hint: t('strength.strong.hint') }
          : null;

  return (
    <div id={id} className={cn('auth-strength', strength !== 'empty' && `auth-strength--${strength}`)}>
      <div className="auth-strength__bars" aria-hidden="true">
        <span className="auth-strength__bar" />
        <span className="auth-strength__bar" />
        <span className="auth-strength__bar" />
      </div>
      <p className="auth-strength__label" aria-live="polite" aria-atomic="true">
        <span>
          {t('strength.label')} : <b>{verdict?.label ?? '—'}</b>
        </span>
        {verdict ? <span className="hidden sm:inline">{verdict.hint}</span> : null}
      </p>
      <ul className="auth-strength__rules">
        {RULES.map((rule) => {
          const ok = checks[rule.key];
          return (
            <li key={rule.key} className={cn('auth-strength__rule', ok && 'auth-strength__rule--ok')}>
              <i aria-hidden="true">
                <CheckIcon size={11} />
              </i>
              <span>
                <span className="sr-only">{ok ? '✓ ' : '○ '}</span>
                {t(rule.label)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
