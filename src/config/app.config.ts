/**
 * Application-wide configuration for eLoyer Kinshasa
 */
export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME ?? 'eLoyer Kinshasa',
  env: import.meta.env.VITE_APP_ENV ?? 'development',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  tagline: 'Chaque logement enregistré, chaque loyer tracé, chaque paiement sécurisé, chaque recette mobilisée.',
  timezone: 'Africa/Kinshasa',
  locale: 'fr-CD',
  defaultLanguage: 'fr' as const,
  supportedLanguages: ['fr', 'en'] as const,
} as const;

/** 24 communes of Kinshasa */
export const KINSHASA_COMMUNES = [
  'Gombe',
  'Lingwala',
  'Kinshasa',
  'Kalamu',
  'Bandalungwa',
  'Barumbu',
  'Lemba',
  'Limete',
  'Matete',
  'Ngiri-Ngiri',
  'Makala',
  'Selembao',
  'Bumbu',
  'Mont-Ngafula',
  'Ndjili',
  'Kimbanseke',
  'Kisenso',
  'Masina',
  'Nsele',
  'Maluku',
  'Ngaliema',
  'Kintambo',
  'Kasa-Vubu',
  'Mont-Amba',
] as const;

export const PROPERTY_TYPES = [
  'Appartement',
  'Studio',
  'Villa',
  'Bureau',
  'Magasin',
  'Entrepôt',
] as const;

export const PAYMENT_PROVIDERS = [
  'Orange Money',
  'M-Pesa',
  'Airtel Money',
  'Bank',
  'Cash',
] as const;

export const CURRENCIES = {
  primary: { code: 'CDF', symbol: 'FC', name: 'Franc congolais' },
  secondary: { code: 'USD', symbol: '$', name: 'Dollar américain' },
} as const;

export const TAX_CONFIG = {
  defaultRate: 0.12,
  minimumTaxableAmount: 50000,
  gracePeriodDays: 15,
  latePenaltyRate: 0.05,
  complianceThresholds: {
    excellent: 90,
    good: 75,
    warning: 50,
    critical: 25,
  },
} as const;

export const BRAND_COLORS = {
  gold: '#d4a843',
  blue: '#1e40af',
  blueLight: '#3b82f6',
  white: '#ffffff',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  neutral: '#64748b',
} as const;

export const MOBILE_MONEY_PROVIDERS = (
  import.meta.env.VITE_MOBILE_MONEY_PROVIDERS ?? 'Orange Money,M-Pesa,Airtel Money'
)
  .split(',')
  .map((p: string) => p.trim())
  .filter(Boolean);

export const OTP_CONFIG = {
  length: 6,
  resendDelaySeconds: 45,
  expirySeconds: 300,
  maxVerifyAttempts: 3,
} as const;

export const AUTH_CONFIG = {
  /** Minutes of inactivity before a non-remembered session is signed out. */
  inactivityTimeoutMinutes: 30,
  /** Support line shown on the OTP page. */
  supportPhone: '+243 81 000 0000',
  /** Supabase Storage bucket receiving identity documents at sign-up. */
  kycBucket: 'kyc-documents',
  maxDocumentBytes: 5 * 1024 * 1024,
  acceptedDocumentTypes: ['image/jpeg', 'image/png', 'application/pdf'],
} as const;

export const PAGINATION = {
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
} as const;

export type KinshasaCommune = (typeof KINSHASA_COMMUNES)[number];
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
