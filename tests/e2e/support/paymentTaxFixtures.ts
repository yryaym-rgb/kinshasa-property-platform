/**
 * Deterministic fixture data for the e2e suite. Shapes mirror the rows the
 * frontend reads through PostgREST (embedded relations included inline) and the
 * JSON returned by the RPCs / Edge Functions of modules 4 and 5.
 */

export const IDS = {
  tenantUser: '11111111-1111-4111-8111-111111111111',
  landlordUser: '22222222-2222-4222-8222-222222222222',
  bailleur: '33333333-3333-4333-8333-333333333333',
  logement: '44444444-4444-4444-8444-444444444444',
  contrat: '55555555-5555-4555-8555-555555555555',
  impotMarch: '66666666-6666-4666-8666-666666666661',
  impotFeb: '66666666-6666-4666-8666-666666666662',
  impotJan: '66666666-6666-4666-8666-666666666663',
} as const;

const NOW = new Date().toISOString();

export const TENANT_USER = {
  id: IDS.tenantUser,
  phone: '+243812345678',
  email: 'locataire@e2e.test',
  full_name: 'Grâce Mbuyi',
  role: 'locataire',
  commune: 'Gombe',
  address: 'Avenue de la Justice 12',
  avatar_url: null,
  kyc_status: 'verifie',
  kyc_documents: null,
  is_active: true,
  last_login_at: NOW,
  created_at: '2025-01-10T08:00:00Z',
  updated_at: NOW,
  bailleurs: [],
};

export const BAILLEUR_ROW = {
  id: IDS.bailleur,
  user_id: IDS.landlordUser,
  business_name: 'Immo Kinshasa SARL',
  tax_id: 'A1234567B',
  bank_account: null,
  mobile_money_account: '+243998765432',
  compliance_score: 82,
  total_properties: 3,
  total_revenue: 25500000,
  solde_disponible: 2550000,
  total_encaisse: 25500000,
  total_impots_dus: 340000,
  created_at: '2025-01-05T08:00:00Z',
  updated_at: NOW,
};

export const LANDLORD_USER = {
  id: IDS.landlordUser,
  phone: '+243998765432',
  email: 'bailleur@e2e.test',
  full_name: 'Jean-Pierre Kasongo',
  role: 'bailleur',
  commune: 'Gombe',
  address: 'Boulevard du 30 Juin 1',
  avatar_url: null,
  kyc_status: 'verifie',
  kyc_documents: null,
  is_active: true,
  last_login_at: NOW,
  created_at: '2025-01-05T08:00:00Z',
  updated_at: NOW,
  bailleurs: [BAILLEUR_ROW],
};

export const LOGEMENT = {
  id: IDS.logement,
  code: 'KIN-GOM-0042',
  address: 'Avenue Colonel Lukusa 42',
  commune: 'Gombe',
  type: 'Appartement',
  rooms: 3,
  loyer_mensuel: 850000,
  cover_image_url: null,
};

export const RENT = 850000;

export const CONTRAT = {
  id: IDS.contrat,
  code: 'CTR-2025-0042',
  logement_id: IDS.logement,
  bailleur_id: IDS.bailleur,
  locataire_id: IDS.tenantUser,
  loyer_mensuel: RENT,
  currency: 'CDF',
  caution: RENT * 2,
  date_debut: '2025-02-01',
  date_fin: null,
  jour_echeance: 5,
  status: 'actif',
  document_url: null,
  signed_at: '2025-01-28T10:00:00Z',
  metadata: null,
  created_at: '2025-01-28T10:00:00Z',
  updated_at: NOW,
  logement: LOGEMENT,
  bailleur: {
    id: IDS.bailleur,
    business_name: BAILLEUR_ROW.business_name,
    user: { full_name: LANDLORD_USER.full_name, phone: LANDLORD_USER.phone, email: LANDLORD_USER.email },
  },
};

