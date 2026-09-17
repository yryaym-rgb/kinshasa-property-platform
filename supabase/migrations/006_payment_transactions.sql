-- =============================================================================
-- eLoyer Kinshasa — Module 4: Payment transaction state machine
-- Migration: 006_payment_transactions.sql
--
-- Adds the fine-grained `state` column driven by the payment state machine
-- (see src/services/payment/stateMachine.ts) and the append-only
-- `payment_state_history` audit table. The legacy `status` enum is kept for
-- backwards compatibility and derived from `state` by trigger so every
-- existing screen keeps working unchanged.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- paiements: state machine columns
-- -----------------------------------------------------------------------------

ALTER TABLE public.paiements
  ADD COLUMN IF NOT EXISTS state            varchar(30) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS previous_state   varchar(30),
  ADD COLUMN IF NOT EXISTS state_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS attempt_count    integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at  timestamptz,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at       timestamptz,
  ADD COLUMN IF NOT EXISTS client_ip        inet,
  ADD COLUMN IF NOT EXISTS user_agent       text,
  ADD COLUMN IF NOT EXISTS initiated_by     uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline         jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.paiements
  DROP CONSTRAINT IF EXISTS paiements_state_valid;

ALTER TABLE public.paiements
  ADD CONSTRAINT paiements_state_valid CHECK (
    state IN (
      'draft', 'validating', 'pending', 'processing', 'requires_action',
      'succeeded', 'failed', 'cancelled', 'expired', 'refunded', 'disputed'
    )
  );

-- Backfill `state` for rows created before the state machine existed.
UPDATE public.paiements
SET state = CASE status
  WHEN 'en_attente' THEN 'pending'
  WHEN 'en_cours'   THEN 'processing'
  WHEN 'complete'   THEN 'succeeded'
  WHEN 'echoue'     THEN 'failed'
  WHEN 'rembourse'  THEN 'refunded'
  ELSE 'draft'
END
WHERE state = 'draft' AND status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_paiements_state ON public.paiements (state);
CREATE INDEX IF NOT EXISTS idx_paiements_expires
  ON public.paiements (expires_at)
  WHERE state IN ('pending', 'processing', 'requires_action');
CREATE INDEX IF NOT EXISTS idx_paiements_provider_tx
  ON public.paiements (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

COMMENT ON COLUMN public.paiements.state IS
  'Fine-grained state machine state (draft → validating → pending → processing → succeeded | failed | cancelled | expired → refunded | disputed)';
COMMENT ON COLUMN public.paiements.status IS
  'Legacy coarse status, derived from `state` by trigger. Do not write directly.';
COMMENT ON COLUMN public.paiements.pipeline IS
  'Post-success pipeline checkpoints: {tax: {...}, receipt: {...}, notifications: {...}, ledger: {...}} with status/attempts/error per step. Used for manual recovery.';
COMMENT ON COLUMN public.paiements.last_verified_at IS
  'Last time payment-verify asked the provider. Enforces the 5s per-payment rate limit.';

-- -----------------------------------------------------------------------------
-- Derive legacy `status` from `state` (single source of truth = state)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_state_to_status(p_state text)
RETURNS public.payment_status
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_state
    WHEN 'draft'           THEN 'en_attente'::public.payment_status
    WHEN 'validating'      THEN 'en_attente'::public.payment_status
    WHEN 'pending'         THEN 'en_attente'::public.payment_status
    WHEN 'requires_action' THEN 'en_attente'::public.payment_status
    WHEN 'processing'      THEN 'en_cours'::public.payment_status
    WHEN 'succeeded'       THEN 'complete'::public.payment_status
    WHEN 'disputed'        THEN 'complete'::public.payment_status
    WHEN 'failed'          THEN 'echoue'::public.payment_status
    WHEN 'cancelled'       THEN 'echoue'::public.payment_status
    WHEN 'expired'         THEN 'echoue'::public.payment_status
    WHEN 'refunded'        THEN 'rembourse'::public.payment_status
    ELSE 'en_attente'::public.payment_status
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_payment_status_from_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Legacy writers (seeds, pre-Module-4 code) only set `status`: derive state.
  IF TG_OP = 'INSERT' AND NEW.state = 'draft' AND NEW.status IS DISTINCT FROM 'en_attente' THEN
    NEW.state := CASE NEW.status
      WHEN 'en_cours'  THEN 'processing'
      WHEN 'complete'  THEN 'succeeded'
      WHEN 'echoue'    THEN 'failed'
      WHEN 'rembourse' THEN 'refunded'
      ELSE 'draft'
    END;
  END IF;

  -- Legacy UPDATE that only touches `status`: derive the state from it.
  IF TG_OP = 'UPDATE' AND NEW.state = OLD.state AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.state := CASE NEW.status
      WHEN 'en_attente' THEN 'pending'
      WHEN 'en_cours'   THEN 'processing'
      WHEN 'complete'   THEN 'succeeded'
      WHEN 'echoue'     THEN 'failed'
      WHEN 'rembourse'  THEN 'refunded'
      ELSE NEW.state
    END;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.state IS DISTINCT FROM OLD.state THEN
    NEW.previous_state   := OLD.state;
    NEW.state_changed_at := now();
  END IF;

  NEW.status := public.payment_state_to_status(NEW.state);

  IF NEW.state = 'succeeded' AND NEW.paid_at IS NULL THEN
    NEW.paid_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paiements_sync_status ON public.paiements;
CREATE TRIGGER trg_paiements_sync_status
  BEFORE INSERT OR UPDATE OF state, status ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.sync_payment_status_from_state();

-- -----------------------------------------------------------------------------
-- payment_state_history — append-only audit of every transition
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_state_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_id uuid NOT NULL REFERENCES public.paiements (id) ON DELETE CASCADE,
  from_state  varchar(30),
  to_state    varchar(30) NOT NULL,
  event       varchar(50) NOT NULL,
  reason      text,
  actor       text,                 -- 'system' | 'webhook:<provider>' | 'user:<uuid>' | 'admin:<uuid>'
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_state_history_paiement
  ON public.payment_state_history (paiement_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_state_history_event
  ON public.payment_state_history (event);

ALTER TABLE public.payment_state_history ENABLE ROW LEVEL SECURITY;

-- Only payer, payee and staff can read; nobody but the service role writes.
DROP POLICY IF EXISTS payment_state_history_select_party_or_staff ON public.payment_state_history;
CREATE POLICY payment_state_history_select_party_or_staff
  ON public.payment_state_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.paiements p
      WHERE p.id = payment_state_history.paiement_id
        AND (public.user_is_contrat_party(p.contrat_id) OR public.is_staff())
    )
  );

