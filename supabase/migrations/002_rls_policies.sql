-- =============================================================================
-- eLoyer Kinshasa — Row Level Security Policies
-- Migration: 002_rls_policies.sql
-- Role is stored in public.users.role (NOT auth user_metadata)
-- =============================================================================

-- =============================================================================
-- RLS HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_agent_fiscal()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'agent_fiscal'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'agent_fiscal', 'gestionnaire', 'agence')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_current_bailleur_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.bailleurs WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_owns_bailleur(p_bailleur_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bailleurs
    WHERE id = p_bailleur_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_contrat_bailleur(p_contrat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contrats c
    JOIN public.bailleurs b ON b.id = c.bailleur_id
    WHERE c.id = p_contrat_id AND b.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_contrat_locataire(p_contrat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contrats
    WHERE id = p_contrat_id AND locataire_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_contrat_party(p_contrat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_is_contrat_bailleur(p_contrat_id)
    OR public.user_is_contrat_locataire(p_contrat_id);
$$;

-- =============================================================================
-- COMMUNES — public read, admin write
-- =============================================================================

CREATE POLICY communes_select_all
  ON public.communes
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY communes_insert_admin
  ON public.communes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY communes_update_admin
  ON public.communes
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY communes_delete_admin
  ON public.communes
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- USERS
-- =============================================================================

CREATE POLICY users_select_own_or_staff
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_staff()
    OR public.is_admin()
  );

CREATE POLICY users_insert_own
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY users_insert_admin
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY users_update_own
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      role = (SELECT u.role FROM public.users u WHERE u.id = auth.uid())
      OR public.is_admin()
    )
  );

CREATE POLICY users_update_admin
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY users_delete_admin
  ON public.users
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- BAILLEURS
-- =============================================================================

CREATE POLICY bailleurs_select_own_or_staff
  ON public.bailleurs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_staff()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.contrats c
      WHERE c.bailleur_id = bailleurs.id
        AND c.locataire_id = auth.uid()
    )
  );

CREATE POLICY bailleurs_insert_own
  ON public.bailleurs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      SELECT role FROM public.users WHERE id = auth.uid()
    ) IN ('bailleur', 'agence')
  );

CREATE POLICY bailleurs_insert_admin
  ON public.bailleurs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY bailleurs_update_own_or_staff
  ON public.bailleurs
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.get_current_user_role() = 'gestionnaire'
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.get_current_user_role() = 'gestionnaire'
  );

CREATE POLICY bailleurs_delete_admin
  ON public.bailleurs
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- LOGEMENTS
-- =============================================================================

CREATE POLICY logements_select_own_or_party_or_staff
  ON public.logements
  FOR SELECT
  TO authenticated
  USING (
    public.user_owns_bailleur(bailleur_id)
    OR public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.contrats c
      WHERE c.logement_id = logements.id
        AND c.locataire_id = auth.uid()
    )
  );

CREATE POLICY logements_insert_bailleur_or_staff
  ON public.logements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_owns_bailleur(bailleur_id)
    OR public.is_admin()
    OR public.get_current_user_role() = 'gestionnaire'
  );

CREATE POLICY logements_update_bailleur_or_staff
  ON public.logements
  FOR UPDATE
  TO authenticated
  USING (
    public.user_owns_bailleur(bailleur_id)
    OR public.is_admin()
    OR public.get_current_user_role() IN ('gestionnaire', 'agence')
  )
  WITH CHECK (
    public.user_owns_bailleur(bailleur_id)
    OR public.is_admin()
    OR public.get_current_user_role() IN ('gestionnaire', 'agence')
  );

CREATE POLICY logements_delete_bailleur_or_admin
  ON public.logements
  FOR DELETE
  TO authenticated
  USING (
    public.user_owns_bailleur(bailleur_id)
    OR public.is_admin()
  );

-- =============================================================================
-- CONTRATS
-- =============================================================================

CREATE POLICY contrats_select_party_or_staff
  ON public.contrats
  FOR SELECT
  TO authenticated
  USING (
    public.user_is_contrat_party(id)
    OR public.is_staff()
  );

CREATE POLICY contrats_insert_bailleur_or_staff
  ON public.contrats
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_owns_bailleur(bailleur_id)
    OR public.is_admin()
    OR public.get_current_user_role() IN ('gestionnaire', 'agence')
  );

