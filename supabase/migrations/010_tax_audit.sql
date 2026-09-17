-- =============================================================================
-- eLoyer Kinshasa — Module 5: Tax audit, recalculation, anomalies, DGI analytics
-- Migration: 010_tax_audit.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Rule change history — legal auditability of the rules themselves
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.regles_fiscales_historique (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regle_id      uuid NOT NULL,
  operation     varchar(10) NOT NULL,   -- INSERT | UPDATE | DELETE
  ancienne      jsonb,
  nouvelle      jsonb,
  modifie_par   uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regles_historique_regle ON public.regles_fiscales_historique (regle_id, created_at DESC);

ALTER TABLE public.regles_fiscales_historique ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regles_historique_select_fiscal ON public.regles_fiscales_historique;
CREATE POLICY regles_historique_select_fiscal
  ON public.regles_fiscales_historique
  FOR SELECT
  TO authenticated
  USING (public.is_agent_fiscal() OR public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.regles_fiscales_historique FROM authenticated;

CREATE OR REPLACE FUNCTION public.log_regle_fiscale_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
  END IF;

  INSERT INTO public.regles_fiscales_historique (regle_id, operation, ancienne, nouvelle, modifie_par)
  VALUES (
    coalesce(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    auth.uid()
  );

  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_regles_fiscales_history ON public.regles_fiscales;
CREATE TRIGGER trg_regles_fiscales_history
  BEFORE INSERT OR UPDATE OR DELETE ON public.regles_fiscales
  FOR EACH ROW EXECUTE FUNCTION public.log_regle_fiscale_change();

-- -----------------------------------------------------------------------------
-- 2. Recalculation runs (admin, retroactive when rules change)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.recalculs_fiscaux (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lance_par       uuid REFERENCES public.users (id) ON DELETE SET NULL,
  motif           text NOT NULL,
  filtres         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {periode_from, periode_to, bailleur_id, commune, dry_run}
  dry_run         boolean NOT NULL DEFAULT true,
  status          varchar(20) NOT NULL DEFAULT 'running', -- running | done | failed
  nb_examines     integer NOT NULL DEFAULT 0,
  nb_modifies     integer NOT NULL DEFAULT 0,
  delta_total     numeric(14, 2) NOT NULL DEFAULT 0,
  rapport         jsonb,                                  -- [{impot_id, ancien, nouveau, delta, regles}]
  erreur          text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

ALTER TABLE public.recalculs_fiscaux ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recalculs_select_fiscal ON public.recalculs_fiscaux;
CREATE POLICY recalculs_select_fiscal
  ON public.recalculs_fiscaux
  FOR SELECT
  TO authenticated
  USING (public.is_agent_fiscal() OR public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.recalculs_fiscaux FROM authenticated;

-- -----------------------------------------------------------------------------
-- 3. Anomalies (DGI intelligence)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.anomalies_fiscales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            varchar(50) NOT NULL,
  severite        varchar(10) NOT NULL,                  -- low | medium | high | critical
  titre           text NOT NULL,
  description     text,
  bailleur_id     uuid REFERENCES public.bailleurs (id) ON DELETE CASCADE,
  logement_id     uuid REFERENCES public.logements (id) ON DELETE CASCADE,
  contrat_id      uuid REFERENCES public.contrats (id) ON DELETE CASCADE,
  paiement_id     uuid REFERENCES public.paiements (id) ON DELETE CASCADE,
  signaux         jsonb NOT NULL DEFAULT '{}'::jsonb,    -- evidence
  action_suggeree text,
  statut          varchar(20) NOT NULL DEFAULT 'detected', -- detected | reviewed | escalated | dismissed
  traite_par      uuid REFERENCES public.users (id) ON DELETE SET NULL,
  traite_at       timestamptz,
  commentaire     text,
  empreinte       text NOT NULL,                         -- dedupe key (type + entities)
  detected_at     timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT anomalies_severite_valid CHECK (severite IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT anomalies_statut_valid CHECK (statut IN ('detected', 'reviewed', 'escalated', 'dismissed')),
  CONSTRAINT anomalies_empreinte_unique UNIQUE (empreinte)
);

CREATE INDEX IF NOT EXISTS idx_anomalies_statut   ON public.anomalies_fiscales (statut, severite);
CREATE INDEX IF NOT EXISTS idx_anomalies_bailleur ON public.anomalies_fiscales (bailleur_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_type     ON public.anomalies_fiscales (type);

DROP TRIGGER IF EXISTS trg_anomalies_updated_at ON public.anomalies_fiscales;
CREATE TRIGGER trg_anomalies_updated_at
  BEFORE UPDATE ON public.anomalies_fiscales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.anomalies_fiscales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anomalies_select_fiscal ON public.anomalies_fiscales;
CREATE POLICY anomalies_select_fiscal
  ON public.anomalies_fiscales
  FOR SELECT
  TO authenticated
  USING (public.is_agent_fiscal() OR public.is_admin());

DROP POLICY IF EXISTS anomalies_update_fiscal ON public.anomalies_fiscales;
CREATE POLICY anomalies_update_fiscal
  ON public.anomalies_fiscales
  FOR UPDATE
  TO authenticated
  USING (public.is_agent_fiscal() OR public.is_admin())
  WITH CHECK (public.is_agent_fiscal() OR public.is_admin());

REVOKE INSERT, DELETE ON public.anomalies_fiscales FROM authenticated;

-- Detection: idempotent (UPSERT on empreinte), safe to run on a schedule.
CREATE OR REPLACE FUNCTION public.detect_fiscal_anomalies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
  v_tmp integer;
BEGIN
  -- A. Declared rent unusually low vs commune/type median (< 50 % of median)
  WITH medians AS (
    SELECT commune, type,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY loyer_mensuel) AS mediane,
           count(*) AS n
    FROM public.logements
    GROUP BY commune, type
    HAVING count(*) >= 3
  )
  INSERT INTO public.anomalies_fiscales (type, severite, titre, description, bailleur_id, logement_id, signaux, action_suggeree, empreinte)
  SELECT
    'loyer_sous_evalue',
    CASE WHEN l.loyer_mensuel < m.mediane * 0.3 THEN 'high' ELSE 'medium' END,
    'Loyer déclaré anormalement bas',
    format('Loyer déclaré %s CDF contre une médiane de %s CDF pour un %s à %s.', l.loyer_mensuel, round(m.mediane), l.type, l.commune),
    l.bailleur_id, l.id,
    jsonb_build_object('loyer_declare', l.loyer_mensuel, 'mediane_commune', round(m.mediane), 'ratio', round(l.loyer_mensuel / m.mediane, 2), 'echantillon', m.n),
    'Vérifier le contrat de bail et demander un justificatif de loyer.',
    'loyer_sous_evalue:' || l.id
  FROM public.logements l
  JOIN medians m ON m.commune = l.commune AND m.type = l.type
  WHERE l.loyer_mensuel < m.mediane * 0.5
  ON CONFLICT (empreinte) DO UPDATE SET signaux = EXCLUDED.signaux, updated_at = now()
    WHERE public.anomalies_fiscales.statut = 'detected';
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_inserted := v_inserted + v_tmp;

  -- B. Occupied property without any active contract
  INSERT INTO public.anomalies_fiscales (type, severite, titre, description, bailleur_id, logement_id, signaux, action_suggeree, empreinte)
  SELECT
    'occupe_sans_contrat', 'high',
    'Logement occupé sans contrat actif',
    format('Le logement %s est marqué occupé mais aucun contrat actif n''est enregistré.', l.code),
    l.bailleur_id, l.id,
    jsonb_build_object('code', l.code, 'status', l.status, 'is_occupied', l.is_occupied),
    'Contacter le bailleur pour régulariser le contrat.',
    'occupe_sans_contrat:' || l.id
  FROM public.logements l
  WHERE (l.is_occupied OR l.status = 'occupe')
    AND NOT EXISTS (SELECT 1 FROM public.contrats c WHERE c.logement_id = l.id AND c.status = 'actif')
  ON CONFLICT (empreinte) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_inserted := v_inserted + v_tmp;

  -- C. Many properties, little declared income (>= 3 properties, < 1 payment per property over 6 months)
  INSERT INTO public.anomalies_fiscales (type, severite, titre, description, bailleur_id, signaux, action_suggeree, empreinte)
  SELECT
    'portefeuille_faible_revenu', 'medium',
    'Nombreux biens, faibles revenus déclarés',
    format('%s biens enregistrés mais seulement %s paiement(s) sur 6 mois.', s.nb_biens, s.nb_paiements),
    s.bailleur_id,
    jsonb_build_object('nb_biens', s.nb_biens, 'nb_paiements_6m', s.nb_paiements, 'total_6m', s.total),
    'Ouvrir un contrôle documentaire du portefeuille.',
    'portefeuille_faible_revenu:' || s.bailleur_id
  FROM (
    SELECT b.id AS bailleur_id,
           (SELECT count(*) FROM public.logements l WHERE l.bailleur_id = b.id) AS nb_biens,
           (SELECT count(*) FROM public.paiements p JOIN public.contrats c ON c.id = p.contrat_id
             WHERE c.bailleur_id = b.id AND p.state = 'succeeded' AND p.paid_at >= now() - interval '6 months') AS nb_paiements,
           (SELECT coalesce(sum(p.montant), 0) FROM public.paiements p JOIN public.contrats c ON c.id = p.contrat_id
             WHERE c.bailleur_id = b.id AND p.state = 'succeeded' AND p.paid_at >= now() - interval '6 months') AS total
    FROM public.bailleurs b
  ) s
  WHERE s.nb_biens >= 3 AND s.nb_paiements < s.nb_biens
  ON CONFLICT (empreinte) DO UPDATE SET signaux = EXCLUDED.signaux, updated_at = now()
    WHERE public.anomalies_fiscales.statut = 'detected';
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_inserted := v_inserted + v_tmp;

  -- D. Payment on a contract that is not active
  INSERT INTO public.anomalies_fiscales (type, severite, titre, description, bailleur_id, contrat_id, paiement_id, signaux, action_suggeree, empreinte)
  SELECT
    'paiement_sans_contrat_actif', 'medium',
    'Paiement sur un contrat inactif',
    format('Paiement %s reçu alors que le contrat %s est « %s ».', p.reference, c.code, c.status),
    c.bailleur_id, c.id, p.id,
    jsonb_build_object('reference', p.reference, 'montant', p.montant, 'contrat_status', c.status),
    'Vérifier si un nouveau contrat doit être enregistré.',
    'paiement_sans_contrat_actif:' || p.id
  FROM public.paiements p
  JOIN public.contrats c ON c.id = p.contrat_id
  WHERE p.state = 'succeeded' AND c.status <> 'actif'
  ON CONFLICT (empreinte) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_inserted := v_inserted + v_tmp;

  -- E. Duplicate property registration (same commune + normalised address + parcelle)
  INSERT INTO public.anomalies_fiscales (type, severite, titre, description, bailleur_id, logement_id, signaux, action_suggeree, empreinte)
  SELECT
    'doublon_logement', 'low',
    'Enregistrement de logement en double',
    format('%s logements partagent la même adresse « %s » (%s).', d.n, d.address, d.commune),
    l.bailleur_id, l.id,
    jsonb_build_object('adresse', d.address, 'commune', d.commune, 'parcelle', d.parcelle, 'occurrences', d.n),
    'Fusionner ou justifier les enregistrements.',
    'doublon_logement:' || l.id
  FROM (
    SELECT lower(trim(address)) AS address, commune, coalesce(parcelle, '') AS parcelle, count(*) AS n
    FROM public.logements
    GROUP BY 1, 2, 3
    HAVING count(*) > 1
  ) d
  JOIN public.logements l
    ON lower(trim(l.address)) = d.address AND l.commune = d.commune AND coalesce(l.parcelle, '') = d.parcelle
  ON CONFLICT (empreinte) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_inserted := v_inserted + v_tmp;

  -- F. Frequent bank / mobile-money account changes (>= 3 in 90 days, from audit_logs)
  INSERT INTO public.anomalies_fiscales (type, severite, titre, description, bailleur_id, signaux, action_suggeree, empreinte)
  SELECT
    'changements_compte_frequents', 'high',
    'Changements fréquents de compte de versement',
    format('%s modifications du compte bancaire / Mobile Money en 90 jours.', s.n),
    s.bailleur_id,
    jsonb_build_object('changements_90j', s.n, 'dernier', s.last_at),
    'Vérifier l''identité du titulaire du compte (KYC renforcé).',
    'changements_compte_frequents:' || s.bailleur_id || ':' || to_char(now(), 'YYYY-MM')
  FROM (
    SELECT a.entity_id AS bailleur_id, count(*) AS n, max(a.created_at) AS last_at
    FROM public.audit_logs a
    WHERE a.entity_type = 'bailleurs'
      AND a.created_at >= now() - interval '90 days'
      AND (
        coalesce(a.old_data->>'bank_account', '') <> coalesce(a.new_data->>'bank_account', '')
        OR coalesce(a.old_data->>'mobile_money_number', '') <> coalesce(a.new_data->>'mobile_money_number', '')
      )
    GROUP BY a.entity_id
    HAVING count(*) >= 3
  ) s
  ON CONFLICT (empreinte) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_inserted := v_inserted + v_tmp;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_fiscal_anomalies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.detect_fiscal_anomalies() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Landlord-facing analytics
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_bailleur_tax_summary(p_bailleur_id uuid, p_periode_prefix text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (public.user_owns_bailleur(p_bailleur_id) OR public.is_staff()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'bailleurId', p_bailleur_id,
    'periode', coalesce(p_periode_prefix, to_char(CURRENT_DATE, 'YYYY')),
    'totalCalcule',  coalesce(sum(i.montant), 0),
    'totalPaye',     coalesce(sum(i.montant) FILTER (WHERE i.status = 'paye'), 0),
    'totalDu',       coalesce(sum(i.montant) FILTER (WHERE i.status IN ('calcule', 'declare', 'en_retard')), 0),
    'totalEnRetard', coalesce(sum(i.montant) FILTER (WHERE i.status = 'en_retard' OR (i.status IN ('calcule','declare') AND i.date_echeance < CURRENT_DATE)), 0),
    'baseImposable', coalesce(sum(coalesce(i.base_imposable, 0)), 0),
    'nbObligations', count(*),
    'nbPayees',      count(*) FILTER (WHERE i.status = 'paye'),
    'parPeriode', coalesce((
      SELECT jsonb_agg(jsonb_build_object('periode', s.periode, 'calcule', s.calcule, 'paye', s.paye, 'du', s.du) ORDER BY s.periode)
      FROM (
        SELECT periode,
               sum(montant) AS calcule,
               sum(montant) FILTER (WHERE status = 'paye') AS paye,
               sum(montant) FILTER (WHERE status IN ('calcule','declare','en_retard')) AS du
        FROM public.impots
        WHERE bailleur_id = p_bailleur_id
          AND (p_periode_prefix IS NULL OR periode LIKE p_periode_prefix || '%')
        GROUP BY periode
      ) s
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.impots i
  WHERE i.bailleur_id = p_bailleur_id
    AND (p_periode_prefix IS NULL OR i.periode LIKE p_periode_prefix || '%');

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bailleur_tax_summary(uuid, text) TO authenticated;

-- Compliance score with its components (read-only companion of check_compliance_score).
CREATE OR REPLACE FUNCTION public.get_compliance_breakdown(p_bailleur_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kyc public.kyc_status;
  v_kyc_score numeric := 0;
  v_payment_score numeric := 0;
  v_tax_score numeric := 0;
  v_property_score numeric := 0;
  v_total_payments int; v_on_time int;
  v_total_impots int; v_paid_impots int;
  v_props int;
  v_score numeric;
BEGIN
  IF NOT (public.user_owns_bailleur(p_bailleur_id) OR public.is_staff()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT u.kyc_status INTO v_kyc FROM public.bailleurs b JOIN public.users u ON u.id = b.user_id WHERE b.id = p_bailleur_id;
  v_kyc_score := CASE v_kyc WHEN 'verified' THEN 25 WHEN 'submitted' THEN 15 WHEN 'pending' THEN 5 ELSE 0 END;

  SELECT count(*),
         count(*) FILTER (WHERE p.state = 'succeeded' AND p.paid_at IS NOT NULL
                          AND p.paid_at <= ((p.periode || '-01')::date + interval '1 month' + interval '15 days'))
  INTO v_total_payments, v_on_time
  FROM public.paiements p JOIN public.contrats c ON c.id = p.contrat_id
  WHERE c.bailleur_id = p_bailleur_id;
  IF v_total_payments > 0 THEN v_payment_score := round(35.0 * v_on_time / v_total_payments, 2); END IF;

  SELECT count(*), count(*) FILTER (WHERE i.status IN ('paye', 'declare'))
  INTO v_total_impots, v_paid_impots
  FROM public.impots i WHERE i.bailleur_id = p_bailleur_id;
  IF v_total_impots > 0 THEN v_tax_score := round(25.0 * v_paid_impots / v_total_impots, 2);
  ELSIF v_total_payments = 0 THEN v_tax_score := 12.5; END IF;

  SELECT count(*) INTO v_props FROM public.logements WHERE bailleur_id = p_bailleur_id;
  v_property_score := CASE WHEN v_props > 0 THEN 15 ELSE 0 END;

  v_score := least(100, greatest(0, v_kyc_score + v_payment_score + v_tax_score + v_property_score));

  RETURN jsonb_build_object(
    'score', v_score,
    'level', CASE WHEN v_score >= 90 THEN 'excellent' WHEN v_score >= 75 THEN 'good' WHEN v_score >= 50 THEN 'warning' ELSE 'critical' END,
    'components', jsonb_build_array(
      jsonb_build_object('key', 'kyc',        'label', 'Identité vérifiée (KYC)',   'score', v_kyc_score,      'max', 25),
      jsonb_build_object('key', 'payments',   'label', 'Ponctualité des loyers',    'score', v_payment_score,  'max', 35),
      jsonb_build_object('key', 'taxes',      'label', 'Impôts déclarés / payés',   'score', v_tax_score,      'max', 25),
      jsonb_build_object('key', 'properties', 'label', 'Biens enregistrés',         'score', v_property_score, 'max', 15)
    ),
    'stats', jsonb_build_object(
      'paiements', v_total_payments, 'paiementsPonctuels', v_on_time,
      'impots', v_total_impots, 'impotsRegles', v_paid_impots, 'biens', v_props
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_compliance_breakdown(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. DGI-facing aggregates (staff only)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_fiscal_dashboard(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_len interval := (p_to - p_from + 1) * interval '1 day';
  v_prev_from date := p_from - (p_to - p_from + 1);
  v_prev_to date := p_from - 1;
  v_result jsonb;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'totalRevenue', (SELECT coalesce(sum(montant), 0) FROM public.impots WHERE calculated_at::date BETWEEN p_from AND p_to),
    'previousRevenue', (SELECT coalesce(sum(montant), 0) FROM public.impots WHERE calculated_at::date BETWEEN v_prev_from AND v_prev_to),
    'collectedRevenue', (SELECT coalesce(sum(montant), 0) FROM public.impots WHERE status = 'paye' AND calculated_at::date BETWEEN p_from AND p_to),
    'rentVolume', (SELECT coalesce(sum(montant), 0) FROM public.paiements WHERE state = 'succeeded' AND paid_at::date BETWEEN p_from AND p_to),
    'paymentsCount', (SELECT count(*) FROM public.paiements WHERE state = 'succeeded' AND paid_at::date BETWEEN p_from AND p_to),
    'byCommune', coalesce((
      SELECT jsonb_agg(jsonb_build_object('commune', commune, 'montant', montant, 'count', n) ORDER BY montant DESC)
      FROM (SELECT coalesce(commune, 'Inconnue') AS commune, sum(montant) AS montant, count(*) AS n
            FROM public.impots WHERE calculated_at::date BETWEEN p_from AND p_to GROUP BY 1) s
    ), '[]'::jsonb),
    'byPropertyType', coalesce((
      SELECT jsonb_agg(jsonb_build_object('type', type_logement, 'montant', montant, 'count', n) ORDER BY montant DESC)
      FROM (SELECT coalesce(type_logement, 'Autre') AS type_logement, sum(montant) AS montant, count(*) AS n
            FROM public.impots WHERE calculated_at::date BETWEEN p_from AND p_to GROUP BY 1) s
    ), '[]'::jsonb),
    'topContributors', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'bailleurId', s.bailleur_id, 'nom', s.nom, 'commune', s.commune, 'montant', s.montant,
        'nbPaiements', s.n, 'complianceScore', s.compliance_score, 'complianceLevel', s.compliance_level
      ) ORDER BY s.montant DESC)
      FROM (
        SELECT i.bailleur_id, coalesce(b.business_name, u.full_name) AS nom, u.commune,
               sum(i.montant) AS montant, count(*) AS n, b.compliance_score, b.compliance_level
        FROM public.impots i
        JOIN public.bailleurs b ON b.id = i.bailleur_id
        JOIN public.users u ON u.id = b.user_id
        WHERE i.calculated_at::date BETWEEN p_from AND p_to
        GROUP BY i.bailleur_id, b.business_name, u.full_name, u.commune, b.compliance_score, b.compliance_level
        ORDER BY montant DESC LIMIT 20
      ) s
    ), '[]'::jsonb),
    'complianceDistribution', coalesce((
      SELECT jsonb_agg(jsonb_build_object('level', compliance_level, 'count', n))
      FROM (SELECT compliance_level, count(*) AS n FROM public.bailleurs GROUP BY 1) s
    ), '[]'::jsonb),
    'registrationGrowth', coalesce((
      SELECT jsonb_agg(jsonb_build_object('month', m, 'bailleurs', nb_b, 'logements', nb_l) ORDER BY m)
      FROM (
        SELECT to_char(gs, 'YYYY-MM') AS m,
               (SELECT count(*) FROM public.bailleurs b WHERE b.created_at < gs + interval '1 month') AS nb_b,
               (SELECT count(*) FROM public.logements l WHERE l.created_at < gs + interval '1 month') AS nb_l
        FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') gs
      ) s
    ), '[]'::jsonb),
    'anomaliesOpen', (SELECT count(*) FROM public.anomalies_fiscales WHERE statut IN ('detected', 'escalated')),
    'anomaliesBySeverity', coalesce((
      SELECT jsonb_object_agg(severite, n)
      FROM (SELECT severite, count(*) AS n FROM public.anomalies_fiscales WHERE statut IN ('detected','escalated') GROUP BY 1) s
    ), '{}'::jsonb),
    'registeredProperties', (SELECT count(*) FROM public.logements),
    'registeredLandlords', (SELECT count(*) FROM public.bailleurs),
    'activeContracts', (SELECT count(*) FROM public.contrats WHERE status = 'actif'),
    'averageRent', (SELECT coalesce(round(avg(loyer_mensuel)), 0) FROM public.contrats WHERE status = 'actif'),
    'complianceRate', (SELECT coalesce(round(avg(compliance_score), 1), 0) FROM public.bailleurs)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_fiscal_dashboard(date, date) TO authenticated;

-- Monthly series (historical) used by the forecast page.
CREATE OR REPLACE FUNCTION public.get_fiscal_monthly_series(p_months integer DEFAULT 24)
RETURNS TABLE (month text, impots numeric, loyers numeric, paiements bigint, nouveaux_contrats bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(gs, 'YYYY-MM') AS month,
    coalesce((SELECT sum(i.montant) FROM public.impots i WHERE date_trunc('month', i.calculated_at) = gs), 0) AS impots,
    coalesce((SELECT sum(p.montant) FROM public.paiements p WHERE p.state = 'succeeded' AND date_trunc('month', p.paid_at) = gs), 0) AS loyers,
    (SELECT count(*) FROM public.paiements p WHERE p.state = 'succeeded' AND date_trunc('month', p.paid_at) = gs) AS paiements,
    (SELECT count(*) FROM public.contrats c WHERE date_trunc('month', c.created_at) = gs) AS nouveaux_contrats
  FROM generate_series(
    date_trunc('month', now()) - ((greatest(p_months, 1) - 1) * interval '1 month'),
    date_trunc('month', now()),
    interval '1 month'
  ) gs
  WHERE public.is_staff();
$$;

GRANT EXECUTE ON FUNCTION public.get_fiscal_monthly_series(integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Deadlines: default échéance = 15th of the month after the period
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_impot_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.date_echeance IS NULL THEN
    NEW.date_echeance := ((NEW.periode || '-01')::date + interval '1 month' + interval '14 days')::date;
  END IF;
  IF NEW.bailleur_id IS NULL THEN
    SELECT c.bailleur_id INTO NEW.bailleur_id FROM public.contrats c WHERE c.id = NEW.contrat_id;
  END IF;
  IF NEW.commune IS NULL OR NEW.type_logement IS NULL THEN
    SELECT l.commune, l.type::text INTO NEW.commune, NEW.type_logement
    FROM public.contrats c JOIN public.logements l ON l.id = c.logement_id
    WHERE c.id = NEW.contrat_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impots_defaults ON public.impots;
CREATE TRIGGER trg_impots_defaults
  BEFORE INSERT ON public.impots
  FOR EACH ROW EXECUTE FUNCTION public.set_impot_defaults();

-- Mark overdue obligations (to be scheduled daily).
CREATE OR REPLACE FUNCTION public.mark_overdue_taxes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n integer;
BEGIN
  UPDATE public.impots
  SET status = 'en_retard'
  WHERE status IN ('calcule', 'declare') AND date_echeance < CURRENT_DATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_overdue_taxes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_overdue_taxes() TO service_role;

-- Realtime for landlord tax dashboards (live tax data after each payment).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'impots'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.impots;
    END IF;
  END IF;
END
$$;
