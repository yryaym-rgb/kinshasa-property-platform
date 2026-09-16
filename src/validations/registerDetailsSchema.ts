import * as z from 'zod/v4-mini';
import type { MessageKey } from '@/i18n';
import { emailSchema, phoneDigitsSchema } from './authSchemas';

const key = (k: MessageKey) => ({ error: k });
const optionalEmail = z.union([z.literal(''), emailSchema], key('register.email.error'));

export const registerDetailsSchema = z.object({
  fullName: z.string().check(z.trim(), z.minLength(2, key('register.fullName.error'))),
  phone: phoneDigitsSchema,
  email: optionalEmail,
  commune: z.string().check(z.minLength(1, key('register.commune.error'))),
  address: z.string(),
});
