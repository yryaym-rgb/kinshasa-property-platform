import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  helpText?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      label,
      error,
      helpText,
      prefix,
      suffix,
      required,
      id,
      type = 'text',
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? props.name;

    return (
      <div className={cn('space-y-1.5', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-foreground)]">
            {label}
            {required && <span className="ml-1 text-[var(--color-destructive)]" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 text-sm text-[var(--color-muted-foreground)]">{prefix}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            required={required}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined}
            className={cn(
              'flex h-10 w-full rounded-lg border bg-[var(--color-card)] px-3 py-2 text-sm',
              'border-[var(--color-input)] placeholder:text-[var(--color-muted-foreground)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              prefix && 'pl-12',
              suffix && 'pr-12',
              error && 'border-[var(--color-destructive)] focus:ring-[var(--color-destructive)]',
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 text-sm text-[var(--color-muted-foreground)]">{suffix}</span>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-[var(--color-destructive)]" role="alert">
            {error}
          </p>
        )}
        {helpText && !error && (
          <p id={`${inputId}-help`} className="text-sm text-[var(--color-muted-foreground)]">
            {helpText}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
