/**
 * Tax (fiscal engine) domain types shared by the frontend and the Edge
 * Functions (`supabase/functions/_shared/tax/*`). Request/response contracts of
 * `tax-calculate` / `tax-recalculate` and the view models of the landlord and
 * DGI dashboards live here.
 */

import type { AnomalieFiscale, Impot, RegleFiscale } from './database.types';

export type { AnomalieFiscale, Impot, RegleFiscale };

// ─── tax-calculate contract (mirror of _shared/tax/calculator.ts) ──────────

export interface TaxCalculationInput {
  /** Gross rent for the period — the tax base. */
  montantBrut: number;
  /** Value of the `property_type` enum (Appartement, Studio, Villa, Bureau, Magasin, Entrepôt). */
  typeLogement: string;
  commune: string;
  typeContribuable?: TypeContribuable;
  /** ISO date or datetime of the transaction. Defaults to now. */
  dateTransaction?: string;
  bailleurId?: string | null;
  paiementId?: string | null;
  contratId?: string | null;
  periode?: string | null;
  /** Simulation: persisted as such, never tied to a payment. */
  simulation?: boolean;
  /** Persist to calculs_fiscaux (default true). */
  persist?: boolean;
}

export type TypeContribuable = 'personne_physique' | 'personne_morale';

export type CalculationStepKind = 'exoneration' | 'taux_base' | 'surtaxe' | 'aucune_regle';

export interface CalculationDetail {
  ordre: number;
  type: CalculationStepKind;
  regleId: string | null;
  regleNom: string;
  description: string;
  /** Fraction applied on this line (null for fixed amounts / exemptions). */
  taux: number | null;
  montantFixe: number | null;
  base: number;
  montant: number;
  cumul: number;
  referenceLegale: string;
  articleLoi: string | null;
  priorite: number;
}

export interface LegalReference {
  ruleId: string;
  ruleName: string;
  reference: string;
  article: string | null;
  pendingValidation: boolean;
}

export interface TaxCalculationOutput {
  baseImposable: number;
  montantImpot: number;
  /** Effective rate as a PERCENTAGE (10 = 10 %). */
  tauxApplique: number;
  /** Effective rate as a fraction (0.10) — what `impots.taux` stores. */
  tauxEffectif: number;
  exonere: boolean;
  motifExoneration: string | null;
  reglesAppliquees: string[];
  referenceLegale: string;
  references: LegalReference[];
  detail: CalculationDetail[];
  calculationVersion: string;
  dateEcheance: string | null;
  calculId?: string;
}

// ─── tax-recalculate contract ──────────────────────────────────────────────

export interface TaxRecalculateRequest {
  motif: string;
  dryRun?: boolean;
  periodeFrom?: string;
  periodeTo?: string;
  bailleurId?: string;
  commune?: string;
  limit?: number;
}

export interface TaxRecalculateDelta {
  impotId: string;
  paiementId: string | null;
  bailleurId: string | null;
  periode: string;
  ancien: number;
  nouveau: number;
  delta: number;
  regles: string[];
  referenceLegale: string;
}

export interface TaxRecalculateResponse {
  runId: string;
  dryRun: boolean;
  examines: number;
  modifies: number;
  deltaTotal: number;
  report: TaxRecalculateDelta[];
}

// ─── Landlord view models ─────────────────────────────────────────────────

export interface TaxPeriodSummary {
  periode: string;
  calcule: number;
  paye: number;
  du: number;
}

export interface TaxSummary {
  bailleurId: string;
  periode: string;
  totalCalcule: number;
  totalPaye: number;
  totalDu: number;
  totalEnRetard: number;
  baseImposable: number;
  nbObligations: number;
  nbPayees: number;
  parPeriode: TaxPeriodSummary[];
}

export type ComplianceLevel = 'excellent' | 'good' | 'warning' | 'critical';

export interface ComplianceComponent {
  key: 'kyc' | 'payments' | 'taxes' | 'properties';
  label: string;
  score: number;
  max: number;
}

