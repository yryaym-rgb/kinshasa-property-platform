import { z } from 'zod';

export const PAYMENT_FREQUENCIES = ['mensuel', 'trimestriel', 'semestriel', 'annuel'] as const;
export const CONTRACT_DURATIONS = [6, 12, 24, 36] as const;

export const createContractSchema = z
  .object({
    logementId: z.string().uuid('Le logement est requis'),
    locataireId: z.string().uuid('Le locataire est requis'),
    dateDebut: z.string().min(1, 'La date de début est requise'),
    dateFin: z.string().optional(),
    dureeMois: z.coerce.number().min(1, 'La durée est requise'),
    loyerMensuel: z.coerce.number().min(1, 'Le loyer mensuel est requis'),
    chargesMensuelles: z.coerce.number().min(0).default(0),
    depotGarantie: z.coerce.number().min(0, 'Le dépôt de garantie doit être positif'),
    currency: z.enum(['CDF', 'USD']).default('CDF'),
    paymentDay: z.coerce.number().min(1).max(28, 'Le jour d\'échéance doit être entre 1 et 28'),
    paymentFrequency: z.enum(PAYMENT_FREQUENCIES).default('mensuel'),
    conditionsParticulieres: z
      .string()
      .max(2000, 'Maximum 2000 caractères')
      .optional(),
    addendums: z
      .array(
        z.object({
          name: z.string(),
          url: z.string(),
          path: z.string(),
        }),
      )
      .max(5, 'Maximum 5 fichiers')
      .optional(),
    certifie: z.boolean().refine((v) => v, {
      message: 'Vous devez certifier les informations',
    }),
  })
  .refine((data) => !data.dateFin || data.dateFin >= data.dateDebut, {
    message: 'La date de fin doit être après la date de début',
    path: ['dateFin'],
  });

const baseContractSchema = z.object({
  logementId: z.string().uuid('Le logement est requis'),
  locataireId: z.string().uuid('Le locataire est requis'),
  dateDebut: z.string().min(1, 'La date de début est requise'),
  dateFin: z.string().optional(),
  dureeMois: z.coerce.number().min(1, 'La durée est requise'),
  loyerMensuel: z.coerce.number().min(1, 'Le loyer mensuel est requis'),
  chargesMensuelles: z.coerce.number().min(0).default(0),
  depotGarantie: z.coerce.number().min(0, 'Le dépôt de garantie doit être positif'),
  currency: z.enum(['CDF', 'USD']).default('CDF'),
  paymentDay: z.coerce.number().min(1).max(28, 'Le jour d\'échéance doit être entre 1 et 28'),
  paymentFrequency: z.enum(PAYMENT_FREQUENCIES).default('mensuel'),
  conditionsParticulieres: z.string().max(2000, 'Maximum 2000 caractères').optional(),
  addendums: z
    .array(z.object({ name: z.string(), url: z.string(), path: z.string() }))
    .max(5, 'Maximum 5 fichiers')
    .optional(),
});

export const updateContractSchema = baseContractSchema.partial();

export const terminateContractSchema = z.object({
  reason: z.string().min(5, 'Veuillez indiquer une raison (minimum 5 caractères)'),
});

export const renewContractSchema = z.object({
  dateDebut: z.string().min(1, 'La date de début est requise'),
  dateFin: z.string().optional(),
  dureeMois: z.coerce.number().min(1),
  loyerMensuel: z.coerce.number().min(1),
  chargesMensuelles: z.coerce.number().min(0).default(0),
  depotGarantie: z.coerce.number().min(0),
  paymentDay: z.coerce.number().min(1).max(28),
  paymentFrequency: z.enum(PAYMENT_FREQUENCIES).default('mensuel'),
  conditionsParticulieres: z.string().max(2000).optional(),
});

export const newTenantSchema = z.object({
  phone: z.string().refine((v) => /^\+243[0-9]{9}$/.test(v), 'Numéro invalide'),
  fullName: z.string().min(2, 'Le nom complet est requis'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  address: z.string().optional(),
});

export type CreateContractFormData = z.infer<typeof createContractSchema>;
export type UpdateContractFormData = z.infer<typeof updateContractSchema>;
export type TerminateContractFormData = z.infer<typeof terminateContractSchema>;
export type RenewContractFormData = z.infer<typeof renewContractSchema>;
export type NewTenantFormData = z.infer<typeof newTenantSchema>;

export const WIZARD_STEPS = [
  { id: 1, label: 'Logement' },
  { id: 2, label: 'Locataire' },
  { id: 3, label: 'Termes' },
  { id: 4, label: 'Révision' },
  { id: 5, label: 'Signature' },
] as const;

export const DRAFT_STORAGE_KEY = 'contract-wizard-draft';
