/**
 * Tax calculator — the single algorithm used by payments, simulations and
 * retroactive recalculations.
 *
 * Algorithm (docs/TAX_ENGINE.md):
 *  1. Load active rules (cached 5 min).
 *  2. Keep rules applicable to (type, commune, tranche, contribuable, date).
 *  3. Sort by priority ASC, specificity DESC, date_debut DESC.
 *  4. If the best-ranked applicable *exemption* outranks (or ties with) the
 *     best *exclusive* rate rule → exempt, tax = 0.
 *  5. Otherwise the best exclusive rule sets the base tax; every applicable
 *     *cumulative* rule (surcharge) is added on top, in order.
 *  6. Return the full detail with legal references and log to calculs_fiscaux.
 *
 * Rounding: each line is rounded to 2 decimals (CDF has no sub-unit in
 * practice, but the DB stores numeric(14,2)); totals are sums of rounded lines
 * so the audit detail always adds up exactly.
 */

import { TAX_CALCULATION_VERSION } from '../env.ts';
import type { DbClient } from '../db.ts';
import { DbError } from '../db.ts';
import { loadRules, selectApplicableRules, type RuleContext, type TaxRule } from './rules.ts';
import { summarizeLegalReferences, toLegalReference, type LegalReference } from './legalRef.ts';

export interface TaxCalculationInput {
  /** Gross rent for the period — the tax base. */
  montantBrut: number;
  /** Value of the `property_type` enum (Appartement, Studio, Villa, Bureau, Magasin, Entrepôt). */
  typeLogement: string;
  commune: string;
  /** 'personne_physique' | 'personne_morale' | … (free-form, matched against rule arrays). */
  typeContribuable: string;
  /** ISO date or datetime of the transaction. */
  dateTransaction: string;
  bailleurId: string;
  /** Optional context, persisted with the calculation. */
  paiementId?: string;
  contratId?: string;
  periode?: string;
}

export type CalculationStepKind = 'exoneration' | 'taux_base' | 'surtaxe' | 'aucune_regle';

export interface CalculationDetail {
  ordre: number;
  type: CalculationStepKind;
  regleId: string | null;
  regleNom: string;
  description: string;
  /** Fraction applied on this line (null for fixed amounts / exemptions). */
  taux: number | null;
  /** Fixed amount applied on this line, if any. */
  montantFixe: number | null;
  base: number;
  montant: number;
  cumul: number;
  referenceLegale: string;
  articleLoi: string | null;
  priorite: number;
}

export interface TaxCalculationOutput {
  baseImposable: number;
  montantImpot: number;
  /** Effective rate as a PERCENTAGE (10 = 10 %) — convenient for the UI. */
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
  /** Legal remittance deadline (15th of the month after the period). */
  dateEcheance: string | null;
  /** Filled when the calculation was persisted. */
  calculId?: string;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toIsoDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`dateTransaction invalide : ${value}`);
  return d.toISOString().slice(0, 10);
}

/** 15th of the month following `periode` (YYYY-MM). */
export function computeDeadline(periode: string | undefined): string | null {
  if (!periode || !/^\d{4}-\d{2}$/.test(periode)) return null;
  const [y, m] = periode.split('-').map(Number) as [number, number];
  const next = new Date(Date.UTC(y, m, 15)); // month index m == next month
  return next.toISOString().slice(0, 10);
}

function lineAmount(rule: TaxRule, base: number): number {
  if (rule.type_taux === 'fixe') return round2(rule.montant_fixe ?? 0);
  return round2(base * rule.taux);
}

/**
 * Pure evaluation against an already-loaded rule set. No I/O — unit-testable
 * and used by the simulator with hypothetical rules.
 */
