-- =============================================================================
-- eLoyer Kinshasa — Module 5: Configurable tax rules engine
-- Migration: 009_tax_rules_engine.sql
--
-- Evolves the Phase-1 `regles_fiscales` table into the configurable rules
-- engine consumed by supabase/functions/_shared/tax/. New rules are added by
-- INSERTing rows — no code change required (see docs/TAX_ENGINE.md).
--
-- IMPORTANT — rate semantics: `taux` is stored as a FRACTION (0.10 = 10 %),
-- consistent with `impots.taux` and its CHECK (taux <= 1). API responses
-- expose the human-friendly percentage as `tauxApplique`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Tax status: refunds cancel the obligation (never delete the row)
--    NB: the new value is not referenced elsewhere in this file (Postgres
--    forbids using a freshly added enum value in the same transaction).
-- -----------------------------------------------------------------------------

ALTER TYPE public.tax_status ADD VALUE IF NOT EXISTS 'annule';

-- -----------------------------------------------------------------------------
-- 1. Rename legacy columns to the engine vocabulary (French, matches spec)
-- -----------------------------------------------------------------------------

ALTER TABLE public.regles_fiscales RENAME COLUMN name           TO nom;
ALTER TABLE public.regles_fiscales RENAME COLUMN min_amount     TO tranche_min;
ALTER TABLE public.regles_fiscales RENAME COLUMN max_amount     TO tranche_max;
ALTER TABLE public.regles_fiscales RENAME COLUMN active         TO is_active;
ALTER TABLE public.regles_fiscales RENAME COLUMN effective_from TO date_debut;
ALTER TABLE public.regles_fiscales RENAME COLUMN effective_to   TO date_fin;

-- -----------------------------------------------------------------------------
-- 2. Applicability arrays (a rule may target several communes / types)
-- -----------------------------------------------------------------------------

DROP INDEX IF EXISTS public.idx_regles_fiscales_commune;
DROP INDEX IF EXISTS public.idx_regles_fiscales_property_type;

-- commune: text → text[] (single value becomes a one-element array)
ALTER TABLE public.regles_fiscales
  ALTER COLUMN commune TYPE text[]
  USING CASE WHEN commune IS NULL THEN NULL ELSE ARRAY[commune] END;

ALTER TABLE public.regles_fiscales
  ADD COLUMN IF NOT EXISTS type_logement text[];

UPDATE public.regles_fiscales
SET type_logement = ARRAY[property_type::text]
WHERE property_type IS NOT NULL AND type_logement IS NULL;

ALTER TABLE public.regles_fiscales DROP COLUMN IF EXISTS property_type;

ALTER TABLE public.regles_fiscales
  ADD COLUMN IF NOT EXISTS type_contribuable text[];   -- e.g. {'personne_physique','personne_morale'} — NULL = all

-- -----------------------------------------------------------------------------
-- 3. Rate model, exemptions, priority, legal references
-- -----------------------------------------------------------------------------

ALTER TABLE public.regles_fiscales
  ADD COLUMN IF NOT EXISTS type_taux         varchar(20) NOT NULL DEFAULT 'pourcentage',  -- 'pourcentage' | 'fixe'
  ADD COLUMN IF NOT EXISTS montant_fixe      numeric(12, 2),
  ADD COLUMN IF NOT EXISTS mode_application  varchar(20) NOT NULL DEFAULT 'exclusif',     -- 'exclusif' | 'cumulatif'
  ADD COLUMN IF NOT EXISTS exonere           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motif_exoneration text,
  ADD COLUMN IF NOT EXISTS priorite          integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS reference_legale  text,
  ADD COLUMN IF NOT EXISTS article_loi       text,
  ADD COLUMN IF NOT EXISTS version           integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_by        uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validated_by      text,       -- name/role of the legal validator, NULL = placeholder
  ADD COLUMN IF NOT EXISTS validated_at      date;

ALTER TABLE public.regles_fiscales DROP CONSTRAINT IF EXISTS regles_fiscales_type_taux_valid;
ALTER TABLE public.regles_fiscales
  ADD CONSTRAINT regles_fiscales_type_taux_valid CHECK (type_taux IN ('pourcentage', 'fixe'));

ALTER TABLE public.regles_fiscales DROP CONSTRAINT IF EXISTS regles_fiscales_mode_valid;
ALTER TABLE public.regles_fiscales
  ADD CONSTRAINT regles_fiscales_mode_valid CHECK (mode_application IN ('exclusif', 'cumulatif'));