export const PAYMENT_PROVIDERS = [
  ['orange_money', 'Orange Money', 'Paiement instantané', true, 1.5, 1],
  ['mpesa', 'M-Pesa', 'Paiement instantané', true, 1.5, 2],
  ['airtel_money', 'Airtel Money', 'Paiement instantané', true, 1.5, 3],
  ['card', 'Carte bancaire', 'Visa / Mastercard', false, 2.5, 4],
  ['bank_transfer', 'Virement bancaire', '1-2 jours ouvrés', false, 0, 5],
].map(([key, name, subtext, requiresPhone, fee, sort]) => ({
  id: `prov-${key}`,
  provider_key: key,
  display_name: name,
  icon_url: null,
  subtext,
  is_active: true,
  is_sandbox: true,
  supports_partial: false,
  supports_refund: key !== 'bank_transfer',
  requires_phone: requiresPhone,
  min_amount: 100,
  max_amount: 10000000,
  processing_time: key === 'bank_transfer' ? '1-2 jours' : 'instantané',
  fee_percentage: fee,
  fee_fixed: 0,
  refund_window_days: 30,
  sort_order: sort,
  config: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}));

/** Active placeholder rules — same content as supabase/seed/03_tax_rules_drc.sql. */
export const TAX_RULES = [
  {
    id: 'rule-exo',
    nom: 'Exonération micro-loyer',
    description: 'Loyers mensuels inférieurs au seuil minimum imposable (50 000 CDF) — aucun impôt dû.',
    type_logement: null,
    commune: null,
    tranche_min: 0,
    tranche_max: 49999.99,
    type_contribuable: null,
    taux: 0,
    type_taux: 'pourcentage',
    montant_fixe: null,
    mode_application: 'exclusif',
    exonere: true,
    motif_exoneration: 'Loyer inférieur au seuil minimum imposable',
    date_debut: '2024-01-01',
    date_fin: null,
    is_active: true,
    priorite: 10,
    reference_legale: 'Code des impôts RDC — seuil d’exonération des revenus locatifs (article à valider par la DGI)',
    article_loi: 'Art. XXX (à valider)',
    version: 1,
  },
  {
    id: 'rule-res',
    nom: 'Impôt sur revenus locatifs — résidentiel',
    description: 'Taux standard sur les revenus locatifs des logements résidentiels.',
    type_logement: ['Appartement', 'Studio', 'Villa'],
    commune: null,
    tranche_min: 50000,
    tranche_max: null,
    type_contribuable: null,
    taux: 0.1,
    type_taux: 'pourcentage',
    montant_fixe: null,
    mode_application: 'exclusif',
    exonere: false,
    motif_exoneration: null,
    date_debut: '2024-01-01',
    date_fin: null,
    is_active: true,
    priorite: 100,
    reference_legale: 'Code des impôts RDC — Impôt sur les revenus locatifs (IRL), taux résidentiel (article à valider)',
    article_loi: 'Art. XXX (à valider)',
    version: 1,
  },
  {
    id: 'rule-com',
    nom: 'Impôt sur revenus locatifs — commercial',
    description: 'Taux sur les locaux à usage commercial ou professionnel.',
    type_logement: ['Bureau', 'Magasin', 'Entrepôt'],
    commune: null,
    tranche_min: 50000,
    tranche_max: null,
    type_contribuable: null,
    taux: 0.15,
    type_taux: 'pourcentage',
    montant_fixe: null,
    mode_application: 'exclusif',
    exonere: false,
    motif_exoneration: null,
    date_debut: '2024-01-01',
    date_fin: null,
    is_active: true,
    priorite: 100,
    reference_legale: 'Code des impôts RDC — Impôt sur les revenus locatifs (IRL), taux locaux commerciaux (article à valider)',
    article_loi: 'Art. XXX (à valider)',
    version: 1,
  },
  {
    id: 'rule-default',
    nom: 'Impôt sur revenus locatifs — taux par défaut',
    description: 'Filet de sécurité : s’applique si aucune règle plus spécifique ne correspond.',
    type_logement: null,
    commune: null,
    tranche_min: 50000,
    tranche_max: null,
    type_contribuable: null,
    taux: 0.1,
    type_taux: 'pourcentage',
    montant_fixe: null,
    mode_application: 'exclusif',
    exonere: false,
    motif_exoneration: null,
    date_debut: '2024-01-01',
    date_fin: null,
    is_active: true,
    priorite: 900,
    reference_legale: 'Code des impôts RDC — Impôt sur les revenus locatifs, taux général (article à valider)',
    article_loi: 'Art. XXX (à valider)',
    version: 1,
  },
];

