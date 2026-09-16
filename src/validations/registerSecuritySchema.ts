import * as z from 'zod/v4-mini';
import type { MessageKey } from '@/i18n';
import { PASSWORD_MIN_LENGTH } from '@/lib/password';

const key = (k: MessageKey) => ({ error: k });

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
