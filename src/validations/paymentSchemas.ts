import { z } from 'zod';
import { isValidDRCPhone } from '@/lib/utils';

export const InitiatePaymentSchema = z.object({
  contratId: z.string().uuid('Contrat invalide'),
  amount: z.number().positive('Le montant doit être positif'),
  rentAmount: z.number().positive('Le loyer doit être positif'),
  method: z.enum(['orange_money', 'mpesa', 'airtel_money', 'card', 'bank_transfer'], {
    errorMap: () => ({ message: 'Méthode de paiement invalide' }),
  }),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || isValidDRCPhone(val), 'Numéro de téléphone invalide'),
  periode: z.string().regex(/^\d{4}-\d{2}$/, 'Période invalide (AAAA-MM)'),
  currency: z.enum(['CDF', 'USD']).default('CDF'),
});

export const ConfirmPaymentSchema = z.object({
  paymentId: z.string().uuid('Paiement invalide'),
  idempotencyKey: z.string().min(8, 'Clé d\'idempotence invalide'),
});

export const TenantProfileSchema = z.object({
  fullName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Adresse e-mail invalide').optional().or(z.literal('')),
  address: z.string().optional(),
  notifyEmail: z.boolean().default(true),
  notifySms: z.boolean().default(true),
  preferredLanguage: z.enum(['fr', 'en']).default('fr'),
});

export type InitiatePaymentForm = z.infer<typeof InitiatePaymentSchema>;
export type ConfirmPaymentForm = z.infer<typeof ConfirmPaymentSchema>;
export type TenantProfileForm = z.infer<typeof TenantProfileSchema>;