const impot = (id: string, periode: string, status: string, echeance: string, paidAt: string | null) => ({
  id,
  paiement_id: `pay-${periode}`,
  contrat_id: IDS.contrat,
  bailleur_id: IDS.bailleur,
  calcul_fiscal_id: `calc-${periode}`,
  periode,
  base_imposable: RENT,
  montant: RENT * 0.1,
  taux: 0.1,
  status,
  commune: 'Gombe',
  type_logement: 'Appartement',
  reference_legale: TAX_RULES[1]!.reference_legale,
  detail_calcul: null,
  date_echeance: echeance,
  regles_appliquees: ['rule-res'],
  recalcule_at: null,
  montant_precedent: null,
  paid_at: paidAt,
  dgi_reference: paidAt ? `DGI-${periode}` : null,
  calculated_at: `${periode}-05T09:00:00Z`,
  created_at: `${periode}-05T09:00:00Z`,
  updated_at: NOW,
  contrat: {
    id: IDS.contrat,
    code: CONTRAT.code,
    loyer_mensuel: RENT,
    logement: { code: LOGEMENT.code, type: LOGEMENT.type, commune: LOGEMENT.commune, address: LOGEMENT.address },
  },
  paiement: {
    id: `pay-${periode}`,
    reference: `PAY-${periode}-0001`,
    montant: Math.round(RENT * 1.135),
    currency: 'CDF',
    paid_at: `${periode}-05T08:55:00Z`,
    periode,
    provider: 'orange_money',
  },
  regle: {
    id: TAX_RULES[1]!.id,
    nom: TAX_RULES[1]!.nom,
    taux: TAX_RULES[1]!.taux,
    reference_legale: TAX_RULES[1]!.reference_legale,
    article_loi: TAX_RULES[1]!.article_loi,
    description: TAX_RULES[1]!.description,
  },
  calcul: {
    id: `calc-${periode}`,
    detail_calcul: [
      {
        ordre: 1,
        type: 'taux_base',
        regleId: TAX_RULES[1]!.id,
        regleNom: TAX_RULES[1]!.nom,
        description: TAX_RULES[1]!.description,
        taux: 0.1,
        montantFixe: null,
        base: RENT,
        montant: RENT * 0.1,
        cumul: RENT * 0.1,
        referenceLegale: TAX_RULES[1]!.reference_legale,
        articleLoi: TAX_RULES[1]!.article_loi,
        priorite: 100,
      },
    ],
    reference_legale: TAX_RULES[1]!.reference_legale,
    calculation_version: '1.0.0',
    created_at: `${periode}-05T09:00:00Z`,
  },
});

const yearNow = new Date().getUTCFullYear();
const monthNow = new Date().getUTCMonth() + 1;
const pad = (m: number) => String(m).padStart(2, '0');
const period = (offset: number) => {
  const d = new Date(Date.UTC(yearNow, monthNow - 1 - offset, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
const deadlineFor = (p: string) => {
  const [y, m] = p.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 15)).toISOString().slice(0, 10);
};

export const CURRENT_PERIOD = period(0);
export const IMPOTS = [
  impot(IDS.impotMarch, period(0), 'calcule', deadlineFor(period(0)), null),
  impot(IDS.impotFeb, period(1), 'en_retard', deadlineFor(period(1)), null),
  impot(IDS.impotJan, period(2), 'paye', deadlineFor(period(2)), `${period(2)}-20T10:00:00Z`),
];

export const TAX_SUMMARY = {
  periode: '',
  totalCalcule: RENT * 0.1 * 3,
  totalPaye: RENT * 0.1,
  totalDu: RENT * 0.1 * 2,
  totalEnRetard: RENT * 0.1,
  baseImposable: RENT * 3,
  nbObligations: 3,
  nbPayees: 1,
  parPeriode: [
    { periode: period(2), calcule: RENT * 0.1, paye: RENT * 0.1, du: 0 },
    { periode: period(1), calcule: RENT * 0.1, paye: 0, du: RENT * 0.1 },
    { periode: period(0), calcule: RENT * 0.1, paye: 0, du: RENT * 0.1 },
  ],
};

export const COMPLIANCE = {
  score: 82,
  level: 'good',
  components: [
    { key: 'payments', label: 'Ponctualité des loyers', score: 30, max: 35 },
    { key: 'taxes', label: 'Impôts réglés', score: 17, max: 25 },
    { key: 'kyc', label: 'Identité vérifiée', score: 25, max: 25 },
    { key: 'properties', label: 'Biens déclarés', score: 10, max: 15 },
  ],
  stats: { paiements: 12, paiementsPonctuels: 11, impots: 3, impotsRegles: 1, biens: 3 },
};
