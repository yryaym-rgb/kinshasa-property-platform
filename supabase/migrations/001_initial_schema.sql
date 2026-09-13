-- =============================================================================
-- eLoyer Kinshasa — Initial Schema
-- Migration: 001_initial_schema.sql
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE public.user_role AS ENUM (
  'bailleur',
  'locataire',
  'agence',
  'admin',
  'agent_fiscal',
  'gestionnaire'
);

CREATE TYPE public.kyc_status AS ENUM (
  'pending',
  'submitted',
  'verified',
  'rejected'
);

CREATE TYPE public.property_type AS ENUM (
  'Appartement',
  'Studio',
  'Villa',
  'Bureau',
  'Magasin',
  'Entrepôt'
);

CREATE TYPE public.property_status AS ENUM (
  'disponible',
  'occupe',
  'maintenance',
  'inactif'
);

CREATE TYPE public.contract_status AS ENUM (
  'brouillon',
  'actif',
  'suspendu',
  'resilie',
  'expire'
);

CREATE TYPE public.payment_method AS ENUM (
  'Orange Money',
  'M-Pesa',
  'Airtel Money',
  'Bank',
  'Cash'
);

CREATE TYPE public.payment_status AS ENUM (
  'en_attente',
  'en_cours',
  'complete',
  'echoue',
  'rembourse'
);

CREATE TYPE public.tax_status AS ENUM (
  'calcule',
  'declare',
  'paye',
  'en_retard',
  'exonere'
);

CREATE TYPE public.compliance_level AS ENUM (
  'excellent',
  'good',
  'warning',
  'critical'
);

-- =============================================================================
-- TABLES
-- =============================================================================

-- Communes (reference data — no updated_at)
CREATE TABLE public.communes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  code        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT communes_name_unique UNIQUE (name),
  CONSTRAINT communes_code_unique UNIQUE (code),
  CONSTRAINT communes_code_format CHECK (code ~ '^[A-Z]{3}$')
);

-- Users (extends auth.users)
CREATE TABLE public.users (
  id              uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  phone           text NOT NULL,
  email           text,
  full_name       text NOT NULL,
  role            public.user_role NOT NULL DEFAULT 'locataire',
  commune         text,
  address         text,
  avatar_url      text,
  kyc_status      public.kyc_status NOT NULL DEFAULT 'pending',
  kyc_documents   jsonb,
  is_active       boolean NOT NULL DEFAULT true,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT users_phone_unique UNIQUE (phone),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_phone_format CHECK (phone ~ '^\+243[0-9]{9}$')
);

-- Bailleurs (landlords)
CREATE TABLE public.bailleurs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,
  business_name         text,
  tax_id                text,
  registration_number   text,
  compliance_score      numeric(5, 2) NOT NULL DEFAULT 0,
  compliance_level      public.compliance_level NOT NULL DEFAULT 'warning',
  bank_account          text,
  mobile_money_number   text,
  verified_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bailleurs_user_id_unique UNIQUE (user_id),
  CONSTRAINT bailleurs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT bailleurs_compliance_score_range
    CHECK (compliance_score >= 0 AND compliance_score <= 100)
);

-- Logements (properties)
CREATE TABLE public.logements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bailleur_id     uuid NOT NULL,
  code            text NOT NULL,
  type            public.property_type NOT NULL,
  status          public.property_status NOT NULL DEFAULT 'disponible',
  commune         text NOT NULL,
  address         text NOT NULL,
  quartier        text,
  avenue          text,
  parcelle        text,
  loyer_mensuel   numeric(14, 2) NOT NULL,
  currency        text NOT NULL DEFAULT 'CDF',
  rooms           integer,
  surface_m2      numeric(10, 2),
  coordinates     jsonb,
  photos          text[],
  documents       jsonb,
  description     text,
  is_occupied     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT logements_code_unique UNIQUE (code),
  CONSTRAINT logements_bailleur_id_fkey
    FOREIGN KEY (bailleur_id) REFERENCES public.bailleurs (id) ON DELETE CASCADE,
  CONSTRAINT logements_loyer_positive CHECK (loyer_mensuel > 0),
  CONSTRAINT logements_currency_valid CHECK (currency IN ('CDF', 'USD')),
  CONSTRAINT logements_rooms_positive CHECK (rooms IS NULL OR rooms > 0),
  CONSTRAINT logements_surface_positive CHECK (surface_m2 IS NULL OR surface_m2 > 0)
);