CREATE POLICY contrats_update_bailleur_or_staff
  ON public.contrats
  FOR UPDATE
  TO authenticated
  USING (
    public.user_owns_bailleur(bailleur_id)
    OR public.is_admin()
    OR public.get_current_user_role() IN ('gestionnaire', 'agence')
  )
  WITH CHECK (
    public.user_owns_bailleur(bailleur_id)
    OR public.is_admin()
    OR public.get_current_user_role() IN ('gestionnaire', 'agence')
  );

CREATE POLICY contrats_delete_admin
  ON public.contrats
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- PAIEMENTS
-- =============================================================================

CREATE POLICY paiements_select_party_or_staff
  ON public.paiements
  FOR SELECT
  TO authenticated
  USING (
    public.user_is_contrat_party(contrat_id)
    OR public.is_staff()
  );

CREATE POLICY paiements_insert_party_or_staff
  ON public.paiements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_contrat_party(contrat_id)
    OR public.is_admin()
    OR public.get_current_user_role() IN ('gestionnaire', 'agence')
  );

CREATE POLICY paiements_update_party_or_staff
  ON public.paiements
  FOR UPDATE
  TO authenticated
  USING (
    public.user_is_contrat_bailleur(contrat_id)
    OR public.is_admin()
    OR public.is_agent_fiscal()
    OR public.get_current_user_role() IN ('gestionnaire', 'agence')
  )
  WITH CHECK (
    public.user_is_contrat_bailleur(contrat_id)
    OR public.is_admin()
    OR public.is_agent_fiscal()
    OR public.get_current_user_role() IN ('gestionnaire', 'agence')
  );

CREATE POLICY paiements_delete_admin
  ON public.paiements
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- IMPOTS
-- =============================================================================

CREATE POLICY impots_select_bailleur_fiscal_or_staff
  ON public.impots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contrats c
      JOIN public.bailleurs b ON b.id = c.bailleur_id
      WHERE c.id = impots.contrat_id AND b.user_id = auth.uid()
    )
    OR public.is_agent_fiscal()
    OR public.is_admin()
    OR public.get_current_user_role() IN ('gestionnaire', 'agence')
  );

CREATE POLICY impots_insert_fiscal_or_admin
  ON public.impots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_agent_fiscal()
    OR public.is_admin()
  );

CREATE POLICY impots_update_fiscal_or_admin
  ON public.impots
  FOR UPDATE
  TO authenticated
  USING (
    public.is_agent_fiscal()
    OR public.is_admin()
  )
  WITH CHECK (
    public.is_agent_fiscal()
    OR public.is_admin()
  );

CREATE POLICY impots_delete_admin
  ON public.impots
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- RECUS
-- =============================================================================

CREATE POLICY recus_select_party_or_staff
  ON public.recus
  FOR SELECT
  TO authenticated
  USING (
    public.user_is_contrat_party(contrat_id)
    OR public.is_staff()
  );

CREATE POLICY recus_insert_bailleur_or_staff
  ON public.recus
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_contrat_bailleur(contrat_id)
    OR public.is_admin()
    OR public.get_current_user_role() IN ('gestionnaire', 'agence')
  );

CREATE POLICY recus_update_staff
  ON public.recus
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR public.get_current_user_role() IN ('gestionnaire', 'agence')
  )
  WITH CHECK (
    public.is_admin()
    OR public.get_current_user_role() IN ('gestionnaire', 'agence')
  );

CREATE POLICY recus_delete_admin
  ON public.recus
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY notifications_insert_own_or_staff
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_staff()
    OR public.is_admin()
  );

CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_delete_own_or_admin
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- =============================================================================
-- AUDIT LOGS
-- =============================================================================

CREATE POLICY audit_logs_select_staff
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_agent_fiscal()
  );

CREATE POLICY audit_logs_insert_authenticated
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY audit_logs_delete_admin
  ON public.audit_logs
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- REGLES FISCALES
-- =============================================================================

CREATE POLICY regles_fiscales_select_authenticated
  ON public.regles_fiscales
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY regles_fiscales_insert_fiscal_or_admin
  ON public.regles_fiscales
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_agent_fiscal()
    OR public.is_admin()
  );

CREATE POLICY regles_fiscales_update_fiscal_or_admin
  ON public.regles_fiscales
  FOR UPDATE
  TO authenticated
  USING (
    public.is_agent_fiscal()
    OR public.is_admin()
  )
  WITH CHECK (
    public.is_agent_fiscal()
    OR public.is_admin()
  );

CREATE POLICY regles_fiscales_delete_admin
  ON public.regles_fiscales
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
