import * as z from 'zod/v4-mini';
import type { MessageKey } from '@/i18n';
import { PASSWORD_MIN_LENGTH } from '@/lib/password';

/**
 * Auth form schemas built on `zod/v4-mini` (tree-shakeable, ~3 KB gzipped
 * instead of the 12 KB classic API). Error messages are i18n keys resolved by
 * the page with `t()`.
 */

const key = (k: MessageKey) => ({ error: k });

export const phoneDigitsSchema = z.string().check(z.regex(/^[89]\d{8}$/, key('login.error.phone')));
export const emailSchema = z.string().check(z.trim(), z.email(key('login.error.email')));
const optionalEmail = z.union([z.literal(''), emailSchema], key('register.email.error'));

export const loginPhoneSchema = z.object({
  phone: phoneDigitsSchema,
  password: z.string().check(z.minLength(1, key('login.error.password'))),
});

export const loginEmailSchema = z.object({
  email: emailSchema,
  password: z.string().check(z.minLength(1, key('login.error.password'))),
});

export const registerProfileSchema = z.object({
  role: z.enum(['locataire', 'bailleur', 'agence'], key('register.role.error')),
});

export const registerDetailsSchema = z.object({
  fullName: z.string().check(z.trim(), z.minLength(2, key('register.fullName.error'))),
  phone: phoneDigitsSchema,
  email: optionalEmail,
  commune: z.string().check(z.minLength(1, key('register.commune.error'))),
  address: z.string(),
});

export const registerSecuritySchema = z
  .object({
    password: z.string().check(z.minLength(PASSWORD_MIN_LENGTH, key('register.password.error'))),
    confirm: z.string(),
    pin: z.union([z.literal(''), z.string().check(z.regex(/^\d{4,6}$/, key('register.pin.error')))], key('register.pin.error')),
    acceptTerms: z.literal(true, key('register.terms.error')),
  })
  .check(
    z.refine((data) => data.password === data.confirm, {
      error: 'register.confirm.mismatch' satisfies MessageKey,
      path: ['confirm'],
    }),
  );

export const newPasswordSchema = z
  .object({
    password: z.string().check(z.minLength(PASSWORD_MIN_LENGTH, key('register.password.error'))),
    confirm: z.string(),
  })
  .check(
    z.refine((data) => data.password === data.confirm, {
      error: 'register.confirm.mismatch' satisfies MessageKey,
      path: ['confirm'],
    }),
  );

export type FieldErrors<T extends string> = Partial<Record<T, MessageKey>>;

/** Runs a schema and returns the first error key per top-level field. */
export function validate<TSchema extends z.ZodMiniType, TField extends string = string>(
  schema: TSchema,
  data: unknown,
): { success: true; data: z.output<TSchema>; errors: FieldErrors<TField> } | { success: false; data: null; errors: FieldErrors<TField> } {
  const result = z.safeParse(schema, data);
  if (result.success) return { success: true, data: result.data, errors: {} };

  const errors: FieldErrors<TField> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? '') as TField;
    if (field && !errors[field]) errors[field] = issue.message as MessageKey;
  }
  return { success: false, data: null, errors };
}
