/**
 * Tax rule loading, caching and applicability.
 *
 * Rules live in `regles_fiscales` (migration 009). They are loaded once per
 * isolate and cached for 5 minutes; `invalidateRulesCache()` is called by
 * tax-recalculate after admins change rules.
 *
 * Rate semantics: `taux` is a FRACTION (0.10 = 10 %).
 */

import type { DbClient } from '../db.ts';
import { DbError } from '../db.ts';

export type TypeTaux = 'pourcentage' | 'fixe';
export type ModeApplication = 'exclusif' | 'cumulatif';

export interface TaxRule {
  id: string;
  nom: string;
  description: string | null;
  type_logement: string[] | null;
  commune: string[] | null;
  tranche_min: number | null;
  tranche_max: number | null;
  type_contribuable: string[] | null;
  taux: number;
  type_taux: TypeTaux;
  montant_fixe: number | null;
  mode_application: ModeApplication;
  exonere: boolean;
  motif_exoneration: string | null;
  date_debut: string;
  date_fin: string | null;
  is_active: boolean;
  priorite: number;
  reference_legale: string;
  article_loi: string | null;
  version: number;
}

export interface RuleContext {
  typeLogement: string;
  commune: string;
  montant: number;
  typeContribuable: string;
  /** ISO date (YYYY-MM-DD) of the transaction. */
  date: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

interface RulesCache {
  rules: TaxRule[];
  loadedAt: number;
}

let cache: RulesCache | null = null;

export function invalidateRulesCache(): void {
  cache = null;
}

/** Test seam: inject rules without a database. */
export function primeRulesCache(rules: TaxRule[]): void {
  cache = { rules, loadedAt: Date.now() };
}

export async function loadRules(db: DbClient, options: { force?: boolean } = {}): Promise<TaxRule[]> {
  if (!options.force && cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.rules;

  const { data, error } = await db
    .from('regles_fiscales')
    .select('*')
    .eq('is_active', true)
    .order('priorite', { ascending: true });
  if (error) throw new DbError('regles_fiscales.select', error.message);

  const rules = (data ?? []).map(normalizeRule);
  cache = { rules, loadedAt: Date.now() };
  return rules;
}

/** Postgres numerics arrive as strings through PostgREST — coerce once. */
export function normalizeRule(row: Record<string, unknown>): TaxRule {
  return {
    id: String(row.id),
    nom: String(row.nom),
    description: (row.description as string | null) ?? null,
    type_logement: (row.type_logement as string[] | null) ?? null,
    commune: (row.commune as string[] | null) ?? null,
    tranche_min: row.tranche_min === null || row.tranche_min === undefined ? null : Number(row.tranche_min),
    tranche_max: row.tranche_max === null || row.tranche_max === undefined ? null : Number(row.tranche_max),
    type_contribuable: (row.type_contribuable as string[] | null) ?? null,
    taux: Number(row.taux ?? 0),
    type_taux: (row.type_taux as TypeTaux) ?? 'pourcentage',
    montant_fixe: row.montant_fixe === null || row.montant_fixe === undefined ? null : Number(row.montant_fixe),
    mode_application: (row.mode_application as ModeApplication) ?? 'exclusif',
    exonere: Boolean(row.exonere),
    motif_exoneration: (row.motif_exoneration as string | null) ?? null,
    date_debut: String(row.date_debut),
    date_fin: (row.date_fin as string | null) ?? null,
    is_active: row.is_active === undefined ? true : Boolean(row.is_active),
    priorite: Number(row.priorite ?? 100),
    reference_legale: String(row.reference_legale ?? ''),
    article_loi: (row.article_loi as string | null) ?? null,
    version: Number(row.version ?? 1),
  };
}

function isEmpty(arr: string[] | null | undefined): boolean {
  return !arr || arr.length === 0;
}

/** Mirrors `public.regle_fiscale_applicable` (migration 009). */
export function isRuleApplicable(rule: TaxRule, ctx: RuleContext): boolean {
  if (!rule.is_active) return false;
  if (rule.date_debut > ctx.date) return false;
  if (rule.date_fin && rule.date_fin < ctx.date) return false;
  if (!isEmpty(rule.type_logement) && !rule.type_logement!.includes(ctx.typeLogement)) return false;
  if (!isEmpty(rule.commune) && !rule.commune!.includes(ctx.commune)) return false;
  if (!isEmpty(rule.type_contribuable) && !rule.type_contribuable!.includes(ctx.typeContribuable)) return false;
  if (rule.tranche_min !== null && ctx.montant < rule.tranche_min) return false;
  if (rule.tranche_max !== null && ctx.montant > rule.tranche_max) return false;
  return true;
}

/** Mirrors `public.regle_fiscale_specificite`: more targeted rules win ties. */
export function specificity(rule: TaxRule): number {
  return (
    (isEmpty(rule.commune) ? 0 : 4) +
    (isEmpty(rule.type_logement) ? 0 : 2) +
    (rule.tranche_min !== null || rule.tranche_max !== null ? 1 : 0) +
    (isEmpty(rule.type_contribuable) ? 0 : 1)
  );
}

/** Priority ASC, then specificity DESC, then most recent date_debut. */
export function compareRules(a: TaxRule, b: TaxRule): number {
  if (a.priorite !== b.priorite) return a.priorite - b.priorite;
  const sa = specificity(a);
  const sb = specificity(b);
  if (sa !== sb) return sb - sa;
  return b.date_debut.localeCompare(a.date_debut);
}

export function selectApplicableRules(rules: TaxRule[], ctx: RuleContext): TaxRule[] {
  return rules.filter((r) => isRuleApplicable(r, ctx)).sort(compareRules);
}