-- Contrats (rental contracts)
CREATE TABLE public.contrats (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL,
  logement_id       uuid NOT NULL,
  bailleur_id       uuid NOT NULL,
  locataire_id      uuid NOT NULL,
  status            public.contract_status NOT NULL DEFAULT 'brouillon',
  date_debut        date NOT NULL,
  date_fin          date,
  loyer_mensuel     numeric(14, 2) NOT NULL,
  depot_garantie    numeric(14, 2),
  currency          text NOT NULL DEFAULT 'CDF',
  payment_day       integer NOT NULL DEFAULT 1,
  terms             jsonb,
  signed_at         timestamptz,
  terminated_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contrats_code_unique UNIQUE (code),
  CONSTRAINT contrats_logement_id_fkey
    FOREIGN KEY (logement_id) REFERENCES public.logements (id) ON DELETE RESTRICT,
  CONSTRAINT contrats_bailleur_id_fkey
    FOREIGN KEY (bailleur_id) REFERENCES public.bailleurs (id) ON DELETE RESTRICT,
  CONSTRAINT contrats_locataire_id_fkey
    FOREIGN KEY (locataire_id) REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT contrats_loyer_positive CHECK (loyer_mensuel > 0),
  CONSTRAINT contrats_currency_valid CHECK (currency IN ('CDF', 'USD')),
  CONSTRAINT contrats_payment_day_range CHECK (payment_day >= 1 AND payment_day <= 28),
  CONSTRAINT contrats_date_range CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

-- Paiements (payments)
CREATE TABLE public.paiements (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference                 text NOT NULL,
  contrat_id                uuid NOT NULL,
  montant                   numeric(14, 2) NOT NULL,
  currency                  text NOT NULL DEFAULT 'CDF',
  method                    public.payment_method NOT NULL,
  status                    public.payment_status NOT NULL DEFAULT 'en_attente',
  provider                  text,
  provider_transaction_id   text,
  periode                   text NOT NULL,
  paid_at                   timestamptz,
  metadata                  jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT paiements_reference_unique UNIQUE (reference),
  CONSTRAINT paiements_contrat_id_fkey
    FOREIGN KEY (contrat_id) REFERENCES public.contrats (id) ON DELETE RESTRICT,
  CONSTRAINT paiements_montant_positive CHECK (montant > 0),
  CONSTRAINT paiements_currency_valid CHECK (currency IN ('CDF', 'USD')),
  CONSTRAINT paiements_periode_format CHECK (periode ~ '^\d{4}-\d{2}$')
);

-- Règles fiscales (tax rules)
CREATE TABLE public.regles_fiscales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  taux            numeric(6, 4) NOT NULL,
  commune         text,
  property_type   public.property_type,
  min_amount      numeric(14, 2),
  max_amount      numeric(14, 2),
  active          boolean NOT NULL DEFAULT true,
  effective_from  date NOT NULL DEFAULT CURRENT_DATE,
  effective_to    date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT regles_fiscales_taux_range CHECK (taux >= 0 AND taux <= 1),
  CONSTRAINT regles_fiscales_amount_range
    CHECK (
      min_amount IS NULL
      OR max_amount IS NULL
      OR min_amount <= max_amount
    ),
  CONSTRAINT regles_fiscales_date_range
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Impôts (tax records)
CREATE TABLE public.impots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_id         uuid,
  contrat_id          uuid NOT NULL,
  montant             numeric(14, 2) NOT NULL,
  taux                numeric(6, 4) NOT NULL,
  status              public.tax_status NOT NULL DEFAULT 'calcule',
  periode             text NOT NULL,
  calculated_at       timestamptz NOT NULL DEFAULT now(),
  paid_at             timestamptz,
  regle_fiscale_id    uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT impots_paiement_id_fkey
    FOREIGN KEY (paiement_id) REFERENCES public.paiements (id) ON DELETE SET NULL,
  CONSTRAINT impots_contrat_id_fkey
    FOREIGN KEY (contrat_id) REFERENCES public.contrats (id) ON DELETE RESTRICT,
  CONSTRAINT impots_regle_fiscale_id_fkey
    FOREIGN KEY (regle_fiscale_id) REFERENCES public.regles_fiscales (id) ON DELETE SET NULL,
  CONSTRAINT impots_montant_non_negative CHECK (montant >= 0),
  CONSTRAINT impots_taux_range CHECK (taux >= 0 AND taux <= 1),
  CONSTRAINT impots_periode_format CHECK (periode ~ '^\d{4}-\d{2}$')
);

-- Reçus (receipts — no updated_at)
CREATE TABLE public.recus (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL,
  paiement_id   uuid NOT NULL,
  contrat_id    uuid NOT NULL,
  montant       numeric(14, 2) NOT NULL,
  currency      text NOT NULL DEFAULT 'CDF',
  issued_at     timestamptz NOT NULL DEFAULT now(),
  pdf_url       text,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT recus_code_unique UNIQUE (code),
  CONSTRAINT recus_paiement_id_fkey
    FOREIGN KEY (paiement_id) REFERENCES public.paiements (id) ON DELETE RESTRICT,
  CONSTRAINT recus_contrat_id_fkey
    FOREIGN KEY (contrat_id) REFERENCES public.contrats (id) ON DELETE RESTRICT,
  CONSTRAINT recus_montant_positive CHECK (montant > 0),
  CONSTRAINT recus_currency_valid CHECK (currency IN ('CDF', 'USD'))
);

