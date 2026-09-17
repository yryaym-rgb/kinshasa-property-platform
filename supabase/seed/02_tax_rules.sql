-- =============================================================================
-- eLoyer Kinshasa — Seed 02: legacy tax rules (SUPERSEDED)
--
-- The Phase-1 placeholder rules that lived here used the pre-Module-5 column
-- names (name, active, effective_from, property_type…) which migration
-- 009_tax_rules_engine.sql renamed. The canonical initial rule set — with a
-- mandatory legal reference per rule — is now `03_tax_rules_drc.sql`.
--
-- This file is intentionally a no-op so that `supabase db reset` keeps
-- running the seed folder in order without inserting rules twice.
-- =============================================================================

SELECT 1 WHERE false;