ALTER TABLE public.regles_fiscales DROP CONSTRAINT IF EXISTS regles_fiscales_fixe_requires_amount;
ALTER TABLE public.regles_fiscales
  ADD CONSTRAINT regles_fiscales_fixe_requires_amount
  CHECK (type_taux <> 'fixe' OR montant_fixe IS NOT NULL);

-- Every rule must cite its legal basis — the system never invents tax law.
UPDATE public.regles_fiscales
SET reference_legale = 'Règle héritée Phase 1 — référence légale à compléter (à valider par la DGI)'
WHERE reference_legale IS NULL;

ALTER TABLE public.regles_fiscales ALTER COLUMN reference_legale SET NOT NULL;

-- Legacy "exemption" rule expressed as taux 0 → flag it explicitly.
UPDATE public.regles_fiscales
SET exonere = true,
    motif_exoneration = coalesce(motif_exoneration, 'Loyer inférieur au seuil minimum imposable'),
    priorite = 10
WHERE taux = 0 AND exonere = false;

CREATE INDEX IF NOT EXISTS idx_regles_fiscales_commune_gin       ON public.regles_fiscales USING gin (commune);
CREATE INDEX IF NOT EXISTS idx_regles_fiscales_type_logement_gin ON public.regles_fiscales USING gin (type_logement);
CREATE INDEX IF NOT EXISTS idx_regles_fiscales_priorite          ON public.regles_fiscales (priorite) WHERE is_active = true;

COMMENT ON TABLE  public.regles_fiscales IS 'Configurable tax rules. Add a row to add a rule — no code change. taux is a FRACTION (0.10 = 10 %).';
COMMENT ON COLUMN public.regles_fiscales.taux IS 'Fraction (0–1). 0.10 = 10 %. Ignored when type_taux = fixe or exonere = true.';
COMMENT ON COLUMN public.regles_fiscales.priorite IS 'Lower number = evaluated first. Ties broken by specificity (commune + type + tranche) then date_debut DESC.';
COMMENT ON COLUMN public.regles_fiscales.mode_application IS 'exclusif: the winning rule sets the base rate. cumulatif: surcharge added on top of the exclusive rule.';
COMMENT ON COLUMN public.regles_fiscales.type_logement IS 'Property types targeted (values of property_type enum). NULL = all.';
COMMENT ON COLUMN public.regles_fiscales.commune IS 'Communes targeted. NULL = all 24 communes.';
COMMENT ON COLUMN public.regles_fiscales.reference_legale IS 'Mandatory legal citation (Code des impôts, ordonnance, arrêté…).';

-- -----------------------------------------------------------------------------
-- 4. calculs_fiscaux — every calculation is logged for audit
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calculs_fiscaux (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_id         uuid REFERENCES public.paiements (id) ON DELETE SET NULL,
  bailleur_id         uuid REFERENCES public.bailleurs (id) ON DELETE SET NULL,
  contrat_id          uuid REFERENCES public.contrats (id) ON DELETE SET NULL,
  impot_id            uuid,                                   -- FK added below once impots gets its columns
  type_calcul         varchar(20) NOT NULL DEFAULT 'paiement', -- 'paiement' | 'simulation' | 'recalcul'
  regles_appliquees   uuid[] NOT NULL DEFAULT '{}',
  base_imposable      numeric(12, 2) NOT NULL,
  montant_impot       numeric(12, 2) NOT NULL,
  taux_effectif       numeric(6, 4),
  exonere             boolean NOT NULL DEFAULT false,
  input               jsonb,                                  -- TaxCalculationInput snapshot
  detail_calcul       jsonb,                                  -- CalculationDetail[] steps
  reference_legale    text,
  calculation_version varchar(20) NOT NULL DEFAULT '1.0.0',
  notes               text,                                   -- e.g. cancellation after refund
  created_by          uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT calculs_fiscaux_type_valid CHECK (type_calcul IN ('paiement', 'simulation', 'recalcul'))
);

