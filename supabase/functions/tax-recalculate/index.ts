/**
 * tax-recalculate — admin-only retroactive recalculation after rules change.
 *
 * Body: { motif, periodeFrom?, periodeTo?, bailleurId?, commune?, dryRun = true, limit = 500 }
 *
 * - Bypasses the rules cache (fresh rules).
 * - Re-evaluates every matching impôt with the SAME calculator used at payment
 *   time, logs each evaluation to calculs_fiscaux (type 'recalcul').
 * - dryRun=true (default) reports the deltas without writing impots.
 * - dryRun=false applies: montant/taux/detail updated, montant_precedent kept,
 *   ledger DGI debit adjusted with a correction entry, landlord notified.
 * - Every run is stored in recalculs_fiscaux with the full report.
 */

import { z } from 'zod';
import { authenticate, errorResponse, handlePreflight, json, readJson, requireMethod, requireRole } from '../_shared/auth.ts';
import { type DbClient, DbError, serviceClient, writeAuditLog } from '../_shared/db.ts';
import { createLogger } from '../_shared/logger.ts';
import { evaluateRules } from '../_shared/tax/calculator.ts';
import { invalidateRulesCache, loadRules } from '../_shared/tax/rules.ts';

const BodySchema = z.object({
  motif: z.string().min(5).max(500),
  periodeFrom: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  periodeTo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  bailleurId: z.string().uuid().optional(),
  commune: z.string().max(100).optional(),
  dryRun: z.boolean().default(true),
  limit: z.number().int().min(1).max(5000).default(500),
});

interface ImpotRow {
  id: string;
  paiement_id: string | null;
  contrat_id: string;
  bailleur_id: string | null;
  montant: number;
  taux: number;
  base_imposable: number | null;
  periode: string;
  status: string;
  commune: string | null;
  type_logement: string | null;
  calculated_at: string;
  paiement?: { montant: number; metadata: Record<string, unknown> | null; paid_at: string | null } | null;
  contrat?: { bailleur?: { business_name: string | null; user_id: string } | null; logement?: { type: string; commune: string } | null } | null;
}

interface ReportLine {
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

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const log = createLogger('tax-recalculate', req);

