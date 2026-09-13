-- =============================================================================
-- eLoyer Kinshasa — Contract Extensions
-- Migration: 004_contract_extensions.sql
-- =============================================================================

ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'en_attente_signature';

ALTER TABLE public.contrats
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes_internes text,
  ADD COLUMN IF NOT EXISTS signature_token text,
  ADD COLUMN IF NOT EXISTS signed_by_bailleur_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by_locataire_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_url text;

CREATE INDEX IF NOT EXISTS idx_contrats_signature_token ON public.contrats (signature_token)
  WHERE signature_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contrats_status_bailleur ON public.contrats (bailleur_id, status);