CREATE INDEX IF NOT EXISTS idx_calculs_fiscaux_paiement ON public.calculs_fiscaux (paiement_id);
CREATE INDEX IF NOT EXISTS idx_calculs_fiscaux_bailleur ON public.calculs_fiscaux (bailleur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calculs_fiscaux_type     ON public.calculs_fiscaux (type_calcul, created_at DESC);

ALTER TABLE public.calculs_fiscaux ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calculs_fiscaux_select_owner_or_fiscal ON public.calculs_fiscaux;
CREATE POLICY calculs_fiscaux_select_owner_or_fiscal
  ON public.calculs_fiscaux
  FOR SELECT
  TO authenticated
  USING (
    (bailleur_id IS NOT NULL AND public.user_owns_bailleur(bailleur_id))
    OR (created_by = auth.uid())
    OR public.is_agent_fiscal()
    OR public.is_admin()
  );

REVOKE INSERT, UPDATE, DELETE ON public.calculs_fiscaux FROM authenticated;

COMMENT ON TABLE public.calculs_fiscaux IS 'Immutable audit log of every tax calculation (payment, simulation, recalculation) with the rules that fired.';

-- -----------------------------------------------------------------------------
-- 5. impots — link to calculation, denormalise for DGI aggregates
-- -----------------------------------------------------------------------------

ALTER TABLE public.impots
  ADD COLUMN IF NOT EXISTS bailleur_id        uuid REFERENCES public.bailleurs (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS calcul_fiscal_id   uuid REFERENCES public.calculs_fiscaux (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS base_imposable     numeric(14, 2),
  ADD COLUMN IF NOT EXISTS commune            text,
  ADD COLUMN IF NOT EXISTS type_logement      text,
  ADD COLUMN IF NOT EXISTS reference_legale   text,
  ADD COLUMN IF NOT EXISTS detail_calcul      jsonb,
  ADD COLUMN IF NOT EXISTS date_echeance      date,
  ADD COLUMN IF NOT EXISTS regles_appliquees  uuid[],
  ADD COLUMN IF NOT EXISTS recalcule_at       timestamptz,
  ADD COLUMN IF NOT EXISTS montant_precedent  numeric(14, 2);

ALTER TABLE public.calculs_fiscaux
  DROP CONSTRAINT IF EXISTS calculs_fiscaux_impot_id_fkey;
ALTER TABLE public.calculs_fiscaux
  ADD CONSTRAINT calculs_fiscaux_impot_id_fkey
  FOREIGN KEY (impot_id) REFERENCES public.impots (id) ON DELETE SET NULL;

-- Backfill denormalised fields for existing tax records.
UPDATE public.impots i
SET bailleur_id   = c.bailleur_id,
    commune       = l.commune,
    type_logement = l.type::text
FROM public.contrats c
JOIN public.logements l ON l.id = c.logement_id
WHERE c.id = i.contrat_id AND i.bailleur_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_impots_bailleur   ON public.impots (bailleur_id, periode);
CREATE INDEX IF NOT EXISTS idx_impots_commune    ON public.impots (commune);
CREATE INDEX IF NOT EXISTS idx_impots_echeance   ON public.impots (date_echeance) WHERE status IN ('calcule', 'declare', 'en_retard');
CREATE UNIQUE INDEX IF NOT EXISTS uq_impots_paiement ON public.impots (paiement_id) WHERE paiement_id IS NOT NULL;

COMMENT ON COLUMN public.impots.date_echeance IS 'Legal deadline for remitting this tax to the DGI (default: 15th of the month following the period).';

-- Service role (Edge Functions) needs to write impots; RLS already restricts authenticated writes to fiscal/admin.

-- -----------------------------------------------------------------------------
-- 6. Rule matching in SQL (used by RPC + kept in sync with the TS engine)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.regle_fiscale_applicable(
  r public.regles_fiscales,
  p_type_logement text,
  p_commune text,
  p_montant numeric,
  p_type_contribuable text,
  p_date date
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT r.is_active
    AND r.date_debut <= p_date
    AND (r.date_fin IS NULL OR r.date_fin >= p_date)
    AND (r.type_logement IS NULL OR cardinality(r.type_logement) = 0 OR p_type_logement = ANY (r.type_logement))
    AND (r.commune IS NULL OR cardinality(r.commune) = 0 OR p_commune = ANY (r.commune))
    AND (r.type_contribuable IS NULL OR cardinality(r.type_contribuable) = 0 OR p_type_contribuable = ANY (r.type_contribuable))
    AND (r.tranche_min IS NULL OR p_montant >= r.tranche_min)
    AND (r.tranche_max IS NULL OR p_montant <= r.tranche_max);
$$;

-- Specificity score: more targeted rules win ties at equal priority.
CREATE OR REPLACE FUNCTION public.regle_fiscale_specificite(r public.regles_fiscales)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (CASE WHEN r.commune IS NOT NULL AND cardinality(r.commune) > 0 THEN 4 ELSE 0 END)
       + (CASE WHEN r.type_logement IS NOT NULL AND cardinality(r.type_logement) > 0 THEN 2 ELSE 0 END)
       + (CASE WHEN r.tranche_min IS NOT NULL OR r.tranche_max IS NOT NULL THEN 1 ELSE 0 END)
       + (CASE WHEN r.type_contribuable IS NOT NULL AND cardinality(r.type_contribuable) > 0 THEN 1 ELSE 0 END);
$$;

-- Rewritten for the new schema (was defined in 003 against the legacy columns).
-- Mirrors the TypeScript engine: exemption wins if it has priority ≤ best rate
-- rule; otherwise the best exclusive rule sets the rate and every applicable
-- cumulative rule is added on top.
CREATE OR REPLACE FUNCTION public.calculate_tax_for_payment(payment_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment   record;
  v_logement  record;
  v_rule      public.regles_fiscales;
  v_exempt    public.regles_fiscales;
  v_base      numeric;
  v_tax       numeric := 0;
  v_date      date;
BEGIN
  SELECT p.*, c.logement_id, c.bailleur_id
  INTO v_payment
  FROM public.paiements p
  JOIN public.contrats c ON c.id = p.contrat_id
  WHERE p.id = payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', payment_id;
  END IF;

  SELECT * INTO v_logement FROM public.logements WHERE id = v_payment.logement_id;

  v_base := v_payment.montant;
  v_date := coalesce(v_payment.paid_at::date, CURRENT_DATE);

  SELECT r.* INTO v_exempt
  FROM public.regles_fiscales r
  WHERE r.exonere
    AND public.regle_fiscale_applicable(r, v_logement.type::text, v_logement.commune, v_base, NULL, v_date)
  ORDER BY r.priorite ASC, public.regle_fiscale_specificite(r) DESC, r.date_debut DESC
  LIMIT 1;

  SELECT r.* INTO v_rule
  FROM public.regles_fiscales r
  WHERE NOT r.exonere AND r.mode_application = 'exclusif'
    AND public.regle_fiscale_applicable(r, v_logement.type::text, v_logement.commune, v_base, NULL, v_date)
  ORDER BY r.priorite ASC, public.regle_fiscale_specificite(r) DESC, r.date_debut DESC
  LIMIT 1;

  IF v_exempt.id IS NOT NULL AND (v_rule.id IS NULL OR v_exempt.priorite <= v_rule.priorite) THEN
    RETURN 0;
  END IF;

  IF v_rule.id IS NOT NULL THEN
    v_tax := CASE v_rule.type_taux
      WHEN 'fixe' THEN coalesce(v_rule.montant_fixe, 0)
      ELSE round(v_base * v_rule.taux, 2)
    END;
  END IF;

  SELECT coalesce(sum(
           CASE r.type_taux WHEN 'fixe' THEN coalesce(r.montant_fixe, 0) ELSE round(v_base * r.taux, 2) END
         ), 0) + v_tax
  INTO v_tax
  FROM public.regles_fiscales r
  WHERE NOT r.exonere AND r.mode_application = 'cumulatif'
    AND public.regle_fiscale_applicable(r, v_logement.type::text, v_logement.commune, v_base, NULL, v_date);

  RETURN round(v_tax, 2);
END;
$$;

-- Rules applicable to a hypothetical input — powers the frontend simulator
-- read path and lets the DGI test a new rule before activating it.
CREATE OR REPLACE FUNCTION public.regles_fiscales_applicables(
  p_type_logement text,
  p_commune text,
  p_montant numeric,
  p_type_contribuable text DEFAULT NULL,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS SETOF public.regles_fiscales
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.*
  FROM public.regles_fiscales r
  WHERE public.regle_fiscale_applicable(r, p_type_logement, p_commune, p_montant, p_type_contribuable, p_date)
  ORDER BY r.priorite ASC, public.regle_fiscale_specificite(r) DESC, r.date_debut DESC;
$$;

GRANT EXECUTE ON FUNCTION public.regles_fiscales_applicables(text, text, numeric, text, date) TO authenticated;
