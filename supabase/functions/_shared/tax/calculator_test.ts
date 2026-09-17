/**
 * Tax engine tests — pure evaluation against the seed rules of
 * `supabase/seed/03_tax_rules_drc.sql`. Expected values are the ones listed in
 * docs/TAX_RULES_REFERENCE.md § "Résultats attendus".
 *
 *   deno test --allow-env --allow-net _shared/
 */

import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { computeDeadline, evaluateRules, type TaxCalculationInput } from './calculator.ts';
import { compareRules, isRuleApplicable, normalizeRule, selectApplicableRules, specificity, type TaxRule } from './rules.ts';
import { isPendingValidation, summarizeLegalReferences } from './legalRef.ts';

// ─── Seed rules (mirror of 03_tax_rules_drc.sql, numerics as PostgREST strings) ──

/** Builds a rule from a raw PostgREST-like row (numerics may be strings), exactly as `loadRules` does. */
function rule(partial: Record<string, unknown> & { id: string; nom: string; priorite: number }): TaxRule {
  return normalizeRule({
    description: null,
    type_logement: null,
    commune: null,
    tranche_min: '50000.00',
    tranche_max: null,
    type_contribuable: null,
    taux: '0.1000',
    type_taux: 'pourcentage',
    montant_fixe: null,
    mode_application: 'exclusif',
    exonere: false,
    motif_exoneration: null,
    date_debut: '2024-01-01',
    date_fin: null,
    is_active: true,
    reference_legale: 'Code des impôts RDC — article à valider',
    article_loi: 'Art. XXX (à valider)',
    version: 1,
    ...partial,
  });
}

const EXEMPTION = rule({
  id: 'r1',
  nom: 'Exonération micro-loyer',
  priorite: 10,
  tranche_min: '0.00',
  tranche_max: '49999.99',
  taux: '0.0000',
  exonere: true,
  motif_exoneration: 'Loyer inférieur au seuil minimum imposable',
});
const RESIDENTIAL = rule({
  id: 'r2',
  nom: 'Impôt sur revenus locatifs — résidentiel',
  priorite: 100,
  type_logement: ['Appartement', 'Studio', 'Villa'],
  taux: '0.1000',
});
const COMMERCIAL = rule({
  id: 'r3',
  nom: 'Impôt sur revenus locatifs — commercial',
  priorite: 100,
  type_logement: ['Bureau', 'Magasin', 'Entrepôt'],
  taux: '0.1500',
});
const FALLBACK = rule({ id: 'r4', nom: 'Impôt sur revenus locatifs — taux par défaut', priorite: 900, taux: '0.1000' });
const GOMBE_SURTAX = rule({
  id: 'r5',
  nom: 'Surtaxe communale — Gombe',
  priorite: 200,
  commune: ['Gombe'],
  taux: '0.0100',
  mode_application: 'cumulatif',
  reference_legale: 'Arrêté communal Gombe — référence à confirmer',
  article_loi: null,
});

const SEED_ACTIVE = [EXEMPTION, RESIDENTIAL, COMMERCIAL, FALLBACK];
const SEED_WITH_SURTAX = [...SEED_ACTIVE, GOMBE_SURTAX];

function input(overrides: Partial<TaxCalculationInput>): TaxCalculationInput {
  return {
    montantBrut: 850000,
    typeLogement: 'Appartement',
    commune: 'Gombe',
    typeContribuable: 'personne_physique',
    dateTransaction: '2026-03-05T10:00:00Z',
    bailleurId: 'b-1',
    periode: '2026-03',
    ...overrides,
  };
}

// ─── Expected results table ────────────────────────────────────────────────

Deno.test('40 000 CDF Appartement Lemba → exempt (rule 1), tax 0', () => {
  const out = evaluateRules(SEED_ACTIVE, input({ montantBrut: 40000, commune: 'Lemba' }));
  assertEquals(out.exonere, true);
  assertEquals(out.montantImpot, 0);
  assertEquals(out.tauxEffectif, 0);
  assertEquals(out.reglesAppliquees, ['r1']);
  assertEquals(out.detail.length, 1);
  assertEquals(out.detail[0]!.type, 'exoneration');
  assertEquals(out.motifExoneration, 'Loyer inférieur au seuil minimum imposable');
});

Deno.test('850 000 CDF Appartement Gombe → rule 2, 85 000 (10 %)', () => {
  const out = evaluateRules(SEED_ACTIVE, input({}));
  assertEquals(out.exonere, false);
  assertEquals(out.baseImposable, 850000);
  assertEquals(out.montantImpot, 85000);
  assertEquals(out.tauxEffectif, 0.1);
  assertEquals(out.tauxApplique, 10);
  assertEquals(out.reglesAppliquees, ['r2']);
  assertEquals(out.detail[0]!.type, 'taux_base');
});

