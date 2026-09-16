import {
  forwardRef,
  useCallback,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';
import { AlertCircleIcon, CheckIcon, ChevronDownIcon, InfoIcon } from '@/components/landing/icons';

/* ── Field wrapper ───────────────────────────────────────────── */

interface FieldChromeProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  help?: ReactNode;
  error?: string;
  success?: ReactNode;
  children: ReactNode;
  /** Visually hide the label (still announced). */
  hideLabel?: boolean;
}

export function FieldChrome({ id, label, hint, help, error, success, children, hideLabel }: FieldChromeProps) {
  return (
    <div className="auth-field">
      <label htmlFor={id} className={cn('auth-label', hideLabel && 'sr-only')}>
        {label}
        {hint ? <span className="auth-label__hint">{hint}</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="auth-error" role="alert">
          <AlertCircleIcon size={15} />
          {error}
        </p>
      ) : success ? (
        <p id={`${id}-help`} className="auth-success-text">
          <CheckIcon size={15} />
          {success}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="auth-help">
          <InfoIcon size={15} className="mt-px shrink-0" />
          <span>{help}</span>
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, error?: string, hasHelp?: boolean): string | undefined {
  if (error) return `${id}-error`;
  if (hasHelp) return `${id}-help`;
  return undefined;
}

/* ── Text field ──────────────────────────────────────────────── */

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label: ReactNode;
  hint?: ReactNode;
  help?: ReactNode;
  error?: string;
  success?: ReactNode;
  icon?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  hideLabel?: boolean;
  mono?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, help, error, success, icon, prefix, suffix, hideLabel, mono, id: idProp, className, disabled, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <FieldChrome id={id} label={label} hint={hint} help={help} error={error} success={success} hideLabel={hideLabel}>
      <div
        className={cn(
          'auth-control',
          error && 'auth-control--error',
          success && !error && 'auth-control--success',
          disabled && 'auth-control--disabled',
        )}
      >
        {icon ? (
          <span className="auth-control__icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {prefix ? <span className="auth-control__prefix">{prefix}</span> : null}
        <input
          ref={ref}
          id={id}
          className={cn('auth-input', mono && 'auth-input--mono', className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, Boolean(help || success))}
          disabled={disabled}
          {...rest}
        />
        {suffix ? <span className="auth-control__suffix">{suffix}</span> : null}
      </div>
    </FieldChrome>
  );
});

/* ── Select field ────────────────────────────────────────────── */

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode;
  hint?: ReactNode;
  help?: ReactNode;
  error?: string;
  icon?: ReactNode;
  placeholder?: string;
  options: readonly string[];
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, help, error, icon, placeholder, options, id: idProp, className, value, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const empty = value === '' || value === undefined;

  return (
    <FieldChrome id={id} label={label} hint={hint} help={help} error={error}>
      <div className={cn('auth-control', error && 'auth-control--error')}>
        {icon ? (
          <span className="auth-control__icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <select
          ref={ref}
          id={id}
          value={value}
          className={cn('auth-input auth-select', empty && 'auth-select--placeholder', className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, Boolean(help))}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="auth-control__suffix auth-control__suffix--static absolute right-0" aria-hidden="true">
          <ChevronDownIcon size={18} />
        </span>
      </div>
    </FieldChrome>
  );
});

/* ── Checkbox ────────────────────────────────────────────────── */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, error, id: idProp, className, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <div className="auth-field" style={{ gap: 6 }}>
      <label htmlFor={id} className={cn('auth-check', error && 'auth-check--error', className)}>
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
        />
        <span className="auth-check__box" aria-hidden="true">
          <CheckIcon size={14} />
        </span>
        <span className="auth-check__text">
          {label}
          {hint ? <span className="auth-check__hint">{hint}</span> : null}
        </span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="auth-error" role="alert">
          <AlertCircleIcon size={15} />
          {error}
        </p>
      ) : null}
    </div>
  );
});

/* ── Button ──────────────────────────────────────────────────── */

export interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  arrow?: boolean;
  auto?: boolean;
}

export function AuthButton({
  variant = 'primary',
  loading = false,
  loadingLabel,
  icon,
  iconPosition = 'left',
  arrow = false,
  auto = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: AuthButtonProps) {
  const iconNode = icon ? (
    <span className={cn('auth-btn__icon', arrow && 'auth-btn__icon--arrow')} aria-hidden="true">
      {icon}
    </span>
  ) : null;

  return (
    <button
      type={type}
      className={cn('auth-btn', `auth-btn--${variant}`, auto && 'auth-btn--auto', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <>
          <span className="auth-spinner" aria-hidden="true" />
          {loadingLabel ?? children}
        </>
      ) : (
        <>
          {iconPosition === 'left' ? iconNode : null}
          {children}
          {iconPosition === 'right' ? iconNode : null}
        </>
      )}
    </button>
  );
}

/* ── Tabs ────────────────────────────────────────────────────── */

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

interface TabsProps<T extends string> {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  idPrefix?: string;
}

export function Tabs<T extends string>({ tabs, value, onChange, label, idPrefix = 'auth-tab' }: TabsProps<T>) {
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === value));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -index : e.key === 'End' ? tabs.length - 1 - index : 0;
    if (!delta) return;
    e.preventDefault();
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    if (next) {
      onChange(next.id);
      document.getElementById(`${idPrefix}-${next.id}`)?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className="auth-tabs"
      style={{ '--tabs': tabs.length, '--tab': index } as React.CSSProperties}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            id={`${idPrefix}-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className="auth-tab"
            onClick={() => onChange(tab.id)}
          >
            {tab.icon ? (
              <span aria-hidden="true" className="inline-flex">
                {tab.icon}
              </span>
            ) : null}
            {tab.label}
          </button>
        );
      })}
      <span className="auth-tabs__indicator" aria-hidden="true" />
    </div>
  );
}

/* ── Alert ───────────────────────────────────────────────────── */

interface AlertProps {
  tone?: 'error' | 'info' | 'warn';
  children: ReactNode;
  id?: string;
  className?: string;
}

export function Alert({ tone = 'error', children, id, className }: AlertProps) {
  return (
    <div
      id={id}
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('auth-alert', tone !== 'error' && `auth-alert--${tone}`, className)}
    >
      {tone === 'error' ? <AlertCircleIcon size={18} /> : <InfoIcon size={18} />}
      <span>{children}</span>
    </div>
  );
}

/* ── Shake feedback ──────────────────────────────────────────── */

/** Returns props to spread on a container plus a trigger that replays the shake animation. */
export function useShake(): [{ className: string; onAnimationEnd: () => void }, () => void] {
  const [shaking, setShaking] = useState(false);
  const trigger = useCallback(() => {
    setShaking(false);
    // Two frames so the class removal is flushed before it is re-added.
    requestAnimationFrame(() => requestAnimationFrame(() => setShaking(true)));
  }, []);
  return [{ className: shaking ? 'auth-shake' : '', onAnimationEnd: () => setShaking(false) }, trigger];
}

/* ── Divider ─────────────────────────────────────────────────── */

export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="auth-divider" role="separator">
      {children}
    </div>
  );
}