export interface ComplianceScore {
  score: number;
  level: ComplianceLevel;
  components: ComplianceComponent[];
  stats: {
    paiements: number;
    paiementsPonctuels: number;
    impots: number;
    impotsRegles: number;
    biens: number;
  };
}

export interface TaxDeadline {
  impotId: string;
  periode: string;
  montant: number;
  dateEcheance: string;
  /** Negative when overdue. */
  joursRestants: number;
  status: Impot['status'];
  logementCode: string | null;
  commune: string | null;
}

export interface TaxDetail extends Impot {
  paiement: {
    id: string;
    reference: string;
    montant: number;
    currency: string;
    paid_at: string | null;
    periode: string;
    provider: string | null;
  } | null;
  contrat: {
    id: string;
    code: string;
    loyer_mensuel: number;
    logement: { code: string; type: string; commune: string; address: string } | null;
  } | null;
  regle: Pick<RegleFiscale, 'id' | 'nom' | 'taux' | 'reference_legale' | 'article_loi' | 'description'> | null;
  calcul: {
    id: string;
    detail_calcul: CalculationDetail[] | null;
    reference_legale: string | null;
    calculation_version: string;
    created_at: string;
  } | null;
}

export interface TaxHistoryRow extends Impot {
  logementCode: string | null;
  paiementReference: string | null;
}

// ─── Simulator ────────────────────────────────────────────────────────────

export interface SimulationScenario {
  label: string;
  montantBrut: number;
  result: TaxCalculationOutput;
}

export interface SimulationResult {
  input: Required<Pick<TaxCalculationInput, 'montantBrut' | 'typeLogement' | 'commune' | 'typeContribuable'>>;
  base: TaxCalculationOutput;
  scenarios: SimulationScenario[];
  /** Rules that match the input (same ordering as the engine). */
  regles: RegleFiscale[];
  computedAt: string;
}

// ─── DGI view models ──────────────────────────────────────────────────────

export interface RevenueFilters {
  from: string; // ISO date
  to: string;
}

export interface AggregateRevenue {
  period: { from: string; to: string };
  totalRevenue: number;
  previousRevenue: number;
  collectedRevenue: number;
  rentVolume: number;
  paymentsCount: number;
  byCommune: Array<{ commune: string; montant: number; count: number }>;
  byPropertyType: Array<{ type: string; montant: number; count: number }>;
  topContributors: Array<{
    bailleurId: string;
    nom: string;
    commune: string | null;
    montant: number;
    nbPaiements: number;
    complianceScore: number;
    complianceLevel: ComplianceLevel;
  }>;
  complianceDistribution: Array<{ level: ComplianceLevel; count: number }>;
  registrationGrowth: Array<{ month: string; bailleurs: number; logements: number }>;
  anomaliesOpen: number;
  anomaliesBySeverity: Partial<Record<AnomalySeverity, number>>;
  registeredProperties: number;
  registeredLandlords: number;
  activeContracts: number;
  averageRent: number;
  complianceRate: number;
}

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export type AnomalyStatus = 'detected' | 'reviewed' | 'escalated' | 'dismissed';

/** Types emitted by `detect_fiscal_anomalies()` (migration 010) and payment-refund. */
export type AnomalyType =
  | 'loyer_sous_evalue'
  | 'occupe_sans_contrat'
  | 'portefeuille_faible_revenu'
  | 'paiement_sans_contrat_actif'
  | 'doublon_logement'
  | 'changements_compte_frequents'
  | 'refund_after_tax_paid';

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  loyer_sous_evalue: 'Loyer déclaré anormalement bas',
  occupe_sans_contrat: 'Logement occupé sans contrat',
  portefeuille_faible_revenu: 'Nombreux biens, faibles revenus',
  paiement_sans_contrat_actif: 'Paiement sans contrat actif',
  doublon_logement: 'Doublon d’enregistrement de logement',
  changements_compte_frequents: 'Changements de compte fréquents',
  refund_after_tax_paid: 'Remboursement après impôt reversé',
};

