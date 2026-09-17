import * as z from 'zod/v4-mini';
import type { MessageKey } from '@/i18n';

const key = (k: MessageKey) => ({ error: k });

/** Step 1 — profile selection. Ships with the eager step-1 chunk. */
export const registerProfileSchema = z.object({
  role: z.enum(['locataire', 'bailleur', 'agence'], key('register.role.error')),
});
