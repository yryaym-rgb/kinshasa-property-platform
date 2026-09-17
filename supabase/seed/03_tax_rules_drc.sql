-- =============================================================================
-- eLoyer Kinshasa — Seed 03: Initial tax rules (RDC)
--
-- ⚠️  These are PLACEHOLDERS. Real rates, thresholds and article numbers must
--     be validated by DGI legal counsel before production use. Every rule
--     carries a `reference_legale`; the engine refuses rules without one
--     (NOT NULL constraint) — the system never invents tax law.
--
-- Rate semantics: `taux` is a FRACTION (0.10 = 10 %). See docs/TAX_ENGINE.md.
-- Priority: lower `priorite` wins. Exemptions use priorite 10, base rates 100,
-- cumulative surcharges 200+.
-- =============================================================================

INSERT INTO public.regles_fiscales
  (nom, description, type_logement, commune, tranche_min, tranche_max, type_contribuable,
   taux, type_taux, montant_fixe, mode_application, exonere, motif_exoneration,
   date_debut, date_fin, is_active, priorite, reference_legale, article_loi)
SELECT * FROM (VALUES
  -- ── Exemptions (evaluated first) ─────────────────────────────────────────
  (
    'Exonération micro-loyer',
    'Loyers mensuels inférieurs au seuil minimum imposable (50 000 CDF) — aucun impôt dû.',
    NULL::text[], NULL::text[], 0.00::numeric, 49999.99::numeric, NULL::text[],
    0.0000::numeric, 'pourcentage', NULL::numeric, 'exclusif', true,
    'Loyer inférieur au seuil minimum imposable',
    '2024-01-01'::date, NULL::date, true, 10,
    'Code des impôts RDC — seuil d''exonération des revenus locatifs (article à valider par la DGI)',
    'Art. XXX (à valider)'
  ),

  -- ── Base rates (exclusive: the most specific applicable one wins) ────────
  (
    'Impôt sur revenus locatifs — résidentiel',
    'Taux standard sur les revenus locatifs des logements résidentiels (appartements, studios, villas).',
    ARRAY['Appartement', 'Studio', 'Villa']::text[], NULL::text[], 50000.00::numeric, NULL::numeric, NULL::text[],
    0.1000::numeric, 'pourcentage', NULL::numeric, 'exclusif', false, NULL,
    '2024-01-01'::date, NULL::date, true, 100,
    'Code des impôts RDC — Impôt sur les revenus locatifs (IRL), taux résidentiel (article à valider)',
    'Art. XXX (à valider)'
  ),
  (
    'Impôt sur revenus locatifs — commercial',
    'Taux sur les locaux à usage commercial ou professionnel (bureaux, magasins, entrepôts).',
    ARRAY['Bureau', 'Magasin', 'Entrepôt']::text[], NULL::text[], 50000.00::numeric, NULL::numeric, NULL::text[],
    0.1500::numeric, 'pourcentage', NULL::numeric, 'exclusif', false, NULL,
    '2024-01-01'::date, NULL::date, true, 100,
    'Code des impôts RDC — Impôt sur les revenus locatifs (IRL), taux locaux commerciaux (article à valider)',
    'Art. XXX (à valider)'
  ),
  (
    'Impôt sur revenus locatifs — taux par défaut',
    'Filet de sécurité : s''applique si aucune règle plus spécifique ne correspond (priorité basse).',
    NULL::text[], NULL::text[], 50000.00::numeric, NULL::numeric, NULL::text[],
    0.1000::numeric, 'pourcentage', NULL::numeric, 'exclusif', false, NULL,
    '2024-01-01'::date, NULL::date, true, 900,
    'Code des impôts RDC — Impôt sur les revenus locatifs, taux général (article à valider)',
    'Art. XXX (à valider)'
  ),

  -- ── Example of a cumulative communal surcharge (INACTIVE placeholder) ────
  -- Shows how a commune-level surtax would be layered on top of the base
  -- rate without touching any code. Activate only after legal validation.
  (
    'Surtaxe communale — Gombe (exemple, inactif)',
    'Exemple de taxe additionnelle communale de 1 % sur les loyers à Gombe. Placeholder inactif.',
    NULL::text[], ARRAY['Gombe']::text[], 50000.00::numeric, NULL::numeric, NULL::text[],
    0.0100::numeric, 'pourcentage', NULL::numeric, 'cumulatif', false, NULL,
    '2024-01-01'::date, NULL::date, false, 200,
    'Arrêté communal Gombe — taxe locative additionnelle (référence à confirmer, règle non validée)',
    NULL
  )
) AS seed
  (nom, description, type_logement, commune, tranche_min, tranche_max, type_contribuable,
   taux, type_taux, montant_fixe, mode_application, exonere, motif_exoneration,
   date_debut, date_fin, is_active, priorite, reference_legale, article_loi)
WHERE NOT EXISTS (SELECT 1 FROM public.regles_fiscales r WHERE r.nom = seed.nom);
