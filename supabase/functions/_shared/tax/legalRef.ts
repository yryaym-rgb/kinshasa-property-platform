/**
 * Legal reference helpers.
 *
 * The engine never invents tax law: every rule row carries a mandatory
 * `reference_legale` (NOT NULL). This module formats those citations for
 * receipts, dashboards and the audit log, and flags rules that still await
 * validation by DGI legal counsel.
 */

import type { TaxRule } from './rules.ts';

export interface LegalReference {
  ruleId: string;
  ruleName: string;
  reference: string;
  article: string | null;
  /** True while the citation contains "à valider" / "à confirmer" / "XXX". */
  pendingValidation: boolean;
}

const PENDING_MARKERS = /(à valider|a valider|à confirmer|a confirmer|XXX|placeholder|non validée)/i;

export function isPendingValidation(rule: Pick<TaxRule, 'reference_legale' | 'article_loi'>): boolean {
  return PENDING_MARKERS.test(rule.reference_legale) || PENDING_MARKERS.test(rule.article_loi ?? '');
}

export function toLegalReference(rule: TaxRule): LegalReference {
  return {
    ruleId: rule.id,
    ruleName: rule.nom,
    reference: rule.reference_legale,
    article: rule.article_loi,
    pendingValidation: isPendingValidation(rule),
  };
}

/** Single human-readable line, e.g. for the receipt footer. */
export function formatLegalReference(ref: LegalReference): string {
  const base = ref.article ? `${ref.reference} — ${ref.article}` : ref.reference;
  return ref.pendingValidation ? `${base} (référence à valider)` : base;
}

/** De-duplicated, joined citation of all rules that fired. */
export function summarizeLegalReferences(rules: TaxRule[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const rule of rules) {
    const line = formatLegalReference(toLegalReference(rule));
    if (!seen.has(line)) {
      seen.add(line);
      parts.push(line);
    }
  }
  return parts.join(' ; ');
}

/**
 * Plain-French explanation shown to landlords ("Comprendre mes impôts").
 * Kept here so the wording is identical on the web and on PDF exports.
 */
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
