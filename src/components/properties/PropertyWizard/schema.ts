import { z } from 'zod';
import { PROPERTY_TYPES } from '@/config/app.config';
import { KINSHASA_COMMUNES } from '@/config/communes';
import { PROPERTY_AMENITIES } from '@/utils/propertyUtils';

export const propertyWizardSchema = z.object({
  province: z.string().default('Kinshasa'),
  ville: z.string().default('Kinshasa'),
  commune: z.enum(KINSHASA_COMMUNES as unknown as [string, ...string[]], {
    required_error: 'La commune est requise',
  }),
  quartier: z.string().min(1, 'Le quartier est requis'),
  avenue: z.string().min(1, "L'avenue est requise"),
  numero: z.string().min(1, 'Le numéro est requis'),
  parcelle: z.string().optional(),
  immeuble: z.string().optional(),
  appartement: z.string().optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  type: z.enum(PROPERTY_TYPES as unknown as [string, ...string[]]),
  rooms: z.coerce.number().min(1, 'Nombre de pièces requis'),
  chambres: z.coerce.number().min(0).optional(),
  sallesDeBain: z.coerce.number().min(0).optional(),
  surfaceM2: z.coerce.number().min(1, 'Superficie requise'),
  etage: z.coerce.number().optional(),
  loyerMensuel: z.coerce.number().min(1, 'Le loyer est requis'),
  chargesMensuelles: z.coerce.number().min(0).default(0),
  depotGarantie: z.coerce.number().min(0).default(0),
  paymentDay: z.coerce.number().min(1).max(31).default(5),
  currency: z.enum(['CDF', 'USD']).default('CDF'),
  amenities: z.array(z.enum(PROPERTY_AMENITIES as unknown as [string, ...string[]])).default([]),
  photos: z.array(z.string()).max(10).default([]),
  description: z.string().max(1000, 'Maximum 1000 caractères').optional(),
});

export type PropertyWizardFormData = z.infer<typeof propertyWizardSchema>;

export const DRAFT_STORAGE_KEY = 'eloyer_property_wizard_draft';

export const WIZARD_STEPS = [
  { id: 1, label: 'Localisation' },
  { id: 2, label: 'Caractéristiques' },
  { id: 3, label: 'Loyer' },
  { id: 4, label: 'Équipements' },
  { id: 5, label: 'Photos' },
  { id: 6, label: 'Récapitulatif' },
] as const;