Deno.test('1 200 000 CDF Bureau Gombe → rule 3, 180 000 (15 %)', () => {
  const out = evaluateRules(SEED_ACTIVE, input({ montantBrut: 1200000, typeLogement: 'Bureau' }));
  assertEquals(out.montantImpot, 180000);
  assertEquals(out.tauxApplique, 15);
  assertEquals(out.reglesAppliquees, ['r3']);
});

Deno.test('1 200 000 CDF Bureau Gombe with surtax active → 180 000 + 12 000 = 192 000 (16 %)', () => {
  const out = evaluateRules(SEED_WITH_SURTAX, input({ montantBrut: 1200000, typeLogement: 'Bureau' }));
  assertEquals(out.montantImpot, 192000);
  assertEquals(out.tauxApplique, 16);
  assertEquals(out.reglesAppliquees, ['r3', 'r5']);
  assertEquals(out.detail.map((d) => d.type), ['taux_base', 'surtaxe']);
  assertEquals(out.detail[1]!.cumul, 192000);
  // Surtax is commune-scoped: same rent in Lemba is not surcharged.
  const lemba = evaluateRules(SEED_WITH_SURTAX, input({ montantBrut: 1200000, typeLogement: 'Bureau', commune: 'Lemba' }));
  assertEquals(lemba.montantImpot, 180000);
});

Deno.test('300 000 CDF unknown type Kintambo → fallback rule 4, 30 000', () => {
  const out = evaluateRules(SEED_ACTIVE, input({ montantBrut: 300000, typeLogement: 'Hangar', commune: 'Kintambo' }));
  assertEquals(out.montantImpot, 30000);
  assertEquals(out.reglesAppliquees, ['r4']);
});

// ─── Boundaries, exemptions, edge cases ───────────────────────────────────

Deno.test('threshold boundary: 49 999,99 exempt, 50 000 taxed', () => {
  assertEquals(evaluateRules(SEED_ACTIVE, input({ montantBrut: 49999.99 })).exonere, true);
  const taxed = evaluateRules(SEED_ACTIVE, input({ montantBrut: 50000 }));
  assertEquals(taxed.exonere, false);
  assertEquals(taxed.montantImpot, 5000);
});

Deno.test('no applicable rule → tax 0 with an explicit "aucune_regle" line', () => {
  const out = evaluateRules([RESIDENTIAL], input({ typeLogement: 'Bureau' }));
  assertEquals(out.montantImpot, 0);
  assertEquals(out.reglesAppliquees, []);
  assertEquals(out.detail[0]!.type, 'aucune_regle');
  assertEquals(out.referenceLegale, 'Aucune règle applicable');
});

Deno.test('exemption loses to a higher-priority (lower number) exclusive rule', () => {
  const lateExemption = rule({ ...EXEMPTION, id: 'rx', priorite: 500, tranche_min: '0', tranche_max: null });
  const out = evaluateRules([lateExemption, RESIDENTIAL], input({}));
  assertEquals(out.exonere, false);
  assertEquals(out.reglesAppliquees, ['r2']);
});

Deno.test('exemption wins a priority tie with an exclusive rule', () => {
  const tiedExemption = rule({ ...EXEMPTION, id: 'rx', priorite: 100, tranche_min: '0', tranche_max: null });
  const out = evaluateRules([RESIDENTIAL, tiedExemption], input({}));
  assertEquals(out.exonere, true);
  assertEquals(out.montantImpot, 0);
});

Deno.test('fixed-amount rules are applied as-is regardless of the base', () => {
  const fixed = rule({ id: 'rf', nom: 'Forfait', priorite: 50, type_taux: 'fixe', montant_fixe: '25000', taux: '0' });
  const out = evaluateRules([fixed, RESIDENTIAL], input({ montantBrut: 2000000 }));
  assertEquals(out.montantImpot, 25000);
  assertEquals(out.detail[0]!.montantFixe, 25000);
  assertEquals(out.detail[0]!.taux, null);
  assertEquals(out.tauxApplique, 1.25);
});

Deno.test('rules are ignored outside their validity window and when inactive', () => {
  const future = rule({ ...RESIDENTIAL, id: 'rfut', date_debut: '2027-01-01' });
  const expired = rule({ ...RESIDENTIAL, id: 'rexp', date_debut: '2020-01-01', date_fin: '2025-12-31' });
  const inactive = rule({ ...RESIDENTIAL, id: 'rina', is_active: false });
  const out = evaluateRules([future, expired, inactive, FALLBACK], input({}));
  assertEquals(out.reglesAppliquees, ['r4']);
});