-- Immutable: no UPDATE/DELETE policies for authenticated users.
REVOKE UPDATE, DELETE ON public.payment_state_history FROM authenticated;

COMMENT ON TABLE public.payment_state_history IS
  'Append-only log of every payment state transition (event, reason, actor). Written exclusively by Edge Functions via service role.';

-- -----------------------------------------------------------------------------
-- Atomic transition helper (used by Edge Functions through service role)
-- Guards against concurrent writers: the update only applies when the row is
-- still in the expected `from_state`, and the history row is written in the
-- same transaction.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.transition_payment_state(
  p_paiement_id uuid,
  p_from_state  text,          -- NULL = don't check
  p_to_state    text,
  p_event       text,
  p_reason      text DEFAULT NULL,
  p_actor       text DEFAULT 'system',
  p_metadata    jsonb DEFAULT NULL,
  p_patch       jsonb DEFAULT NULL  -- optional extra columns to set: provider_transaction_id, failure_reason, paid_at, expires_at, provider_metadata
)
RETURNS public.paiements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.paiements;
  v_old_state text;
BEGIN
  SELECT * INTO v_row FROM public.paiements WHERE id = p_paiement_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_old_state := v_row.state;

  IF p_from_state IS NOT NULL AND v_old_state <> p_from_state THEN
    RAISE EXCEPTION 'invalid_transition: expected % but found %', p_from_state, v_old_state
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.paiements
  SET
    state                   = p_to_state,
    provider_transaction_id = coalesce(p_patch->>'provider_transaction_id', provider_transaction_id),
    failure_reason          = CASE WHEN p_patch ? 'failure_reason' THEN p_patch->>'failure_reason' ELSE failure_reason END,
    paid_at                 = coalesce((p_patch->>'paid_at')::timestamptz, paid_at),
    expires_at              = coalesce((p_patch->>'expires_at')::timestamptz, expires_at),
    provider_metadata       = CASE WHEN p_patch ? 'provider_metadata' THEN p_patch->'provider_metadata' ELSE provider_metadata END,
    last_attempt_at         = CASE WHEN p_event = 'INITIATE' THEN now() ELSE last_attempt_at END,
    attempt_count           = CASE WHEN p_event = 'INITIATE' THEN attempt_count + 1 ELSE attempt_count END
  WHERE id = p_paiement_id
  RETURNING * INTO v_row;

  INSERT INTO public.payment_state_history (paiement_id, from_state, to_state, event, reason, actor, metadata)
  VALUES (p_paiement_id, v_old_state, p_to_state, p_event, p_reason, p_actor, p_metadata);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_payment_state(uuid, text, text, text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_payment_state(uuid, text, text, text, text, text, jsonb, jsonb) TO service_role;

COMMENT ON FUNCTION public.transition_payment_state IS
  'Atomically moves a payment to a new state (optionally guarded by expected from_state) and appends the history row. Service role only.';

-- -----------------------------------------------------------------------------
-- Expire stale payments (to be scheduled with pg_cron or called by a worker)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expire_stale_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT id FROM public.paiements
    WHERE state IN ('pending', 'processing', 'requires_action')
      AND expires_at IS NOT NULL
      AND expires_at < now()
  LOOP
    PERFORM public.transition_payment_state(
      v_id, NULL, 'expired', 'TIMEOUT',
      'expires_at reached without provider confirmation', 'system', NULL,
      '{"failure_reason": "provider_timeout"}'::jsonb
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_payments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_payments() TO service_role;

-- Realtime: the frontend hybrid hook subscribes to UPDATE events on paiements.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'paiements'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.paiements;
    END IF;
  END IF;
END
$$;
