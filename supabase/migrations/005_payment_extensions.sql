-- =============================================================================
-- eLoyer Kinshasa — Payment extensions for Module 2
-- =============================================================================

ALTER TABLE public.paiements
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS provider_metadata JSONB,
  ADD COLUMN IF NOT EXISTS tax_calculation JSONB,
  ADD COLUMN IF NOT EXISTS notifications_sent BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_paiements_idempotency
  ON public.paiements (idempotency_key);

COMMENT ON COLUMN public.paiements.idempotency_key IS 'Unique key to prevent duplicate payment attempts within 5 minutes';
COMMENT ON COLUMN public.paiements.failure_reason IS 'Provider failure reason code or message';
COMMENT ON COLUMN public.paiements.tax_calculation IS 'JSON breakdown of tax and fee calculation at payment time';
COMMENT ON COLUMN public.paiements.notifications_sent IS 'Whether tenant and landlord notifications were sent';
