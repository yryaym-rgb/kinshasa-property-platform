import type { ReactNode } from 'react';

interface SuccessMarkProps {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}

/** Animated stroke-drawn checkmark used by the success states of every auth flow. */
export function SuccessMark({ title, description, children }: SuccessMarkProps) {
  return (
    <div className="auth-success auth-enter" role="status" aria-live="polite">
      <svg className="auth-success__ring" viewBox="0 0 88 88" fill="none" aria-hidden="true">
        <circle cx="44" cy="44" r="40" fill="rgba(22,163,74,0.08)" />
        <circle className="auth-success__circle" cx="44" cy="44" r="40" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
        <path
          className="auth-success__check"
          d="M27 45.5 39 57l22-25"
          stroke="#16a34a"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <h1 className="auth-title auth-title--md mt-6">{title}</h1>
      {description ? <p className="auth-subtitle mx-auto max-w-[360px]">{description}</p> : null}
      {children}
    </div>
  );
}