Deno.test('type_contribuable filter restricts applicability', () => {
  const corporate = rule({ ...RESIDENTIAL, id: 'rpm', priorite: 90, type_contribuable: ['personne_morale'], taux: '0.2000' });
  const physical = evaluateRules([corporate, RESIDENTIAL], input({}));
  assertEquals(physical.reglesAppliquees, ['r2']);
  const moral = evaluateRules([corporate, RESIDENTIAL], input({ typeContribuable: 'personne_morale' }));
  assertEquals(moral.reglesAppliquees, ['rpm']);
  assertEquals(moral.montantImpot, 170000);
});

Deno.test('rounding: every line is rounded to 2 decimals and totals equal the sum of lines', () => {
  const odd = rule({ ...RESIDENTIAL, id: 'rodd', taux: '0.0333' });
  const surtax = rule({ ...GOMBE_SURTAX, id: 'rs', taux: '0.0077' });
  const out = evaluateRules([odd, surtax], input({ montantBrut: 123456.78 }));
  const sum = out.detail.reduce((acc, d) => acc + d.montant, 0);
  assertEquals(out.montantImpot, Math.round(sum * 100) / 100);
  for (const line of out.detail) assertEquals(line.montant, Math.round(line.montant * 100) / 100);
});

Deno.test('invalid inputs are rejected', () => {
  assertThrows(() => evaluateRules(SEED_ACTIVE, input({ montantBrut: -1 })));
  assertThrows(() => evaluateRules(SEED_ACTIVE, input({ montantBrut: Number.NaN })));
  assertThrows(() => evaluateRules(SEED_ACTIVE, input({ dateTransaction: 'not-a-date' })));
});

Deno.test('dateEcheance is the 15th of the month following the period', () => {
  assertEquals(computeDeadline('2026-03'), '2026-04-15');
  assertEquals(computeDeadline('2026-12'), '2027-01-15');
  assertEquals(computeDeadline(undefined), null);
  assertEquals(computeDeadline('2026/03'), null);
  assertEquals(evaluateRules(SEED_ACTIVE, input({ periode: '2026-03' })).dateEcheance, '2026-04-15');
});

// ─── Rule selection primitives ────────────────────────────────────────────

Deno.test('specificity ranks commune > type_logement > tranche/contribuable', () => {
  assertEquals(specificity(FALLBACK), 1); // tranche only
  assertEquals(specificity(RESIDENTIAL), 3); // type + tranche
  assertEquals(specificity(GOMBE_SURTAX), 5); // commune + tranche
  assert(specificity(rule({ ...RESIDENTIAL, id: 'x', commune: ['Gombe'] })) > specificity(RESIDENTIAL));
});

Deno.test('compareRules: priority first, then specificity, then most recent date_debut', () => {
  const generic = rule({ ...RESIDENTIAL, id: 'g', type_logement: null });
  assert(compareRules(RESIDENTIAL, generic) < 0, 'more specific wins the tie');
  assert(compareRules(EXEMPTION, RESIDENTIAL) < 0, 'lower priorite first');
  const newer = rule({ ...RESIDENTIAL, id: 'n', date_debut: '2025-06-01' });
  assert(compareRules(newer, RESIDENTIAL) < 0, 'newer rule first on full tie');
});

Deno.test('selectApplicableRules filters and orders', () => {
  const ctx = { typeLogement: 'Bureau', commune: 'Gombe', montant: 1200000, typeContribuable: 'personne_physique', date: '2026-03-05' };
  const selected = selectApplicableRules(SEED_WITH_SURTAX, ctx);
  assertEquals(selected.map((r) => r.id), ['r3', 'r5', 'r4']);
  assertEquals(isRuleApplicable(EXEMPTION, ctx), false);
  assertEquals(isRuleApplicable(RESIDENTIAL, ctx), false);
});

// ─── Legal references ──────────────────────────────────────────────────────

Deno.test('placeholder rules are flagged pendingValidation until legal counsel confirms them', () => {
  assertEquals(isPendingValidation(RESIDENTIAL), true);
  assertEquals(isPendingValidation(GOMBE_SURTAX), true);
  assertEquals(
    isPendingValidation({ reference_legale: 'Code des impôts RDC — Art. 42', article_loi: 'Art. 42' }),
    false,
  );
});

Deno.test('evaluation output carries the legal references of every fired rule', () => {
  const out = evaluateRules(SEED_WITH_SURTAX, input({ montantBrut: 1200000, typeLogement: 'Bureau' }));
  assertEquals(out.references.length, 2);
  assertEquals(out.references.map((r) => r.ruleId), ['r3', 'r5']);
  assert(out.references.every((r) => r.pendingValidation));
  assertEquals(out.referenceLegale, summarizeLegalReferences([COMMERCIAL, GOMBE_SURTAX]));
  assert(out.referenceLegale.length > 0);
});