export interface AnomalyFilters {
  statut?: AnomalyStatus | 'open' | 'all';
  severite?: AnomalySeverity;
  type?: AnomalyType | string;
  bailleurId?: string;
  limit?: number;
}

export interface Anomaly extends AnomalieFiscale {
  bailleur?: { id: string; business_name: string | null; user: { full_name: string; commune: string | null } | null } | null;
  logement?: { id: string; code: string; address: string; commune: string } | null;
  contrat?: { id: string; code: string } | null;
  paiement?: { id: string; reference: string } | null;
}

export interface MonthlySeriesPoint {
  month: string;
  impots: number;
  loyers: number;
  paiements: number;
  nouveauxContrats: number;
}

export type ForecastScenario = 'pessimistic' | 'base' | 'optimistic';

export interface ForecastPoint {
  month: string;
  base: number;
  optimistic: number;
  pessimistic: number;
  /** 80 % confidence interval around the base scenario. */
  lower: number;
  upper: number;
}

export interface Forecast {
  history: MonthlySeriesPoint[];
  projection: ForecastPoint[];
  factors: {
    registeredProperties: number;
    activeContracts: number;
    averageRent: number;
    complianceRate: number;
    monthlyGrowthRate: number;
    averageMonthlyTax: number;
  };
  totals: Record<ForecastScenario, number>;
  generatedAt: string;
}

// ─── Plain-French explanations (mirror of _shared/tax/legalRef.ts) ────────

export const TAX_EXPLANATIONS = {
  baseImposable:
    "La base imposable est le loyer brut mensuel perçu, tel qu'indiqué dans le contrat de bail enregistré sur eLoyer.",
  tauxResidentiel:
    'Les logements à usage d’habitation (appartement, studio, villa) sont soumis au taux résidentiel de l’impôt sur les revenus locatifs.',
  tauxCommercial:
    'Les locaux à usage commercial ou professionnel (bureau, magasin, entrepôt) sont soumis à un taux plus élevé.',
  exoneration:
    'Les loyers inférieurs au seuil minimum imposable sont exonérés : aucun impôt n’est dû, mais le paiement reste enregistré.',
  cumul:
    'Certaines communes peuvent appliquer une taxe additionnelle qui s’ajoute au taux de base. Elle apparaît sur une ligne distincte.',
  echeance:
    'L’impôt calculé sur un loyer doit être reversé à la DGI au plus tard le 15 du mois suivant la période concernée.',
  retenue:
    'Sur eLoyer, l’impôt est prélevé automatiquement au moment du paiement du loyer : le bailleur reçoit le loyer net, la DGI reçoit l’impôt.',
} as const;

export const COMPLIANCE_COLORS: Record<ComplianceLevel, { label: string; text: string; bg: string; hex: string }> = {
  excellent: { label: 'Excellent', text: 'text-emerald-700', bg: 'bg-emerald-100', hex: '#059669' },
  good: { label: 'Bon', text: 'text-lime-700', bg: 'bg-lime-100', hex: '#65a30d' },
  warning: { label: 'À surveiller', text: 'text-amber-700', bg: 'bg-amber-100', hex: '#d97706' },
  critical: { label: 'Critique', text: 'text-red-700', bg: 'bg-red-100', hex: '#dc2626' },
};

export function complianceLevelFromScore(score: number): ComplianceLevel {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'warning';
  return 'critical';
}

export const TAX_STATUS_LABELS: Record<Impot['status'], string> = {
  calcule: 'Calculé',
  declare: 'Déclaré',
  paye: 'Payé',
  en_retard: 'En retard',
  exonere: 'Exonéré',
  annule: 'Annulé',
};

export const ANOMALY_SEVERITY_LABELS: Record<AnomalySeverity, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Élevée',
  critical: 'Critique',
};

export const ANOMALY_STATUS_LABELS: Record<AnomalyStatus, string> = {
  detected: 'Détectée',
  reviewed: 'Examinée',
  escalated: 'Escaladée',
  dismissed: 'Écartée',
};
