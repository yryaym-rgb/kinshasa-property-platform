-- =============================================================================
-- eLoyer Kinshasa — Seed: Development Test Data
-- Password for all test users: Test@2025!
-- =============================================================================

-- Fixed UUIDs for reproducible development
-- Admin:       a0000000-0000-4000-8000-000000000001
-- Agent fiscal: a0000000-0000-4000-8000-000000000002
-- Bailleur:    a0000000-0000-4000-8000-000000000003
-- Locataire:   a0000000-0000-4000-8000-000000000004

-- =============================================================================
-- AUTH USERS
-- =============================================================================

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  phone,
  phone_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  is_sso_user
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'admin@eloyer.cd',
    crypt('Test@2025!', gen_salt('bf')),
    now(),
    '+243900000001',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'fiscal@eloyer.cd',
    crypt('Test@2025!', gen_salt('bf')),
    now(),
    '+243900000002',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'bailleur@eloyer.cd',
    crypt('Test@2025!', gen_salt('bf')),
    now(),
    '+243812345678',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'locataire@eloyer.cd',
    crypt('Test@2025!', gen_salt('bf')),
    now(),
    '+243812345679',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    false
  )
ON CONFLICT (id) DO NOTHING;

-- Auth identities (required for email/phone login)
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    '{"sub":"a0000000-0000-4000-8000-000000000001","email":"admin@eloyer.cd"}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000002',
    '{"sub":"a0000000-0000-4000-8000-000000000002","email":"fiscal@eloyer.cd"}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000003',
    '{"sub":"a0000000-0000-4000-8000-000000000003","email":"bailleur@eloyer.cd"}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    'a0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000004',
    '{"sub":"a0000000-0000-4000-8000-000000000004","email":"locataire@eloyer.cd"}',
    'email',
    now(),
    now(),
    now()
  )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- PUBLIC USERS (role stored here, NOT in user_metadata)
-- =============================================================================

INSERT INTO public.users (id, phone, email, full_name, role, commune, address, kyc_status, is_active) VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    '+243900000001',
    'admin@eloyer.cd',
    'Admin eLoyer',
    'admin',
    'Gombe',
    'Avenue du Commerce 1',
    'verified',
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    '+243900000002',
    'fiscal@eloyer.cd',
    'Agent Fiscal Test',
    'agent_fiscal',
    'Gombe',
    'Direction des Impôts',
    'verified',
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    '+243812345678',
    'bailleur@eloyer.cd',
    'Jean Mukendi',
    'bailleur',
    'Gombe',
    'Avenue Batetela 42',
    'verified',
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000004',
    '+243812345679',
    'locataire@eloyer.cd',
    'Marie Kabila',
    'locataire',
    'Gombe',
    'Avenue du 24 Novembre 15',
    'verified',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- BAILLEUR
-- =============================================================================

INSERT INTO public.bailleurs (
  id,
  user_id,
  business_name,
  tax_id,
  registration_number,
  compliance_score,
  compliance_level,
  mobile_money_number,
  verified_at
) VALUES (
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000003',
  'Mukendi Immobilier SARL',
  'A12345678',
  'RCCM/CD/KIN/2020/B/12345',
  85.00,
  'good',
  '+243812345678',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- LOGEMENT
-- =============================================================================

INSERT INTO public.logements (
  id,
  bailleur_id,
  code,
  type,
  status,
  commune,
  address,
  quartier,
  avenue,
  parcelle,
  loyer_mensuel,
  currency,
  rooms,
  surface_m2,
  description,
  is_occupied
) VALUES (
  'c0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'KIN-GOM-AV042-PARC001-APP001',
  'Appartement',
  'occupe',
  'Gombe',
  'Immeuble Horizon, 3e étage',
  'Centre-ville',
  '42',
  '001',
  850000.00,
  'CDF',
  3,
  95.00,
  'Appartement moderne avec vue sur le fleuve Congo',
  true
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CONTRAT
-- =============================================================================

INSERT INTO public.contrats (
  id,
  code,
  logement_id,
  bailleur_id,
  locataire_id,
  status,
  date_debut,
  date_fin,
  loyer_mensuel,
  depot_garantie,
  currency,
  payment_day,
  signed_at
) VALUES (
  'd0000000-0000-4000-8000-000000000001',
  'CTR-KIN-2025-000001',
  'c0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000004',
  'actif',
  '2025-01-01',
  '2025-12-31',
  850000.00,
  1700000.00,
  'CDF',
  5,
  '2024-12-28 10:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PAIEMENT
-- =============================================================================

INSERT INTO public.paiements (
  id,
  reference,
  contrat_id,
  montant,
  currency,
  method,
  status,
  provider,
  periode,
  paid_at
) VALUES (
  'e0000000-0000-4000-8000-000000000001',
  'TXN-TEST-202509-001',
  'd0000000-0000-4000-8000-000000000001',
  850000.00,
  'CDF',
  'Orange Money',
  'complete',
  'Orange Money',
  '2025-09',
  '2025-09-05 14:30:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- IMPOT
-- =============================================================================

INSERT INTO public.impots (
  id,
  paiement_id,
  contrat_id,
  montant,
  taux,
  status,
  periode,
  calculated_at,
  regle_fiscale_id
) VALUES (
  'f0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  85000.00,
  0.1000,
  'calcule',
  '2025-09',
  now(),
  (SELECT id FROM public.regles_fiscales WHERE nom = 'Impôt sur revenus locatifs — résidentiel' LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- RECU
-- =============================================================================

INSERT INTO public.recus (
  id,
  code,
  paiement_id,
  contrat_id,
  montant,
  currency,
  issued_at
) VALUES (
  'g0000000-0000-4000-8000-000000000001',
  'REC-KIN-2025-000001',
  'e0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  850000.00,
  'CDF',
  '2025-09-05 14:35:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

INSERT INTO public.notifications (user_id, title, message, type, read) VALUES
  (
    'a0000000-0000-4000-8000-000000000004',
    'Paiement confirmé',
    'Votre paiement de loyer pour septembre 2025 a été confirmé.',
    'payment',
    false
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    'Nouveau paiement reçu',
    'Marie Kabila a effectué le paiement du loyer pour septembre 2025.',
    'payment',
    false
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'Impôt calculé',
    'Un nouvel impôt locatif a été calculé pour le contrat CTR-KIN-2025-000001.',
    'tax',
    true
  );