  try {
    requireMethod(req, 'POST');
    const user = await authenticate(req);
    requireRole(user, ['admin', 'agent_fiscal']);
    const body = BodySchema.parse(await readJson(req));
    const db = serviceClient();

    const { data: run, error: runErr } = await db
      .from('recalculs_fiscaux')
      .insert({ lance_par: user.id, motif: body.motif, filtres: body, dry_run: body.dryRun, status: 'running' })
      .select('id')
      .single();
    if (runErr) throw new DbError('recalculs_fiscaux.insert', runErr.message);
    const runId = (run as { id: string }).id;

    try {
      invalidateRulesCache();
      const rules = await loadRules(db, { force: true });

      let query = db
        .from('impots')
        .select(
          `id, paiement_id, contrat_id, bailleur_id, montant, taux, base_imposable, periode, status, commune, type_logement, calculated_at,
           paiement:paiements(montant, metadata, paid_at),
           contrat:contrats(bailleur:bailleurs(business_name, user_id), logement:logements(type, commune))`,
        )
        .neq('status', 'paye') // never rewrite a settled obligation silently
        .order('periode', { ascending: true })
        .limit(body.limit);
      if (body.periodeFrom) query = query.gte('periode', body.periodeFrom);
      if (body.periodeTo) query = query.lte('periode', body.periodeTo);
      if (body.bailleurId) query = query.eq('bailleur_id', body.bailleurId);
      if (body.commune) query = query.eq('commune', body.commune);

      const { data, error } = await query;
      if (error) throw new DbError('impots.select', error.message);
      const impots = (data ?? []) as unknown as ImpotRow[];

      const report: ReportLine[] = [];
      let deltaTotal = 0;

      for (const impot of impots) {
        const logement = impot.contrat?.logement;
        const meta = impot.paiement?.metadata ?? {};
        const base = Number(impot.base_imposable ?? meta.rent_amount ?? impot.paiement?.montant ?? 0);
        if (!Number.isFinite(base) || base <= 0) continue;

        const output = evaluateRules(rules, {
          montantBrut: base,
          typeLogement: impot.type_logement ?? logement?.type ?? 'Appartement',
          commune: impot.commune ?? logement?.commune ?? '',
          typeContribuable: impot.contrat?.bailleur?.business_name ? 'personne_morale' : 'personne_physique',
          dateTransaction: impot.paiement?.paid_at ?? impot.calculated_at,
          bailleurId: impot.bailleur_id ?? '',
          paiementId: impot.paiement_id ?? undefined,
          contratId: impot.contrat_id,
          periode: impot.periode,
        });

        const ancien = Number(impot.montant);
        const nouveau = output.montantImpot;
        const delta = Math.round((nouveau - ancien) * 100) / 100;
        if (Math.abs(delta) < 0.005 && output.tauxEffectif === Number(impot.taux)) continue;

        report.push({
          impotId: impot.id,
          paiementId: impot.paiement_id,
          bailleurId: impot.bailleur_id,
          periode: impot.periode,
          ancien,
          nouveau,
          delta,
          regles: output.reglesAppliquees,
          referenceLegale: output.referenceLegale,
        });
        deltaTotal += delta;

        // Always log the evaluation (dry run included) for the audit trail.
        const { data: calc } = await db
          .from('calculs_fiscaux')
          .insert({
            paiement_id: impot.paiement_id,
            bailleur_id: impot.bailleur_id,
            contrat_id: impot.contrat_id,
            impot_id: impot.id,
            type_calcul: 'recalcul',
            regles_appliquees: output.reglesAppliquees,
            base_imposable: output.baseImposable,
            montant_impot: nouveau,
            taux_effectif: output.tauxEffectif,
            exonere: output.exonere,
            input: { recalcul: runId, dryRun: body.dryRun, ancien },
            detail_calcul: output.detail,
            reference_legale: output.referenceLegale,
            calculation_version: output.calculationVersion,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (!body.dryRun) {
          await applyRecalculation(db, impot, output.montantImpot, output.tauxEffectif, output, (calc as { id: string } | null)?.id ?? null, runId);
        }
      }

      await db
        .from('recalculs_fiscaux')
        .update({
          status: 'done',
          nb_examines: impots.length,
          nb_modifies: report.length,
          delta_total: Math.round(deltaTotal * 100) / 100,
          rapport: report,
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId);

      await writeAuditLog(db, {
        userId: user.id,
        action: body.dryRun ? 'tax.recalculate_dry_run' : 'tax.recalculate_applied',
        entityType: 'recalculs_fiscaux',
        entityId: runId,
        newData: { motif: body.motif, filtres: body, examines: impots.length, modifies: report.length, deltaTotal },
      });

      log.info('recalculation finished', { runId, examines: impots.length, modifies: report.length, deltaTotal, dryRun: body.dryRun });
      return json(req, { runId, dryRun: body.dryRun, examines: impots.length, modifies: report.length, deltaTotal: Math.round(deltaTotal * 100) / 100, report });
    } catch (inner) {
      await db.from('recalculs_fiscaux').update({ status: 'failed', erreur: String(inner), finished_at: new Date().toISOString() }).eq('id', runId);
      throw inner;
    }
  } catch (error) {
    log.error('tax-recalculate failed', error);
    return errorResponse(req, error, log.requestId);
  }
});

async function applyRecalculation(
  db: DbClient,
  impot: ImpotRow,
  nouveau: number,
  taux: number,
  output: ReturnType<typeof evaluateRules>,
  calculId: string | null,
  runId: string,
): Promise<void> {
  const { error } = await db
    .from('impots')
    .update({
      montant: nouveau,
      taux,
      montant_precedent: impot.montant,
      recalcule_at: new Date().toISOString(),
      status: output.exonere ? 'exonere' : impot.status,
      regles_appliquees: output.reglesAppliquees,
      regle_fiscale_id: output.reglesAppliquees[0] ?? null,
      calcul_fiscal_id: calculId,
      reference_legale: output.referenceLegale,
      detail_calcul: output.detail,
      base_imposable: output.baseImposable,
    })
    .eq('id', impot.id);
  if (error) throw new DbError('impots.update', error.message);

  const delta = Math.round((nouveau - Number(impot.montant)) * 100) / 100;
  if (impot.paiement_id && delta !== 0) {
    await db.from('ledger_entries').insert({
      paiement_id: impot.paiement_id,
      account_type: 'dgi',
      account_id: null,
      direction: delta > 0 ? 'debit' : 'credit',
      amount: Math.abs(delta),
      description: `Correction impôt (recalcul ${runId}) — ${impot.periode}`,
      metadata: { recalcul: runId, ancien: impot.montant, nouveau },
    });
  }

  const userId = impot.contrat?.bailleur?.user_id;
  if (userId) {
    await db.from('notifications').insert({
      user_id: userId,
      title: 'Mise à jour de votre impôt',
      message: `L'impôt de la période ${impot.periode} a été recalculé : ${Math.round(Number(impot.montant))} → ${Math.round(nouveau)} suite à une mise à jour des règles fiscales.`,
      type: 'tax',
      metadata: { impot_id: impot.id, recalcul: runId, delta },
    });
  }
}