-- Notifications (no updated_at)
CREATE TABLE public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  title       text NOT NULL,
  message     text NOT NULL,
  type        text NOT NULL DEFAULT 'info',
  read        boolean NOT NULL DEFAULT false,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE
);

-- Audit logs (no updated_at)
CREATE TABLE public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     uuid,
  old_data      jsonb,
  new_data      jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT audit_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE SET NULL
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- users
CREATE INDEX idx_users_role ON public.users (role);
CREATE INDEX idx_users_kyc_status ON public.users (kyc_status);
CREATE INDEX idx_users_commune ON public.users (commune);
CREATE INDEX idx_users_is_active ON public.users (is_active);

-- bailleurs
CREATE INDEX idx_bailleurs_compliance_level ON public.bailleurs (compliance_level);
CREATE INDEX idx_bailleurs_tax_id ON public.bailleurs (tax_id) WHERE tax_id IS NOT NULL;

-- logements
CREATE INDEX idx_logements_bailleur_id ON public.logements (bailleur_id);
CREATE INDEX idx_logements_commune ON public.logements (commune);
CREATE INDEX idx_logements_status ON public.logements (status);
CREATE INDEX idx_logements_type ON public.logements (type);
CREATE INDEX idx_logements_is_occupied ON public.logements (is_occupied);
CREATE INDEX idx_logements_bailleur_commune ON public.logements (bailleur_id, commune);

-- contrats
CREATE INDEX idx_contrats_logement_id ON public.contrats (logement_id);
CREATE INDEX idx_contrats_bailleur_id ON public.contrats (bailleur_id);
CREATE INDEX idx_contrats_locataire_id ON public.contrats (locataire_id);
CREATE INDEX idx_contrats_status ON public.contrats (status);
CREATE INDEX idx_contrats_date_debut ON public.contrats (date_debut);
CREATE INDEX idx_contrats_active ON public.contrats (status) WHERE status = 'actif';

-- paiements
CREATE INDEX idx_paiements_contrat_id ON public.paiements (contrat_id);
CREATE INDEX idx_paiements_status ON public.paiements (status);
CREATE INDEX idx_paiements_periode ON public.paiements (periode);
CREATE INDEX idx_paiements_paid_at ON public.paiements (paid_at);
CREATE INDEX idx_paiements_method ON public.paiements (method);
CREATE INDEX idx_paiements_contrat_periode ON public.paiements (contrat_id, periode);

-- impots
CREATE INDEX idx_impots_contrat_id ON public.impots (contrat_id);
CREATE INDEX idx_impots_paiement_id ON public.impots (paiement_id);
CREATE INDEX idx_impots_status ON public.impots (status);
CREATE INDEX idx_impots_periode ON public.impots (periode);
CREATE INDEX idx_impots_regle_fiscale_id ON public.impots (regle_fiscale_id);

-- recus
CREATE INDEX idx_recus_paiement_id ON public.recus (paiement_id);
CREATE INDEX idx_recus_contrat_id ON public.recus (contrat_id);
CREATE INDEX idx_recus_issued_at ON public.recus (issued_at);

-- notifications
CREATE INDEX idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX idx_notifications_read ON public.notifications (user_id, read);
CREATE INDEX idx_notifications_created_at ON public.notifications (created_at DESC);

-- audit_logs
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- regles_fiscales
CREATE INDEX idx_regles_fiscales_active ON public.regles_fiscales (active) WHERE active = true;
CREATE INDEX idx_regles_fiscales_commune ON public.regles_fiscales (commune);
CREATE INDEX idx_regles_fiscales_property_type ON public.regles_fiscales (property_type);
CREATE INDEX idx_regles_fiscales_effective ON public.regles_fiscales (effective_from, effective_to);

-- communes
CREATE INDEX idx_communes_name ON public.communes (name);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bailleurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regles_fiscales ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.users IS 'Application user profiles linked to auth.users; role stored here, not in user_metadata';
COMMENT ON TABLE public.bailleurs IS 'Landlord business profiles';
COMMENT ON TABLE public.logements IS 'Registered rental properties in Kinshasa';
COMMENT ON TABLE public.contrats IS 'Rental contracts between bailleurs and locataires';
COMMENT ON TABLE public.paiements IS 'Rent payment transactions';
COMMENT ON TABLE public.impots IS 'Tax calculations and declarations per payment/contract';
COMMENT ON TABLE public.recus IS 'Payment receipts issued to locataires';
COMMENT ON TABLE public.regles_fiscales IS 'Configurable tax rules by commune and property type';
COMMENT ON TABLE public.communes IS '24 communes of Kinshasa';
