-- =============================================================================
-- eLoyer Kinshasa — Seed: 24 Communes
-- =============================================================================

INSERT INTO public.communes (name, code) VALUES
  ('Gombe',         'GOM'),
  ('Lingwala',      'LIN'),
  ('Kinshasa',      'KIN'),
  ('Kalamu',        'KAL'),
  ('Bandalungwa',   'BAN'),
  ('Barumbu',       'BAR'),
  ('Lemba',         'LEM'),
  ('Limete',        'LIM'),
  ('Matete',        'MAT'),
  ('Ngiri-Ngiri',   'NGI'),
  ('Makala',        'MAK'),
  ('Selembao',      'SEL'),
  ('Bumbu',         'BUM'),
  ('Mont-Ngafula',  'MNG'),
  ('Ndjili',        'NDJ'),
  ('Kimbanseke',    'KIM'),
  ('Kisenso',       'KIS'),
  ('Masina',        'MAS'),
  ('Nsele',         'NSE'),
  ('Maluku',        'MAL'),
  ('Ngaliema',      'NGA'),
  ('Kintambo',      'KNT'),
  ('Kasa-Vubu',     'KAS'),
  ('Mont-Amba',     'MTA')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name;
