-- =============================================================================
-- eLoyer Kinshasa — Seed: Initial Tax Rules (Placeholders)
-- Based on TAX_CONFIG: defaultRate 0.12, minimumTaxableAmount 50000
-- =============================================================================

INSERT INTO public.regles_fiscales (
  name,
  description,
  taux,
  commune,
  property_type,
  min_amount,
  max_amount,
  active,
  effective_from
)
SELECT
  name,
  description,
  taux,
  commune,
  property_type::public.property_type,
  min_amount,
  max_amount,
  active,
  effective_from::date
FROM (VALUES
  (
    'Taux national par défaut',
    'Taux d''imposition locative standard applicable à Kinshasa (12%)',
    0.1200,
    NULL,
    NULL,
    50000.00,
    NULL,
    true,
    '2024-01-01'
  ),
  (
    'Gombe — Appartements haut standing',
    'Taux majoré pour appartements dans la commune de Gombe',
    0.1400,
    'Gombe',
    'Appartement',
    200000.00,
    NULL,
    true,
    '2024-01-01'
  ),
  (
    'Gombe — Villas',
    'Taux pour villas dans la commune de Gombe',
    0.1500,
    'Gombe',
    'Villa',
    500000.00,
    NULL,
    true,
    '2024-01-01'
  ),
  (
    'Ngaliema — Résidentiel',
    'Taux résidentiel pour Ngaliema (appartements et studios)',
    0.1300,
    'Ngaliema',
    NULL,
    100000.00,
    1000000.00,
    true,
    '2024-01-01'
  ),
  (
    'Lemba — Logements populaires',
    'Taux réduit pour logements à loyer modéré à Lemba',
    0.1000,
    'Lemba',
    NULL,
    50000.00,
    300000.00,
    true,
    '2024-01-01'
  ),
  (
    'Masina — Studios',
    'Taux pour studios à Masina',
    0.1100,
    'Masina',
    'Studio',
    50000.00,
    200000.00,
    true,
    '2024-01-01'
  ),
  (
    'Commercial — Bureaux',
    'Taux pour locaux commerciaux de type bureau',
    0.1600,
    NULL,
    'Bureau',
    300000.00,
    NULL,
    true,
    '2024-01-01'
  ),
  (
    'Commercial — Magasins',
    'Taux pour locaux commerciaux de type magasin',
    0.1700,
    NULL,
    'Magasin',
    200000.00,
    NULL,
    true,
    '2024-01-01'
  ),
  (
    'Commercial — Entrepôts',
    'Taux pour entrepôts et locaux industriels',
    0.1300,
    NULL,
    'Entrepôt',
    500000.00,
    NULL,
    true,
    '2024-01-01'
  ),
  (
    'Exonération micro-loyer',
    'Exonération pour loyers inférieurs au seuil minimum (taux 0%)',
    0.0000,
    NULL,
    NULL,
    0.00,
    49999.99,
    true,
    '2024-01-01'
  )
) AS seed (
  name,
  description,
  taux,
  commune,
  property_type,
  min_amount,
  max_amount,
  active,
  effective_from
)
WHERE NOT EXISTS (SELECT 1 FROM public.regles_fiscales LIMIT 1);
