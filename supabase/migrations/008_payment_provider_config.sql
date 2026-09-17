-- =============================================================================
-- eLoyer Kinshasa — Module 4: Payment provider configuration
-- Migration: 008_payment_provider_config.sql
--
-- Provider catalogue exposed to the frontend (name, fees, limits, sandbox
-- flag). Secrets are NEVER stored here — they live in Supabase Edge Function
-- secrets (see docs/MOBILE_MONEY_INTEGRATION.md). `config` holds only
-- non-sensitive tuning (e.g. polling interval, country code).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_providers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key      varchar(30)  NOT NULL,
  display_name      varchar(100) NOT NULL,
  icon_url          text,
  subtext           varchar(200),
  is_active         boolean NOT NULL DEFAULT true,
  is_sandbox        boolean NOT NULL DEFAULT true,
  supports_partial  boolean NOT NULL DEFAULT false,
  supports_refund   boolean NOT NULL DEFAULT true,
  requires_phone    boolean NOT NULL DEFAULT true,
  min_amount        numeric(12, 2) NOT NULL DEFAULT 100,
  max_amount        numeric(12, 2) NOT NULL DEFAULT 10000000,
  processing_time   varchar(50),
  fee_percentage    numeric(5, 2) NOT NULL DEFAULT 0,
  fee_fixed         numeric(12, 2) NOT NULL DEFAULT 0,
  refund_window_days integer NOT NULL DEFAULT 30,
  sort_order        integer NOT NULL DEFAULT 100,
  config            jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payment_providers_key_unique UNIQUE (provider_key),
  CONSTRAINT payment_providers_amount_range CHECK (min_amount >= 0 AND max_amount >= min_amount),
  CONSTRAINT payment_providers_fee_range CHECK (fee_percentage >= 0 AND fee_percentage <= 100)
);

CREATE INDEX IF NOT EXISTS idx_payment_providers_active
  ON public.payment_providers (is_active, sort_order);

DROP TRIGGER IF EXISTS trg_payment_providers_updated_at ON public.payment_providers;
CREATE TRIGGER trg_payment_providers_updated_at
  BEFORE UPDATE ON public.payment_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_providers_select_all ON public.payment_providers;
CREATE POLICY payment_providers_select_all
  ON public.payment_providers
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS payment_providers_write_admin ON public.payment_providers;
CREATE POLICY payment_providers_write_admin
  ON public.payment_providers
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.payment_providers
  (provider_key, display_name, subtext, processing_time, fee_percentage, is_sandbox, requires_phone, supports_refund, sort_order, config)
VALUES
  ('orange_money',  'Orange Money',      'Paiement instantané',  'instantané',  1.5, true, true,  true,  10, '{"country": "CD", "phone_prefixes": ["+24389", "+24384", "+24385"]}'::jsonb),
  ('mpesa',         'M-Pesa',            'Paiement instantané',  'instantané',  1.5, true, true,  true,  20, '{"country": "CD", "phone_prefixes": ["+24381", "+24382"]}'::jsonb),
  ('airtel_money',  'Airtel Money',      'Paiement instantané',  'instantané',  1.5, true, true,  true,  30, '{"country": "CD", "phone_prefixes": ["+24397", "+24399"]}'::jsonb),
  ('card',          'Carte bancaire',    'Visa / Mastercard',    'instantané',  2.5, true, false, true,  40, '{"redirect": true}'::jsonb),
  ('bank_transfer', 'Virement bancaire', '1-2 jours ouvrés',     '1-2 jours',   0.0, true, false, false, 50, '{"manual_confirmation": true}'::jsonb)
ON CONFLICT (provider_key) DO UPDATE SET
  display_name    = EXCLUDED.display_name,
  subtext         = EXCLUDED.subtext,
  processing_time = EXCLUDED.processing_time,
  sort_order      = EXCLUDED.sort_order;

COMMENT ON TABLE public.payment_providers IS
  'Catalogue of payment providers shown to tenants. No secrets here — API keys live in Edge Function env vars.';
