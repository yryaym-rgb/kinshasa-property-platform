-- =============================================================================
-- eLoyer Kinshasa — Functions & Triggers
-- Migration: 003_functions_triggers.sql
-- =============================================================================

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_bailleurs_updated_at
  BEFORE UPDATE ON public.bailleurs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_logements_updated_at
  BEFORE UPDATE ON public.logements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_contrats_updated_at
  BEFORE UPDATE ON public.contrats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_paiements_updated_at
  BEFORE UPDATE ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_impots_updated_at
  BEFORE UPDATE ON public.impots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_regles_fiscales_updated_at
  BEFORE UPDATE ON public.regles_fiscales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- COMMUNE ABBREVIATION HELPER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_commune_abbreviation(commune_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE commune_name
    WHEN 'Gombe' THEN 'GOM'
    WHEN 'Lingwala' THEN 'LIN'
    WHEN 'Kinshasa' THEN 'KIN'
    WHEN 'Kalamu' THEN 'KAL'
    WHEN 'Bandalungwa' THEN 'BAN'
    WHEN 'Barumbu' THEN 'BAR'
    WHEN 'Lemba' THEN 'LEM'
    WHEN 'Limete' THEN 'LIM'
    WHEN 'Matete' THEN 'MAT'
    WHEN 'Ngiri-Ngiri' THEN 'NGI'
    WHEN 'Makala' THEN 'MAK'
    WHEN 'Selembao' THEN 'SEL'
    WHEN 'Bumbu' THEN 'BUM'
    WHEN 'Mont-Ngafula' THEN 'MNG'
    WHEN 'Ndjili' THEN 'NDJ'
    WHEN 'Kimbanseke' THEN 'KIM'
    WHEN 'Kisenso' THEN 'KIS'
    WHEN 'Masina' THEN 'MAS'
    WHEN 'Nsele' THEN 'NSE'
    WHEN 'Maluku' THEN 'MAL'
    WHEN 'Ngaliema' THEN 'NGA'
    WHEN 'Kintambo' THEN 'KNT'
    WHEN 'Kasa-Vubu' THEN 'KAS'
    WHEN 'Mont-Amba' THEN 'MTA'
    ELSE upper(left(commune_name, 3))
  END;
$$;

-- =============================================================================
-- PROPERTY TYPE PREFIX HELPER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_property_type_prefix(p_type public.property_type)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_type
    WHEN 'Appartement' THEN 'APP'
    WHEN 'Studio' THEN 'STU'
    WHEN 'Villa' THEN 'VIL'
    WHEN 'Bureau' THEN 'BUR'
    WHEN 'Magasin' THEN 'MAG'
    WHEN 'Entrepôt' THEN 'ENT'
  END;
$$;

-- =============================================================================
-- GENERATE PROPERTY CODE
-- Format: KIN-GOM-AV123-PARC456-APP012
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_property_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_commune_code text;
  v_av_code text;
  v_parc_code text;
  v_type_prefix text;
  v_sequence integer;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;

  v_commune_code := public.get_commune_abbreviation(NEW.commune);

  v_av_code := CASE
    WHEN NEW.avenue IS NOT NULL AND NEW.avenue <> '' THEN
      'AV' || lpad(regexp_replace(NEW.avenue, '\D', '', 'g'), 3, '0')
    ELSE 'AV000'
  END;

  v_parc_code := CASE
    WHEN NEW.parcelle IS NOT NULL AND NEW.parcelle <> '' THEN
      'PARC' || lpad(left(regexp_replace(NEW.parcelle, '\D', '', 'g'), 3), 3, '0')
    ELSE 'PARC000'
  END;

  v_type_prefix := public.get_property_type_prefix(NEW.type);

  SELECT coalesce(count(*), 0) + 1
  INTO v_sequence
  FROM public.logements
  WHERE bailleur_id = NEW.bailleur_id
    AND commune = NEW.commune;

  NEW.code := format(
    'KIN-%s-%s-%s-%s%s',
    v_commune_code,
    v_av_code,
    v_parc_code,
    v_type_prefix,
    lpad(v_sequence::text, 3, '0')
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_logements_generate_code
  BEFORE INSERT ON public.logements
  FOR EACH ROW EXECUTE FUNCTION public.generate_property_code();

-- =============================================================================
-- GENERATE CONTRACT CODE
-- Format: CTR-KIN-2025-000001
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_contract_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text;
  v_sequence integer;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;

  v_year := to_char(CURRENT_DATE, 'YYYY');

  SELECT coalesce(count(*), 0) + 1
  INTO v_sequence
  FROM public.contrats
  WHERE code LIKE 'CTR-KIN-' || v_year || '-%';

  NEW.code := format('CTR-KIN-%s-%s', v_year, lpad(v_sequence::text, 6, '0'));

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contrats_generate_code
  BEFORE INSERT ON public.contrats
  FOR EACH ROW EXECUTE FUNCTION public.generate_contract_code();

-- =============================================================================
-- GENERATE RECEIPT CODE
-- Format: REC-KIN-2025-000001
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_receipt_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text;
  v_sequence integer;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;

  v_year := to_char(CURRENT_DATE, 'YYYY');

  SELECT coalesce(count(*), 0) + 1
  INTO v_sequence
  FROM public.recus
  WHERE code LIKE 'REC-KIN-' || v_year || '-%';

  NEW.code := format('REC-KIN-%s-%s', v_year, lpad(v_sequence::text, 6, '0'));

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recus_generate_code
  BEFORE INSERT ON public.recus
  FOR EACH ROW EXECUTE FUNCTION public.generate_receipt_code();

-- =============================================================================
-- GENERATE PAYMENT REFERENCE
-- Format: TXN-{timestamp}-{random}
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_payment_reference()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reference IS NOT NULL AND NEW.reference <> '' THEN
    RETURN NEW;
  END IF;

  NEW.reference := format(
    'TXN-%s-%s',
    upper(to_hex(extract(epoch FROM now())::bigint)),
    upper(substr(md5(gen_random_uuid()::text), 1, 6))
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_paiements_generate_reference
  BEFORE INSERT ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.generate_payment_reference();

-- =============================================================================
-- CALCULATE TAX FOR PAYMENT
-- Returns tax amount (numeric) for a given payment
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calculate_tax_for_payment(payment_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_logement record;
  v_regle record;
  v_taux numeric := 0.12;
  v_minimum_taxable numeric := 50000;
  v_taxable_amount numeric;
  v_tax_amount numeric;
BEGIN
  SELECT p.*, c.logement_id
  INTO v_payment
  FROM public.paiements p
  JOIN public.contrats c ON c.id = p.contrat_id
  WHERE p.id = payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', payment_id;
  END IF;

  SELECT l.*
  INTO v_logement
  FROM public.logements l
  JOIN public.contrats c ON c.logement_id = l.id
  WHERE c.id = v_payment.contrat_id;

  -- Find most specific applicable tax rule
  SELECT rf.*
  INTO v_regle
  FROM public.regles_fiscales rf
  WHERE rf.active = true
    AND rf.effective_from <= CURRENT_DATE
    AND (rf.effective_to IS NULL OR rf.effective_to >= CURRENT_DATE)
    AND (rf.commune IS NULL OR rf.commune = v_logement.commune)
    AND (rf.property_type IS NULL OR rf.property_type = v_logement.type)
    AND (rf.min_amount IS NULL OR v_payment.montant >= rf.min_amount)
    AND (rf.max_amount IS NULL OR v_payment.montant <= rf.max_amount)
  ORDER BY
    CASE WHEN rf.commune IS NOT NULL THEN 1 ELSE 0 END DESC,
    CASE WHEN rf.property_type IS NOT NULL THEN 1 ELSE 0 END DESC,
    rf.effective_from DESC
  LIMIT 1;

  IF FOUND THEN
    v_taux := v_regle.taux;
  END IF;

  -- Apply minimum taxable threshold
  IF v_payment.montant < v_minimum_taxable THEN
    RETURN 0;
  END IF;

  v_taxable_amount := v_payment.montant;
  v_tax_amount := round(v_taxable_amount * v_taux, 2);

  RETURN v_tax_amount;
END;
$$;

-- =============================================================================
-- CHECK COMPLIANCE SCORE
-- Returns compliance score (0-100) for a bailleur
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_compliance_score(bailleur_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bailleur record;
  v_total_contracts integer;
  v_active_contracts integer;
  v_total_payments integer;
  v_on_time_payments integer;
  v_total_impots integer;
  v_paid_impots integer;
  v_kyc_score numeric := 0;
  v_payment_score numeric := 0;
  v_tax_score numeric := 0;
  v_property_score numeric := 0;
  v_final_score numeric;
BEGIN
  SELECT b.*, u.kyc_status
  INTO v_bailleur
  FROM public.bailleurs b
  JOIN public.users u ON u.id = b.user_id
  WHERE b.id = bailleur_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bailleur not found: %', bailleur_id;
  END IF;

  -- KYC component (25 points)
  v_kyc_score := CASE v_bailleur.kyc_status
    WHEN 'verified' THEN 25
    WHEN 'submitted' THEN 15
    WHEN 'pending' THEN 5
    WHEN 'rejected' THEN 0
    ELSE 0
  END;

  -- Payment timeliness component (35 points)
  SELECT
    count(*) FILTER (WHERE c.bailleur_id = bailleur_id),
    count(*) FILTER (WHERE c.bailleur_id = bailleur_id AND c.status = 'actif')
  INTO v_total_contracts, v_active_contracts
  FROM public.contrats c;

  SELECT
    count(*),
    count(*) FILTER (
      WHERE p.status = 'complete'
        AND p.paid_at IS NOT NULL
        AND p.paid_at <= (
          (p.periode || '-01')::date
          + interval '1 month'
          + interval '15 days'
        )
    )
  INTO v_total_payments, v_on_time_payments
  FROM public.paiements p
  JOIN public.contrats c ON c.id = p.contrat_id
  WHERE c.bailleur_id = bailleur_id;

  IF v_total_payments > 0 THEN
    v_payment_score := round(35.0 * v_on_time_payments / v_total_payments, 2);
  END IF;

  -- Tax compliance component (25 points)
  SELECT
    count(*),
    count(*) FILTER (WHERE i.status IN ('paye', 'declare'))
  INTO v_total_impots, v_paid_impots
  FROM public.impots i
  JOIN public.contrats c ON c.id = i.contrat_id
  WHERE c.bailleur_id = bailleur_id;

  IF v_total_impots > 0 THEN
    v_tax_score := round(25.0 * v_paid_impots / v_total_impots, 2);
  ELSIF v_total_contracts = 0 THEN
    v_tax_score := 12.5;
  END IF;

  -- Property registration component (15 points)
  SELECT CASE
    WHEN count(*) > 0 THEN 15
    ELSE 0
  END
  INTO v_property_score
  FROM public.logements
  WHERE bailleur_id = bailleur_id;

  v_final_score := least(100, greatest(0, v_kyc_score + v_payment_score + v_tax_score + v_property_score));

  -- Update bailleur compliance fields
  UPDATE public.bailleurs
  SET
    compliance_score = v_final_score,
    compliance_level = CASE
      WHEN v_final_score >= 90 THEN 'excellent'::public.compliance_level
      WHEN v_final_score >= 75 THEN 'good'::public.compliance_level
      WHEN v_final_score >= 50 THEN 'warning'::public.compliance_level
      ELSE 'critical'::public.compliance_level
    END,
    updated_at = now()
  WHERE id = bailleur_id;

  RETURN v_final_score;
END;
$$;

-- =============================================================================
-- GET USER ACCESSIBLE DATA
-- Returns JSON summary of entities accessible to the current user
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_accessible_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_bailleur_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_user_id;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'User profile not found');
  END IF;

  SELECT id INTO v_bailleur_id FROM public.bailleurs WHERE user_id = v_user_id;

  v_result := jsonb_build_object(
    'user_id', v_user_id,
    'role', v_role,
    'bailleur_id', v_bailleur_id
  );

  -- Staff roles see all data
  IF v_role IN ('admin', 'agent_fiscal', 'gestionnaire', 'agence') THEN
    v_result := v_result || jsonb_build_object(
      'scope', 'all',
      'logement_ids', (SELECT coalesce(jsonb_agg(id), '[]'::jsonb) FROM public.logements),
      'contrat_ids', (SELECT coalesce(jsonb_agg(id), '[]'::jsonb) FROM public.contrats),
      'paiement_ids', (SELECT coalesce(jsonb_agg(id), '[]'::jsonb) FROM public.paiements),
      'impot_ids', (SELECT coalesce(jsonb_agg(id), '[]'::jsonb) FROM public.impots),
      'recu_ids', (SELECT coalesce(jsonb_agg(id), '[]'::jsonb) FROM public.recus),
      'bailleur_ids', (SELECT coalesce(jsonb_agg(id), '[]'::jsonb) FROM public.bailleurs),
      'user_ids', (SELECT coalesce(jsonb_agg(id), '[]'::jsonb) FROM public.users)
    );
    RETURN v_result;
  END IF;

  -- Bailleur sees own portfolio
  IF v_role = 'bailleur' AND v_bailleur_id IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'scope', 'bailleur',
      'logement_ids', (
        SELECT coalesce(jsonb_agg(id), '[]'::jsonb)
        FROM public.logements WHERE bailleur_id = v_bailleur_id
      ),
      'contrat_ids', (
        SELECT coalesce(jsonb_agg(id), '[]'::jsonb)
        FROM public.contrats WHERE bailleur_id = v_bailleur_id
      ),
      'paiement_ids', (
        SELECT coalesce(jsonb_agg(p.id), '[]'::jsonb)
        FROM public.paiements p
        JOIN public.contrats c ON c.id = p.contrat_id
        WHERE c.bailleur_id = v_bailleur_id
      ),
      'impot_ids', (
        SELECT coalesce(jsonb_agg(i.id), '[]'::jsonb)
        FROM public.impots i
        JOIN public.contrats c ON c.id = i.contrat_id
        WHERE c.bailleur_id = v_bailleur_id
      ),
      'recu_ids', (
        SELECT coalesce(jsonb_agg(r.id), '[]'::jsonb)
        FROM public.recus r
        JOIN public.contrats c ON c.id = r.contrat_id
        WHERE c.bailleur_id = v_bailleur_id
      )
    );
    RETURN v_result;
  END IF;

  -- Locataire sees own contracts and related data
  IF v_role = 'locataire' THEN
    v_result := v_result || jsonb_build_object(
      'scope', 'locataire',
      'contrat_ids', (
        SELECT coalesce(jsonb_agg(id), '[]'::jsonb)
        FROM public.contrats WHERE locataire_id = v_user_id
      ),
      'logement_ids', (
        SELECT coalesce(jsonb_agg(DISTINCT c.logement_id), '[]'::jsonb)
        FROM public.contrats c WHERE c.locataire_id = v_user_id
      ),
      'paiement_ids', (
        SELECT coalesce(jsonb_agg(p.id), '[]'::jsonb)
        FROM public.paiements p
        JOIN public.contrats c ON c.id = p.contrat_id
        WHERE c.locataire_id = v_user_id
      ),
      'recu_ids', (
        SELECT coalesce(jsonb_agg(r.id), '[]'::jsonb)
        FROM public.recus r
        JOIN public.contrats c ON c.id = r.contrat_id
        WHERE c.locataire_id = v_user_id
      )
    );
    RETURN v_result;
  END IF;

  RETURN v_result || jsonb_build_object('scope', 'limited');
END;
$$;

-- =============================================================================
-- SYNC LOGEMENT OCCUPIED STATUS ON CONTRACT CHANGES
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_logement_occupancy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.status = 'actif' THEN
      UPDATE public.logements
      SET is_occupied = true, status = 'occupe', updated_at = now()
      WHERE id = NEW.logement_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'actif' AND NEW.status <> 'actif' THEN
    UPDATE public.logements
    SET is_occupied = false, status = 'disponible', updated_at = now()
    WHERE id = NEW.logement_id
      AND NOT EXISTS (
        SELECT 1 FROM public.contrats
        WHERE logement_id = NEW.logement_id AND status = 'actif' AND id <> NEW.id
      );
  END IF;

  IF TG_OP = 'DELETE' AND OLD.status = 'actif' THEN
    UPDATE public.logements
    SET is_occupied = false, status = 'disponible', updated_at = now()
    WHERE id = OLD.logement_id
      AND NOT EXISTS (
        SELECT 1 FROM public.contrats
        WHERE logement_id = OLD.logement_id AND status = 'actif'
      );
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_contrats_sync_occupancy
  AFTER INSERT OR UPDATE OR DELETE ON public.contrats
  FOR EACH ROW EXECUTE FUNCTION public.sync_logement_occupancy();

-- =============================================================================
-- GRANT EXECUTE ON FUNCTIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.calculate_tax_for_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_compliance_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_accessible_data() TO authenticated;
