import { useId, type KeyboardEvent } from 'react';
import { useT, type MessageKey } from '@/i18n';
import type { RegisterRole } from '@/lib/authStorage';
import { BuildingIcon, HomeIcon, UserIcon } from '@/components/landing/icons';

interface Option {
  role: RegisterRole;
  title: MessageKey;
  description: MessageKey;
  Icon: typeof UserIcon;
  bg: string;
  fg: string;
}

// One card per flag colour: blue, yellow, red.
const OPTIONS: readonly Option[] = [
  { role: 'locataire', title: 'register.role.locataire', description: 'register.role.locataire.desc', Icon: UserIcon, bg: 'rgba(0,159,227,0.12)', fg: '#0077b6' },
  { role: 'bailleur', title: 'register.role.bailleur', description: 'register.role.bailleur.desc', Icon: HomeIcon, bg: 'rgba(255,221,0,0.22)', fg: '#0a1628' },
  { role: 'agence', title: 'register.role.agence', description: 'register.role.agence.desc', Icon: BuildingIcon, bg: 'rgba(239,62,66,0.12)', fg: '#d9262b' },
];

interface ProfileSelectorProps {
  value: RegisterRole | null;
  onChange: (role: RegisterRole) => void;
  error?: string;
  labelledBy?: string;
}

/** Three large radio cards (Locataire / Bailleur / Agence) with roving keyboard focus. */
export function ProfileSelector({ value, onChange, error, labelledBy }: ProfileSelectorProps) {
  const t = useT();
  const errorId = useId();
  const selectedIndex = OPTIONS.findIndex((o) => o.role === value);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number) => {
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = OPTIONS[(index + delta + OPTIONS.length) % OPTIONS.length]!;
    onChange(next.role);
    (e.currentTarget.parentElement?.children[OPTIONS.indexOf(next)] as HTMLElement | undefined)?.focus();
  };

  return (
    <div>
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className="auth-choices"
      >
        {OPTIONS.map((option, index) => {
          const checked = option.role === value;
          const tabbable = checked || (selectedIndex === -1 && index === 0);
          return (
            <div
              key={option.role}
              role="radio"
              aria-checked={checked}
              tabIndex={tabbable ? 0 : -1}
              className="auth-choice"
              style={{ '--choice-bg': option.bg, '--choice-fg': option.fg } as React.CSSProperties}
              onClick={() => onChange(option.role)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onChange(option.role);
                } else {
                  onKeyDown(e, index);
                }
              }}
            >
              <span className="auth-choice__radio" aria-hidden="true" />
              <span className="auth-choice__icon" aria-hidden="true">
                <option.Icon size={26} />
              </span>
              <span className="min-w-0">
                <p className="auth-choice__title">{t(option.title)}</p>
                <p className="auth-choice__desc">{t(option.description)}</p>
              </span>
            </div>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="auth-error mt-3" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
