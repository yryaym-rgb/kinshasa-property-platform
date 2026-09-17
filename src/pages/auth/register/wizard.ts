import type { RegisterRole } from '@/lib/authStorage';

export type Step = 1 | 2 | 3;
export type DetailsField = 'fullName' | 'phone' | 'email' | 'commune' | 'address' | 'document';
export type SecurityField = 'password' | 'confirm' | 'pin' | 'acceptTerms';

/** Bailleurs and agencies must provide an e-mail and an identity document. */
export const isProfessional = (role: RegisterRole | null): boolean => role === 'bailleur' || role === 'agence';

/** Moves focus to the first invalid field of the current step. */
export function focusFirstError(errors: Record<string, unknown>): void {
  const first = Object.keys(errors).find((field) => errors[field]);
  if (first) document.getElementById(`register-${first}`)?.focus();
}
