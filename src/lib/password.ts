export interface PasswordChecks {
  minLength: boolean;
  uppercase: boolean;
  digit: boolean;
  symbol: boolean;
}

export type PasswordStrength = 'empty' | 'weak' | 'medium' | 'strong';

export interface PasswordEvaluation {
  checks: PasswordChecks;
  strength: PasswordStrength;
  /** 0–3, number of filled segments in the meter. */
  score: 0 | 1 | 2 | 3;
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_STRONG_LENGTH = 12;

export function evaluatePassword(password: string): PasswordEvaluation {
  const checks: PasswordChecks = {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  if (password.length === 0) return { checks, strength: 'empty', score: 0 };
  if (!checks.minLength) return { checks, strength: 'weak', score: 1 };

  const complex = checks.uppercase && checks.digit && checks.symbol;
  if (complex && password.length >= PASSWORD_STRONG_LENGTH) return { checks, strength: 'strong', score: 3 };
  return { checks, strength: 'medium', score: 2 };
}
