/**
 * The 24 communes of Kinshasa. Kept out of `app.config.ts` (which sits in the
 * entry chunk) so the list is only downloaded by the screens that render it —
 * e.g. step 2 of the registration wizard, not step 1.
 */
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

export type KinshasaCommune = (typeof KINSHASA_COMMUNES)[number];
