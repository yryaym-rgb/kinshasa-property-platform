/**
 * Frontend tax service.
 *
 * Two very different things live here on purpose:
 *
 * 1. `estimateBreakdown` — a synchronous, local ESTIMATE used by the payment
 *    wizard to show a total before the tenant confirms. It uses the default
 *    residential rate and is clearly flagged `estimated: true`.
 *
 * 2. Everything else — the AUTHORITATIVE fiscal engine, reached through the
 *    `tax-calculate` Edge Function and the SQL RPCs of migrations 009/010.
 *    The frontend never computes a tax that ends up in `impots`.
 */

import { supabase } from '@/config/supabase';
import type {
  AggregateRevenue,
  Anomaly,
  AnomalyFilters,
  AnomalyStatus,
  ComplianceScore,
  Forecast,
  ForecastPoint,
  MonthlySeriesPoint,
  RegleFiscale,
  RevenueFilters,
  SimulationResult,
  TaxCalculationInput,
  TaxCalculationOutput,
  TaxDeadline,
  TaxDetail,
  TaxHistoryRow,
  TaxRecalculateRequest,
  TaxRecalculateResponse,
  TaxSummary,
  TypeContribuable,
} from '@/types/tax';
import { mapEdgeError } from '@/utils/paymentErrors';

// ─── Local estimate (payment wizard) ──────────────────────────────────────

export interface TaxBreakdownInput {
  rentAmount: number;
  paymentMethod?: 'mobile_money' | 'card' | 'bank';
  /** Provider fee percentage from `payment_providers.fee_percentage` (e.g. 1.5). */
  providerFeePercentage?: number;
  providerFeeFixed?: number;
  /** Override the default estimated rate (fraction). */
  taxRate?: number;
}

export interface TaxBreakdown {
  rentAmount: number;
  /** Fraction (0.10). */
  taxRate: number;
  taxAmount: number;
  platformFeeRate: number;
  platformFee: number;
  mobileMoneyFeeRate: number;
  mobileMoneyFee: number;
  total: number;
  /** True until the engine's authoritative value replaces it. */
  estimated: boolean;
  legalReference?: string;
}

/** @deprecated alias kept for Module 2 screens */
export type TaxCalculationResult = TaxBreakdown;

export const PLATFORM_FEE_RATE = 0.02;
export const DEFAULT_MOBILE_MONEY_FEE_RATE = 0.015;
/** Default residential rate used for the pre-confirmation estimate only. */
export const DEFAULT_ESTIMATED_TAX_RATE = 0.1;

export function estimateBreakdown(input: TaxBreakdownInput): TaxBreakdown {
  const rentAmount = Math.max(0, Math.round(input.rentAmount));
  const taxRate = input.taxRate ?? DEFAULT_ESTIMATED_TAX_RATE;
  const taxAmount = Math.round(rentAmount * taxRate);
  const platformFee = Math.round(rentAmount * PLATFORM_FEE_RATE);

  const feeRate =
    input.providerFeePercentage !== undefined
      ? input.providerFeePercentage / 100
      : input.paymentMethod === 'mobile_money'
        ? DEFAULT_MOBILE_MONEY_FEE_RATE
        : 0;
  const mobileMoneyFee = Math.round(rentAmount * feeRate) + Math.round(input.providerFeeFixed ?? 0);

  return {
    rentAmount,
    taxRate,
    taxAmount,
    platformFeeRate: PLATFORM_FEE_RATE,
    platformFee,
    mobileMoneyFeeRate: feeRate,
    mobileMoneyFee,
    total: rentAmount + taxAmount + platformFee + mobileMoneyFee,
    estimated: true,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function invoke<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body: body as Record<string, unknown> });
  if (error) throw await mapEdgeError(error);
  return data as T;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).setHours(0, 0, 0, 0);
  const to = new Date(toIso).setHours(0, 0, 0, 0);
  return Math.round((to - from) / 86_400_000);
}

