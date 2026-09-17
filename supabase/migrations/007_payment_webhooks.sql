-- =============================================================================
-- eLoyer Kinshasa — Module 4: Provider webhooks
-- Migration: 007_payment_webhooks.sql
--
-- Every inbound webhook is persisted *before* it is interpreted — including
-- payloads whose signature failed — so the raw evidence survives any bug in
-- the processing code. `provider_event_id` is unique per provider and gives
-- webhook idempotency (the same event delivered twice is processed once).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_webhooks (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                varchar(30)  NOT NULL,
  event_type              varchar(50)  NOT NULL,
  provider_event_id       varchar(150),
  provider_transaction_id varchar(100),
  paiement_id             uuid REFERENCES public.paiements (id) ON DELETE SET NULL,
  payload                 jsonb        NOT NULL,
  headers                 jsonb,
  signature_valid         boolean,
  processed               boolean      NOT NULL DEFAULT false,
  processed_at            timestamptz,
  processing_error        text,
  processing_attempts     integer      NOT NULL DEFAULT 0,
  source_ip               inet,
  received_at             timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_provider_tx
  ON public.payment_webhooks (provider, provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_unprocessed
  ON public.payment_webhooks (received_at)
  WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_webhooks_paiement
  ON public.payment_webhooks (paiement_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhooks_provider_event
  ON public.payment_webhooks (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

ALTER TABLE public.payment_webhooks ENABLE ROW LEVEL SECURITY;

-- Staff can inspect webhooks for support; only the service role writes.
DROP POLICY IF EXISTS payment_webhooks_select_staff ON public.payment_webhooks;
CREATE POLICY payment_webhooks_select_staff
  ON public.payment_webhooks
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_agent_fiscal());

REVOKE INSERT, UPDATE, DELETE ON public.payment_webhooks FROM authenticated;

COMMENT ON TABLE public.payment_webhooks IS
  'Raw inbound provider webhooks (stored before interpretation, even when the signature is invalid).';
COMMENT ON COLUMN public.payment_webhooks.provider_event_id IS
  'Provider-side unique event id. Unique per provider → duplicate deliveries are ignored.';

-- -----------------------------------------------------------------------------
-- Post-success pipeline retry queue
-- When a payment has succeeded but a downstream step (tax, receipt, ledger,
-- notification) failed, the step is queued here with its full context. The
-- money has moved, so the payment itself stays `succeeded`.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_pipeline_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_id   uuid NOT NULL REFERENCES public.paiements (id) ON DELETE CASCADE,
  step          varchar(40) NOT NULL,   -- 'tax' | 'ledger' | 'receipt' | 'notifications' | 'compliance'
  status        varchar(20) NOT NULL DEFAULT 'queued', -- queued | running | done | failed | dead
  attempts      integer NOT NULL DEFAULT 0,
  max_attempts  integer NOT NULL DEFAULT 5,
  next_run_at   timestamptz NOT NULL DEFAULT now(),
  last_error    text,
  context       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payment_pipeline_jobs_status_valid
    CHECK (status IN ('queued', 'running', 'done', 'failed', 'dead'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pipeline_jobs_paiement_step
  ON public.payment_pipeline_jobs (paiement_id, step);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_due
  ON public.payment_pipeline_jobs (next_run_at)
  WHERE status IN ('queued', 'failed');

ALTER TABLE public.payment_pipeline_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_pipeline_jobs_select_staff ON public.payment_pipeline_jobs;
CREATE POLICY payment_pipeline_jobs_select_staff
  ON public.payment_pipeline_jobs
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_agent_fiscal());

REVOKE INSERT, UPDATE, DELETE ON public.payment_pipeline_jobs FROM authenticated;

DROP TRIGGER IF EXISTS trg_pipeline_jobs_updated_at ON public.payment_pipeline_jobs;
CREATE TRIGGER trg_pipeline_jobs_updated_at
  BEFORE UPDATE ON public.payment_pipeline_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.payment_pipeline_jobs IS
  'Retry queue for post-success pipeline steps that failed. Full context preserved for manual recovery.';

-- -----------------------------------------------------------------------------
-- Ledger: landlord balances and DGI obligations
-- A double-entry style journal so every credited loyer_net and every debited
-- impôt is traceable to its payment.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_id   uuid REFERENCES public.paiements (id) ON DELETE RESTRICT,
  account_type  varchar(30) NOT NULL,  -- 'bailleur' | 'dgi' | 'platform' | 'provider_fee'
  account_id    uuid,                  -- bailleur id for 'bailleur', NULL otherwise
  direction     varchar(6)  NOT NULL,  -- 'credit' | 'debit'
  amount        numeric(14, 2) NOT NULL,
  currency      text NOT NULL DEFAULT 'CDF',
  description   text,
  reversal_of   uuid REFERENCES public.ledger_entries (id) ON DELETE RESTRICT,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ledger_entries_direction_valid CHECK (direction IN ('credit', 'debit')),
  CONSTRAINT ledger_entries_amount_positive CHECK (amount >= 0),
  CONSTRAINT ledger_entries_currency_valid CHECK (currency IN ('CDF', 'USD'))
);

CREATE INDEX IF NOT EXISTS idx_ledger_paiement ON public.ledger_entries (paiement_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON public.ledger_entries (account_type, account_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_paiement_account
  ON public.ledger_entries (paiement_id, account_type, direction)
  WHERE reversal_of IS NULL;

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_entries_select_owner_or_staff ON public.ledger_entries;
CREATE POLICY ledger_entries_select_owner_or_staff
  ON public.ledger_entries
  FOR SELECT
  TO authenticated
  USING (
    (account_type = 'bailleur' AND public.user_owns_bailleur(account_id))
    OR public.is_staff()
  );

REVOKE INSERT, UPDATE, DELETE ON public.ledger_entries FROM authenticated;

COMMENT ON TABLE public.ledger_entries IS
  'Journal of landlord credits (loyer net) and DGI debits (impôt) per payment. Refunds insert reversal rows, never delete.';

ALTER TABLE public.bailleurs
  ADD COLUMN IF NOT EXISTS solde_disponible numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_encaisse   numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_impots_dus numeric(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.bailleurs.solde_disponible IS 'Running balance of net rent credited (sum of ledger credits minus reversals).';