export function evaluateRules(rules: TaxRule[], input: TaxCalculationInput): TaxCalculationOutput {
  if (!Number.isFinite(input.montantBrut) || input.montantBrut < 0) {
    throw new Error('montantBrut doit être un nombre positif');
  }

  const base = round2(input.montantBrut);
  const ctx: RuleContext = {
    typeLogement: input.typeLogement,
    commune: input.commune,
    montant: base,
    typeContribuable: input.typeContribuable,
    date: toIsoDate(input.dateTransaction),
  };

  const applicable = selectApplicableRules(rules, ctx);
  const exemption = applicable.find((r) => r.exonere) ?? null;
  const exclusive = applicable.find((r) => !r.exonere && r.mode_application === 'exclusif') ?? null;
  const cumulative = applicable.filter((r) => !r.exonere && r.mode_application === 'cumulatif');

  const detail: CalculationDetail[] = [];
  const fired: TaxRule[] = [];
  let cumul = 0;
  let ordre = 1;

  const isExempt = exemption !== null && (exclusive === null || exemption.priorite <= exclusive.priorite);

  if (isExempt && exemption) {
    fired.push(exemption);
    detail.push({
      ordre: ordre++,
      type: 'exoneration',
      regleId: exemption.id,
      regleNom: exemption.nom,
      description: exemption.motif_exoneration ?? exemption.description ?? 'Exonération',
      taux: 0,
      montantFixe: null,
      base,
      montant: 0,
      cumul: 0,
      referenceLegale: exemption.reference_legale,
      articleLoi: exemption.article_loi,
      priorite: exemption.priorite,
    });
  } else {
    if (exclusive) {
      fired.push(exclusive);
      const montant = lineAmount(exclusive, base);
      cumul = round2(cumul + montant);
      detail.push({
        ordre: ordre++,
        type: 'taux_base',
        regleId: exclusive.id,
        regleNom: exclusive.nom,
        description: exclusive.description ?? 'Taux de base',
        taux: exclusive.type_taux === 'pourcentage' ? exclusive.taux : null,
        montantFixe: exclusive.type_taux === 'fixe' ? exclusive.montant_fixe : null,
        base,
        montant,
        cumul,
        referenceLegale: exclusive.reference_legale,
        articleLoi: exclusive.article_loi,
        priorite: exclusive.priorite,
      });
    } else {
      detail.push({
        ordre: ordre++,
        type: 'aucune_regle',
        regleId: null,
        regleNom: 'Aucune règle applicable',
        description: 'Aucune règle fiscale active ne correspond à ce loyer : impôt nul. À signaler à la DGI.',
        taux: 0,
        montantFixe: null,
        base,
        montant: 0,
        cumul: 0,
        referenceLegale: 'Aucune',
        articleLoi: null,
        priorite: 0,
      });
    }

    for (const rule of cumulative) {
      fired.push(rule);
      const montant = lineAmount(rule, base);
      cumul = round2(cumul + montant);
      detail.push({
        ordre: ordre++,
        type: 'surtaxe',
        regleId: rule.id,
        regleNom: rule.nom,
        description: rule.description ?? 'Taxe additionnelle',
        taux: rule.type_taux === 'pourcentage' ? rule.taux : null,
        montantFixe: rule.type_taux === 'fixe' ? rule.montant_fixe : null,
        base,
        montant,
        cumul,
        referenceLegale: rule.reference_legale,
        articleLoi: rule.article_loi,
        priorite: rule.priorite,
      });
    }
  }

  const montantImpot = cumul;
  const tauxEffectif = base > 0 ? Math.round((montantImpot / base) * 10000) / 10000 : 0;

  return {
    baseImposable: base,
    montantImpot,
    tauxEffectif,
    tauxApplique: round2(tauxEffectif * 100),
    exonere: isExempt,
    motifExoneration: isExempt ? (exemption?.motif_exoneration ?? exemption?.description ?? 'Exonération') : null,
    reglesAppliquees: fired.map((r) => r.id),
    referenceLegale: fired.length > 0 ? summarizeLegalReferences(fired) : 'Aucune règle applicable',
    references: fired.map(toLegalReference),
    detail,
    calculationVersion: TAX_CALCULATION_VERSION,
    dateEcheance: computeDeadline(input.periode),
  };
}

export interface CalculateOptions {
  /** 'paiement' (default) | 'simulation' | 'recalcul' */
  typeCalcul?: 'paiement' | 'simulation' | 'recalcul';
  /** Persist to calculs_fiscaux (default true). */
  persist?: boolean;
  createdBy?: string | null;
  /** Bypass the 5-minute cache (recalculations). */
  forceReload?: boolean;
}

/**
 * Loads rules, evaluates, and logs the calculation to `calculs_fiscaux`.
 */
export async function calculateTax(
  db: DbClient,
  input: TaxCalculationInput,
  options: CalculateOptions = {},
): Promise<TaxCalculationOutput> {
  const rules = await loadRules(db, { force: options.forceReload });
  const output = evaluateRules(rules, input);

  if (options.persist !== false) {
    const { data, error } = await db
      .from('calculs_fiscaux')
      .insert({
        paiement_id: input.paiementId ?? null,
        bailleur_id: input.bailleurId || null,
        contrat_id: input.contratId ?? null,
        type_calcul: options.typeCalcul ?? 'paiement',
        regles_appliquees: output.reglesAppliquees,
        base_imposable: output.baseImposable,
        montant_impot: output.montantImpot,
        taux_effectif: output.tauxEffectif,
        exonere: output.exonere,
        input: {
          montantBrut: input.montantBrut,
          typeLogement: input.typeLogement,
          commune: input.commune,
          typeContribuable: input.typeContribuable,
          dateTransaction: input.dateTransaction,
          periode: input.periode ?? null,
        },
        detail_calcul: output.detail,
        reference_legale: output.referenceLegale,
        calculation_version: output.calculationVersion,
        created_by: options.createdBy ?? null,
      })
      .select('id')
      .single();
    if (error) throw new DbError('calculs_fiscaux.insert', error.message);
    output.calculId = (data as { id: string }).id;
  }

  return output;
}