const COMMERCIAL_TYPES = new Set(['Bureau', 'Magasin', 'Entrepôt']);
export function isCommercialType(type: string): boolean {
  return COMMERCIAL_TYPES.has(type);
}

// ─── Service ──────────────────────────────────────────────────────────────

export const taxService = {
  estimateBreakdown,

  /**
   * Authoritative calculation by the fiscal engine (Edge Function
   * `tax-calculate`). Landlords may only call it in simulation mode.
   */
  async calculateTax(params: TaxCalculationInput): Promise<TaxCalculationOutput> {
    return invoke<TaxCalculationOutput>('tax-calculate', {
      ...params,
      typeContribuable: params.typeContribuable ?? 'personne_physique',
      simulation: params.simulation ?? true,
      persist: params.persist ?? true,
    });
  },

  /** What-if simulator: base scenario + ±10 % / ±25 % variations + matching rules. */
  async simulate(params: {
    montantBrut: number;
    typeLogement: string;
    commune: string;
    typeContribuable?: TypeContribuable;
    bailleurId?: string | null;
  }): Promise<SimulationResult> {
    const typeContribuable = params.typeContribuable ?? 'personne_physique';
    const base = await this.calculateTax({ ...params, typeContribuable, simulation: true, persist: true });

    const variations: Array<[string, number]> = [
      ['Loyer −25 %', 0.75],
      ['Loyer −10 %', 0.9],
      ['Loyer +10 %', 1.1],
      ['Loyer +25 %', 1.25],
    ];
    const scenarios = await Promise.all(
      variations.map(async ([label, factor]) => {
        const montantBrut = Math.round(params.montantBrut * factor);
        const result = await this.calculateTax({ ...params, montantBrut, typeContribuable, simulation: true, persist: false });
        return { label, montantBrut, result };
      }),
    );

    const regles = await this.getApplicableRules({ ...params, typeContribuable });

    return {
      input: { montantBrut: params.montantBrut, typeLogement: params.typeLogement, commune: params.commune, typeContribuable },
      base,
      scenarios,
      regles,
      computedAt: new Date().toISOString(),
    };
  },

  async getApplicableRules(params: { montantBrut: number; typeLogement: string; commune: string; typeContribuable?: TypeContribuable; date?: string }): Promise<RegleFiscale[]> {
    const { data, error } = await supabase.rpc('regles_fiscales_applicables', {
      p_type_logement: params.typeLogement,
      p_commune: params.commune,
      p_montant: params.montantBrut,
      p_type_contribuable: params.typeContribuable ?? 'personne_physique',
      p_date: (params.date ?? new Date().toISOString()).slice(0, 10),
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as RegleFiscale[];
  },

  async getActiveRules(): Promise<RegleFiscale[]> {
    const { data, error } = await supabase
      .from('regles_fiscales')
      .select('*')
      .eq('is_active', true)
      .order('priorite', { ascending: true })
      .order('date_debut', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  // ── Landlord ─────────────────────────────────────────────────────────

  async getTaxSummary(bailleurId: string, period?: string): Promise<TaxSummary> {
    const { data, error } = await supabase.rpc('get_bailleur_tax_summary', {
      p_bailleur_id: bailleurId,
      p_periode_prefix: period ?? null,
    });
    if (error) throw new Error(error.message);
    const raw = (data ?? {}) as Record<string, unknown>;
    return {
      bailleurId,
      periode: String(raw.periode ?? period ?? ''),
      totalCalcule: num(raw.totalCalcule),
      totalPaye: num(raw.totalPaye),
      totalDu: num(raw.totalDu),
      totalEnRetard: num(raw.totalEnRetard),
      baseImposable: num(raw.baseImposable),
      nbObligations: num(raw.nbObligations),
      nbPayees: num(raw.nbPayees),
      parPeriode: ((raw.parPeriode as Array<Record<string, unknown>> | null) ?? []).map((p) => ({
        periode: String(p.periode),
        calcule: num(p.calcule),
        paye: num(p.paye),
        du: num(p.du),
      })),
    };
  },

  async getComplianceScore(bailleurId: string): Promise<ComplianceScore> {
    const { data, error } = await supabase.rpc('get_compliance_breakdown', { p_bailleur_id: bailleurId });
    if (error) throw new Error(error.message);
    const raw = (data ?? {}) as Record<string, unknown>;
    const stats = (raw.stats as Record<string, unknown> | undefined) ?? {};
    return {
      score: num(raw.score),
      level: (raw.level as ComplianceScore['level']) ?? 'critical',
      components: ((raw.components as ComplianceScore['components'] | null) ?? []).map((c) => ({ ...c, score: num(c.score), max: num(c.max) })),
      stats: {
        paiements: num(stats.paiements),
        paiementsPonctuels: num(stats.paiementsPonctuels),
        impots: num(stats.impots),
        impotsRegles: num(stats.impotsRegles),
        biens: num(stats.biens),
      },
    };
  },

  async getUpcomingDeadlines(bailleurId: string, limit = 12): Promise<TaxDeadline[]> {
    const { data, error } = await supabase
      .from('impots')
      .select('id, periode, montant, date_echeance, status, commune, contrat:contrats(logement:logements(code))')
      .eq('bailleur_id', bailleurId)
      .in('status', ['calcule', 'declare', 'en_retard'])
      .order('date_echeance', { ascending: true, nullsFirst: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    const today = new Date().toISOString();
    return (data ?? []).map((row) => {
      const contrat = row.contrat as unknown as { logement?: { code?: string } | null } | null;
      const echeance = row.date_echeance ?? `${row.periode}-15`;
      return {
        impotId: row.id,
        periode: row.periode,
        montant: num(row.montant),
        dateEcheance: echeance,
        joursRestants: daysBetween(today, echeance),
        status: row.status,
        logementCode: contrat?.logement?.code ?? null,
        commune: row.commune,
      };
    });
  },

  async getTaxHistory(bailleurId: string, filters?: { year?: number | 'all'; status?: string }): Promise<TaxHistoryRow[]> {
    let query = supabase
      .from('impots')
      .select('*, contrat:contrats(logement:logements(code)), paiement:paiements(reference)')
      .eq('bailleur_id', bailleurId)
      .order('periode', { ascending: false });
    if (filters?.year && filters.year !== 'all') {
      query = query.gte('periode', `${filters.year}-01`).lte('periode', `${filters.year}-12`);
    }
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status as TaxHistoryRow['status']);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const { contrat, paiement, ...impot } = row as typeof row & {
        contrat: { logement?: { code?: string } | null } | null;
        paiement: { reference?: string } | null;
      };
      return { ...impot, logementCode: contrat?.logement?.code ?? null, paiementReference: paiement?.reference ?? null };
    });
  },

  async getTaxDetail(impotId: string): Promise<TaxDetail> {
    const { data, error } = await supabase
      .from('impots')
      .select(
        `*,
         paiement:paiements(id, reference, montant, currency, paid_at, periode, provider),
         contrat:contrats(id, code, loyer_mensuel, logement:logements(code, type, commune, address)),
         regle:regles_fiscales(id, nom, taux, reference_legale, article_loi, description),
         calcul:calculs_fiscaux!impots_calcul_fiscal_id_fkey(id, detail_calcul, reference_legale, calculation_version, created_at)`,
      )
      .eq('id', impotId)
      .single();
    if (error) throw new Error(error.message);
    return data as unknown as TaxDetail;
  },

  // ── DGI ──────────────────────────────────────────────────────────────

  async getAggregateRevenue(filters: RevenueFilters): Promise<AggregateRevenue> {
    const { data, error } = await supabase.rpc('get_fiscal_dashboard', { p_from: filters.from, p_to: filters.to });
    if (error) throw new Error(error.message);
    const raw = (data ?? {}) as Record<string, unknown>;
    const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    return {
      period: (raw.period as AggregateRevenue['period']) ?? filters,
      totalRevenue: num(raw.totalRevenue),
      previousRevenue: num(raw.previousRevenue),
      collectedRevenue: num(raw.collectedRevenue),
      rentVolume: num(raw.rentVolume),
      paymentsCount: num(raw.paymentsCount),
      byCommune: arr<AggregateRevenue['byCommune'][number]>(raw.byCommune).map((r) => ({ ...r, montant: num(r.montant), count: num(r.count) })),
      byPropertyType: arr<AggregateRevenue['byPropertyType'][number]>(raw.byPropertyType).map((r) => ({ ...r, montant: num(r.montant), count: num(r.count) })),
      topContributors: arr<AggregateRevenue['topContributors'][number]>(raw.topContributors).map((r) => ({ ...r, montant: num(r.montant), nbPaiements: num(r.nbPaiements), complianceScore: num(r.complianceScore) })),
      complianceDistribution: arr<AggregateRevenue['complianceDistribution'][number]>(raw.complianceDistribution).map((r) => ({ ...r, count: num(r.count) })),
      registrationGrowth: arr<AggregateRevenue['registrationGrowth'][number]>(raw.registrationGrowth).map((r) => ({ ...r, bailleurs: num(r.bailleurs), logements: num(r.logements) })),
      anomaliesOpen: num(raw.anomaliesOpen),
      anomaliesBySeverity: (raw.anomaliesBySeverity as AggregateRevenue['anomaliesBySeverity']) ?? {},
      registeredProperties: num(raw.registeredProperties),
      registeredLandlords: num(raw.registeredLandlords),
      activeContracts: num(raw.activeContracts),
      averageRent: num(raw.averageRent),
      complianceRate: num(raw.complianceRate),
    };
  },

  async getAnomalies(filters: AnomalyFilters = {}): Promise<Anomaly[]> {
    let query = supabase
      .from('anomalies_fiscales')
      .select(
        `*,
         bailleur:bailleurs(id, business_name, user:users(full_name, commune)),
         logement:logements(id, code, address, commune),
         contrat:contrats(id, code),
         paiement:paiements(id, reference)`,
      )
      .order('detected_at', { ascending: false })
      .limit(filters.limit ?? 200);

    const statut = filters.statut ?? 'open';
    if (statut === 'open') query = query.in('statut', ['detected', 'escalated']);
    else if (statut !== 'all') query = query.eq('statut', statut);
    if (filters.severite) query = query.eq('severite', filters.severite);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.bailleurId) query = query.eq('bailleur_id', filters.bailleurId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Anomaly[];
  },

  async updateAnomalyStatus(id: string, statut: AnomalyStatus, commentaire?: string): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('anomalies_fiscales')
      .update({ statut, commentaire: commentaire ?? null, traite_par: auth.user?.id ?? null, traite_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  /** Runs the SQL detector (staff only) and returns the number of new anomalies. */
  async runAnomalyDetection(): Promise<number> {
    const { data, error } = await supabase.rpc('detect_fiscal_anomalies');
    if (error) throw new Error(error.message);
    return num(data);
  },

  async getMonthlySeries(months = 24): Promise<MonthlySeriesPoint[]> {
    const { data, error } = await supabase.rpc('get_fiscal_monthly_series', { p_months: months });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      month: r.month,
      impots: num(r.impots),
      loyers: num(r.loyers),
      paiements: num(r.paiements),
      nouveauxContrats: num(r.nouveaux_contrats),
    }));
  },

  /**
   * Revenue forecast — transparent, explainable model (no black box):
   * linear trend on the last 12 months of tax revenue, blended with the
   * average level, then scaled by the compliance rate for the base scenario.
   * Optimistic / pessimistic apply ±growth deltas; the confidence band is
   * ±1.28 σ of the historical residuals (≈ 80 %).
   */
  async getForecast(months = 12): Promise<Forecast> {
    const [history, dashboard] = await Promise.all([
      this.getMonthlySeries(24),
      this.getAggregateRevenue({ from: monthStart(-11), to: new Date().toISOString().slice(0, 10) }),
    ]);
    return buildForecast(history, months, {
      registeredProperties: dashboard.registeredProperties,
      activeContracts: dashboard.activeContracts,
      averageRent: dashboard.averageRent,
      complianceRate: dashboard.complianceRate,
    });
  },

  // ── Admin ────────────────────────────────────────────────────────────

  async recalculate(params: TaxRecalculateRequest): Promise<TaxRecalculateResponse> {
    return invoke<TaxRecalculateResponse>('tax-recalculate', params);
  },
};

// ─── Forecast model (pure, unit-tested) ───────────────────────────────────

function monthStart(offsetMonths: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return d.toISOString().slice(0, 10);
}

function addMonths(yyyyMm: string, n: number): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function buildForecast(
  history: MonthlySeriesPoint[],
  months: number,
  factors: { registeredProperties: number; activeContracts: number; averageRent: number; complianceRate: number },
): Forecast {
  const series = history.map((h) => h.impots);
  const recent = series.slice(-12);
  const n = recent.length;
  const lastMonth = history[history.length - 1]?.month ?? new Date().toISOString().slice(0, 7);

  // Least squares on the last 12 points.
  let slope = 0;
  let intercept = 0;
  if (n >= 2) {
    const xs = recent.map((_, i) => i);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = recent.reduce((a, b) => a + b, 0) / n;
    const sxx = xs.reduce((acc, x) => acc + (x - meanX) ** 2, 0);
    const sxy = xs.reduce((acc, x, i) => acc + (x - meanX) * ((recent[i] ?? 0) - meanY), 0);
    slope = sxx === 0 ? 0 : sxy / sxx;
    intercept = meanY - slope * meanX;
  } else if (n === 1) {
    intercept = recent[0] ?? 0;
  }

  const average = n > 0 ? recent.reduce((a, b) => a + b, 0) / n : 0;
  const residuals = recent.map((y, i) => y - (intercept + slope * i));
  const sigma = n > 1 ? Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / (n - 1)) : average * 0.2;
  const monthlyGrowthRate = average > 0 ? slope / average : 0;
  const complianceFactor = factors.complianceRate > 0 ? 0.85 + 0.15 * (factors.complianceRate / 100) : 1;

  const projection: ForecastPoint[] = [];
  for (let k = 1; k <= months; k++) {
    const trend = intercept + slope * (n - 1 + k);
    const base = Math.max(0, Math.round((0.7 * trend + 0.3 * average) * complianceFactor));
    const optimistic = Math.max(0, Math.round(base * (1 + 0.05 * k * 0.5 + 0.1)));
    const pessimistic = Math.max(0, Math.round(base * Math.max(0.4, 1 - 0.04 * k * 0.5 - 0.1)));
    const band = 1.28 * sigma * Math.sqrt(k);
    projection.push({
      month: addMonths(lastMonth, k),
      base,
      optimistic,
      pessimistic,
      lower: Math.max(0, Math.round(base - band)),
      upper: Math.round(base + band),
    });
  }

  const sum = (key: 'base' | 'optimistic' | 'pessimistic') => projection.reduce((a, p) => a + p[key], 0);
  return {
    history,
    projection,
    factors: { ...factors, monthlyGrowthRate: Math.round(monthlyGrowthRate * 10000) / 10000, averageMonthlyTax: Math.round(average) },
    totals: { base: sum('base'), optimistic: sum('optimistic'), pessimistic: sum('pessimistic') },
    generatedAt: new Date().toISOString(),
  };
}
