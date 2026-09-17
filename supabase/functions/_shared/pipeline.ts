/**
 * Post-success pipeline — runs once a payment reaches `succeeded`, whether the
 * confirmation came from a webhook or from payment-verify. Both paths call
 * `runPostSuccessPipeline`, so the downstream logic exists exactly once.
 *
 *   Tax calculated → impôt record → ledger split (bailleur / DGI / fees)
 *   → receipt → notifications (tenant, bailleur, DGI) → compliance → audit
 *
 * Every step is idempotent and checkpointed in `paiements.pipeline`. When a
 * step fails the payment STAYS `succeeded` (the money moved); the step is
 * queued in `payment_pipeline_jobs` with its full context, an admin alert is
 * raised, and the remaining steps still run.
 */

import { ADMIN_ALERT_USER_ID, DGI_NOTIFICATION_USER_ID, INTERNAL_FUNCTION_SECRET, PLATFORM_FEE_RATE, SUPABASE_URL } from './env.ts';
import { type DbClient, type PaymentRow, DbError, getContract, getPayment, updatePipeline, writeAuditLog } from './db.ts';
import type { Logger } from './logger.ts';
import { calculateTax, type TaxCalculationInput, type TaxCalculationOutput } from './tax/calculator.ts';

export type PipelineStep = 'tax' | 'ledger' | 'receipt' | 'notifications' | 'compliance' | 'audit';
export const PIPELINE_STEPS: PipelineStep[] = ['tax', 'ledger', 'receipt', 'notifications', 'compliance', 'audit'];

export interface PipelineResult {
  ok: boolean;
  steps: Record<PipelineStep, { status: 'done' | 'failed' | 'skipped'; error?: string; result?: Record<string, unknown> }>;
  impotId: string | null;
  receiptId: string | null;
  receiptCode: string | null;
}

interface PipelineContext {
  db: DbClient;
  log: Logger;
  payment: PaymentRow;
  contract: NonNullable<Awaited<ReturnType<typeof getContract>>>;
  rentAmount: number;
  breakdown: Record<string, number>;
  tax: TaxCalculationOutput | null;
  impotId: string | null;
  receiptId: string | null;
  receiptCode: string | null;
  actor: string;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** The gross rent is the tax base; it is stored by payment-initiate in metadata.rent_amount. */
export function rentAmountOf(payment: PaymentRow): number {
  const meta = payment.metadata ?? {};
  const fromMeta = num(meta.rent_amount, NaN);
  if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta;
  const calc = payment.tax_calculation as Record<string, unknown> | null;
  const fromCalc = num(calc?.rentAmount, NaN);
  if (Number.isFinite(fromCalc) && fromCalc > 0) return fromCalc;
  return num(payment.montant);
}

export async function runPostSuccessPipeline(
  db: DbClient,
  paymentId: string,
  log: Logger,
  options: { actor?: string; only?: PipelineStep[] } = {},
): Promise<PipelineResult> {
  const payment = await getPayment(db, paymentId);
  if (!payment) throw new DbError('pipeline', 'payment_not_found', 'payment_not_found');
  if (payment.state !== 'succeeded' && payment.state !== 'disputed') {
    throw new DbError('pipeline', `payment ${paymentId} is ${payment.state}, pipeline requires succeeded`, 'invalid_state');
  }
  const contract = await getContract(db, payment.contrat_id);
  if (!contract) throw new DbError('pipeline', 'contract_not_found', 'contract_not_found');

  const previous = (payment.pipeline ?? {}) as Record<string, { status?: string; result?: Record<string, unknown> }>;
  const ctx: PipelineContext = {
    db,
    log: log.child({ paymentId, step: 'pipeline' }),
    payment,
    contract,
    rentAmount: rentAmountOf(payment),
    breakdown: (payment.tax_calculation as Record<string, number> | null) ?? {},
    tax: null,
    impotId: (previous.tax?.result?.impotId as string | undefined) ?? null,
    receiptId: (previous.receipt?.result?.receiptId as string | undefined) ?? null,
    receiptCode: (previous.receipt?.result?.receiptCode as string | undefined) ?? null,
    actor: options.actor ?? 'system',
  };

  const result: PipelineResult = {
    ok: true,
    steps: {
      tax: { status: 'skipped' },
      ledger: { status: 'skipped' },
      receipt: { status: 'skipped' },
      notifications: { status: 'skipped' },
      compliance: { status: 'skipped' },
      audit: { status: 'skipped' },
    },
    impotId: ctx.impotId,
    receiptId: ctx.receiptId,
    receiptCode: ctx.receiptCode,
  };

  const steps: Array<[PipelineStep, (c: PipelineContext) => Promise<Record<string, unknown>>]> = [
    ['tax', stepTax],
    ['ledger', stepLedger],
    ['receipt', stepReceipt],
    ['notifications', stepNotifications],
    ['compliance', stepCompliance],
    ['audit', stepAudit],
  ];

  for (const [name, fn] of steps) {
    if (options.only && !options.only.includes(name)) continue;
    // Already done in a previous run (retry scenario) → keep the checkpoint.
    if (!options.only && previous[name]?.status === 'done') {
      result.steps[name] = { status: 'done', result: previous[name]?.result };
      continue;
    }
    try {
      const stepResult = await fn(ctx);
      await updatePipeline(db, paymentId, name, { status: 'done', result: stepResult });
      await markJobDone(db, paymentId, name);
      result.steps[name] = { status: 'done', result: stepResult };
      ctx.log.info(`pipeline step done: ${name}`, { result: stepResult });
    } catch (error) {
      result.ok = false;
      const message = error instanceof Error ? error.message : String(error);
      result.steps[name] = { status: 'failed', error: message };
      ctx.log.error(`pipeline step failed: ${name}`, error);
      await safely(() => updatePipeline(db, paymentId, name, { status: 'queued', error: message }));
      await safely(() => queueJob(db, paymentId, name, message, { rentAmount: ctx.rentAmount, contractId: contract.id }));
      await safely(() => alertAdmin(db, paymentId, name, message));
    }
  }

  result.impotId = ctx.impotId;
  result.receiptId = ctx.receiptId;
  result.receiptCode = ctx.receiptCode;
  return result;
}

// ─── Steps ─────────────────────────────────────────────────────────────────

async function stepTax(ctx: PipelineContext): Promise<Record<string, unknown>> {
  const { db, payment, contract } = ctx;
  const logement = contract.logement;
  if (!logement) throw new Error('logement introuvable pour le contrat');

  const input: TaxCalculationInput = {
    montantBrut: ctx.rentAmount,
    typeLogement: logement.type,
    commune: logement.commune,
    typeContribuable: contract.bailleur?.business_name ? 'personne_morale' : 'personne_physique',
    dateTransaction: payment.paid_at ?? new Date().toISOString(),
    bailleurId: contract.bailleur_id,
    paiementId: payment.id,
    contratId: contract.id,
    periode: payment.periode,
  };

  const tax = await computeTax(db, input, ctx.log);
  ctx.tax = tax;

  // Upsert the impôt (unique on paiement_id — migration 009).
  const { data: existing } = await db.from('impots').select('id, montant').eq('paiement_id', payment.id).maybeSingle();
  const row = {
    paiement_id: payment.id,
    contrat_id: contract.id,
    bailleur_id: contract.bailleur_id,
    montant: tax.montantImpot,
    taux: tax.tauxEffectif,
    base_imposable: tax.baseImposable,
    status: tax.exonere ? 'exonere' : 'calcule',
    periode: payment.periode,
    calculated_at: new Date().toISOString(),
    regle_fiscale_id: tax.reglesAppliquees[0] ?? null,
    regles_appliquees: tax.reglesAppliquees,
    calcul_fiscal_id: tax.calculId ?? null,
    commune: logement.commune,
    type_logement: logement.type,
    reference_legale: tax.referenceLegale,
    detail_calcul: tax.detail,
    date_echeance: tax.dateEcheance,
  };

  let impotId: string;
  if (existing) {
    const { error } = await db.from('impots').update({ ...row, montant_precedent: existing.montant, recalcule_at: new Date().toISOString() }).eq('id', existing.id);
    if (error) throw new DbError('impots.update', error.message);
    impotId = existing.id as string;
  } else {
    const { data, error } = await db.from('impots').insert(row).select('id').single();
    if (error) throw new DbError('impots.insert', error.message);
    impotId = (data as { id: string }).id;
  }
  ctx.impotId = impotId;

  if (tax.calculId) await db.from('calculs_fiscaux').update({ impot_id: impotId }).eq('id', tax.calculId);

  // Snapshot the authoritative calculation on the payment for receipts.
  const authoritative = {
    ...ctx.breakdown,
    rentAmount: tax.baseImposable,
    taxRate: tax.tauxEffectif,
    taxAmount: tax.montantImpot,
    legalReference: tax.referenceLegale,
    exonere: tax.exonere,
    impotId,
  };
  await db.from('paiements').update({ tax_calculation: authoritative }).eq('id', payment.id);
  ctx.breakdown = authoritative as unknown as Record<string, number>;

  return { impotId, montantImpot: tax.montantImpot, tauxApplique: tax.tauxApplique, exonere: tax.exonere, calculId: tax.calculId ?? null };
}

/**
 * Tax computation entry point. In-process by default; when
 * `TAX_CALCULATE_VIA_HTTP=true` the tax-calculate Edge Function is invoked
 * over HTTP with the internal secret (same algorithm, separate deploy unit).
 */
async function computeTax(db: DbClient, input: TaxCalculationInput, log: Logger): Promise<TaxCalculationOutput> {
  if (Deno.env.get('TAX_CALCULATE_VIA_HTTP') === 'true' && INTERNAL_FUNCTION_SECRET) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/tax-calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_FUNCTION_SECRET },
      body: JSON.stringify({ ...input, persist: true }),
    });
    if (!res.ok) {
      const body = await res.text();
      log.warn('tax-calculate HTTP failed, falling back to in-process', { status: res.status, body });
    } else {
      return (await res.json()) as TaxCalculationOutput;
    }
  }
  return calculateTax(db, input, { typeCalcul: 'paiement' });
}

async function stepLedger(ctx: PipelineContext): Promise<Record<string, unknown>> {
  const { db, payment, contract } = ctx;
  const total = num(payment.montant);
  const taxAmount = num(ctx.breakdown.taxAmount, ctx.tax?.montantImpot ?? 0);
  const platformFee = num(ctx.breakdown.platformFee, Math.round(ctx.rentAmount * PLATFORM_FEE_RATE));
  const providerFee = num(ctx.breakdown.mobileMoneyFee, 0);
  // Landlord receives what is left after tax and fees — with the standard
  // breakdown (rent + tax + fees) this equals the gross rent.
  const loyerNet = Math.max(0, Math.round((total - taxAmount - platformFee - providerFee) * 100) / 100);

  const entries = [
    { account_type: 'bailleur', account_id: contract.bailleur_id, direction: 'credit', amount: loyerNet, description: `Loyer net ${payment.periode} — ${payment.reference}` },
    { account_type: 'dgi', account_id: null, direction: 'debit', amount: taxAmount, description: `Impôt sur revenus locatifs ${payment.periode} — ${payment.reference}` },
    { account_type: 'platform', account_id: null, direction: 'credit', amount: platformFee, description: `Frais plateforme — ${payment.reference}` },
    { account_type: 'provider_fee', account_id: null, direction: 'debit', amount: providerFee, description: `Frais opérateur — ${payment.reference}` },
  ].filter((e) => e.amount > 0);

  // Idempotent: unique (paiement_id, account_type, direction) where reversal_of IS NULL.
  const { error } = await db
    .from('ledger_entries')
    .upsert(
      entries.map((e) => ({ ...e, paiement_id: payment.id, currency: payment.currency, metadata: { periode: payment.periode } })),
      { onConflict: 'paiement_id,account_type,direction', ignoreDuplicates: true },
    );
  if (error) throw new DbError('ledger_entries.upsert', error.message);

  // Running balances on the landlord row (derived, recomputed from the journal).
  const { data: sums, error: sumErr } = await db
    .from('ledger_entries')
    .select('direction, amount, reversal_of')
    .eq('account_type', 'bailleur')
    .eq('account_id', contract.bailleur_id);
  if (sumErr) throw new DbError('ledger_entries.sum', sumErr.message);
  const solde = (sums ?? []).reduce((acc: number, e: { direction: string; amount: number }) => acc + (e.direction === 'credit' ? num(e.amount) : -num(e.amount)), 0);

  const { data: dgi } = await db.from('impots').select('montant').eq('bailleur_id', contract.bailleur_id).in('status', ['calcule', 'declare', 'en_retard']);
  const impotsDus = (dgi ?? []).reduce((acc: number, i: { montant: number }) => acc + num(i.montant), 0);

  const { data: encaisse } = await db.from('ledger_entries').select('amount').eq('account_type', 'bailleur').eq('account_id', contract.bailleur_id).eq('direction', 'credit').is('reversal_of', null);
  const totalEncaisse = (encaisse ?? []).reduce((acc: number, e: { amount: number }) => acc + num(e.amount), 0);

  const { error: balErr } = await db
    .from('bailleurs')
    .update({ solde_disponible: Math.round(solde * 100) / 100, total_encaisse: totalEncaisse, total_impots_dus: impotsDus })
    .eq('id', contract.bailleur_id);
  if (balErr) throw new DbError('bailleurs.updateBalance', balErr.message);

  return { loyerNet, taxAmount, platformFee, providerFee, soldeBailleur: solde, impotsDus };
}

async function stepReceipt(ctx: PipelineContext): Promise<Record<string, unknown>> {
  const { db, payment, contract } = ctx;
  const { data: existing } = await db.from('recus').select('id, code').eq('paiement_id', payment.id).maybeSingle();
  if (existing) {
    ctx.receiptId = existing.id as string;
    ctx.receiptCode = existing.code as string;
    return { receiptId: existing.id, receiptCode: existing.code, reused: true };
  }

  const { data, error } = await db
    .from('recus')
    .insert({
      paiement_id: payment.id,
      contrat_id: contract.id,
      montant: payment.montant,
      currency: payment.currency,
      metadata: {
        tax_calculation: ctx.breakdown,
        impot_id: ctx.impotId,
        legal_reference: ctx.tax?.referenceLegale ?? (ctx.breakdown as Record<string, unknown>).legalReference ?? null,
        provider: payment.provider,
        provider_transaction_id: payment.provider_transaction_id,
        periode: payment.periode,
        logement_code: contract.logement?.code ?? null,
        // TODO(Module 8): PDF generation → pdf_url via receiptService / Storage.
        pdf_status: 'pending',
      },
    })
    .select('id, code')
    .single();
  if (error) throw new DbError('recus.insert', error.message);
  ctx.receiptId = (data as { id: string }).id;
  ctx.receiptCode = (data as { code: string }).code;
  return { receiptId: ctx.receiptId, receiptCode: ctx.receiptCode };
}

async function stepNotifications(ctx: PipelineContext): Promise<Record<string, unknown>> {
  const { db, payment, contract } = ctx;
  const amount = `${Math.round(num(payment.montant)).toLocaleString('fr-CD')} ${payment.currency}`;
  const taxAmount = `${Math.round(num(ctx.breakdown.taxAmount)).toLocaleString('fr-CD')} ${payment.currency}`;
  const receipt = ctx.receiptCode ? ` Reçu ${ctx.receiptCode}.` : '';
  const meta = { payment_id: payment.id, receipt_id: ctx.receiptId, impot_id: ctx.impotId, periode: payment.periode };

  const rows: Array<Record<string, unknown>> = [
    {
      user_id: contract.locataire_id,
      title: 'Paiement confirmé',
      message: `Votre paiement de ${amount} pour ${payment.periode} a été enregistré.${receipt}`,
      type: 'payment',
      metadata: meta,
    },
  ];

  if (contract.bailleur?.user_id) {
    rows.push({
      user_id: contract.bailleur.user_id,
      title: 'Loyer reçu',
      message: `Un loyer de ${amount} a été reçu pour ${contract.logement?.code ?? 'votre logement'} (${payment.periode}). Impôt calculé : ${taxAmount}.`,
      type: 'payment',
      metadata: meta,
    });
  }

  // DGI: a designated agent, or every active agent_fiscal (capped).
  let dgiUserIds: string[] = [];
  if (DGI_NOTIFICATION_USER_ID) dgiUserIds = [DGI_NOTIFICATION_USER_ID];
  else {
    const { data } = await db.from('users').select('id').eq('role', 'agent_fiscal').eq('is_active', true).limit(20);
    dgiUserIds = (data ?? []).map((u: { id: string }) => u.id);
  }
  for (const id of dgiUserIds) {
    rows.push({
      user_id: id,
      title: 'Nouvelle recette fiscale',
      message: `Impôt de ${taxAmount} calculé sur un loyer de ${amount} (${contract.logement?.commune ?? '—'}, ${payment.periode}).`,
      type: 'tax',
      metadata: meta,
    });
  }

  const { error } = await db.from('notifications').insert(rows);
  if (error) throw new DbError('notifications.insert', error.message);
  await db.from('paiements').update({ notifications_sent: true }).eq('id', payment.id);
  return { count: rows.length, dgiRecipients: dgiUserIds.length };
}

async function stepCompliance(ctx: PipelineContext): Promise<Record<string, unknown>> {
  const { data, error } = await ctx.db.rpc('check_compliance_score', { bailleur_id: ctx.contract.bailleur_id });
  if (error) throw new DbError('check_compliance_score', error.message);
  return { complianceScore: num(data) };
}

async function stepAudit(ctx: PipelineContext): Promise<Record<string, unknown>> {
  await writeAuditLog(ctx.db, {
    userId: null,
    action: 'payment.pipeline_completed',
    entityType: 'paiements',
    entityId: ctx.payment.id,
    newData: {
      actor: ctx.actor,
      state: ctx.payment.state,
      montant: ctx.payment.montant,
      rentAmount: ctx.rentAmount,
      impotId: ctx.impotId,
      receiptId: ctx.receiptId,
      montantImpot: ctx.tax?.montantImpot ?? ctx.breakdown.taxAmount ?? null,
      referenceLegale: ctx.tax?.referenceLegale ?? null,
    },
  });
  return { logged: true };
}

// ─── Failure handling ──────────────────────────────────────────────────────

async function queueJob(db: DbClient, paymentId: string, step: PipelineStep, error: string, context: Record<string, unknown>): Promise<void> {
  const { data: existing } = await db.from('payment_pipeline_jobs').select('id, attempts, max_attempts').eq('paiement_id', paymentId).eq('step', step).maybeSingle();
  const attempts = (existing?.attempts ?? 0) + 1;
  const dead = attempts >= (existing?.max_attempts ?? 5);
  const backoffMinutes = Math.min(60, Math.pow(2, attempts));
  const row = {
    paiement_id: paymentId,
    step,
    status: dead ? 'dead' : 'queued',
    attempts,
    next_run_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
    last_error: error,
    context,
  };
  const { error: err } = await db.from('payment_pipeline_jobs').upsert(row, { onConflict: 'paiement_id,step' });
  if (err) throw new DbError('payment_pipeline_jobs.upsert', err.message);
}

async function markJobDone(db: DbClient, paymentId: string, step: PipelineStep): Promise<void> {
  await db.from('payment_pipeline_jobs').update({ status: 'done' }).eq('paiement_id', paymentId).eq('step', step).neq('status', 'done');
}

async function alertAdmin(db: DbClient, paymentId: string, step: PipelineStep, error: string): Promise<void> {
  let recipients: string[] = [];
  if (ADMIN_ALERT_USER_ID) recipients = [ADMIN_ALERT_USER_ID];
  else {
    const { data } = await db.from('users').select('id').eq('role', 'admin').eq('is_active', true).limit(5);
    recipients = (data ?? []).map((u: { id: string }) => u.id);
  }
  if (recipients.length === 0) return;
  await db.from('notifications').insert(
    recipients.map((id) => ({
      user_id: id,
      title: `Pipeline paiement : étape « ${step} » en échec`,
      message: `Paiement ${paymentId} : ${error.slice(0, 200)}. L'étape est en file de réessai.`,
      type: 'alert',
      metadata: { payment_id: paymentId, step, error },
    })),
  );
}

/** Re-runs queued jobs for one payment (called opportunistically by payment-verify). */
export async function retryQueuedJobs(db: DbClient, paymentId: string, log: Logger): Promise<PipelineStep[]> {
  const { data } = await db
    .from('payment_pipeline_jobs')
    .select('step')
    .eq('paiement_id', paymentId)
    .in('status', ['queued', 'failed'])
    .lte('next_run_at', new Date().toISOString());
  const steps = (data ?? []).map((j: { step: PipelineStep }) => j.step);
  if (steps.length === 0) return [];
  await runPostSuccessPipeline(db, paymentId, log, { only: steps, actor: 'retry' });
  return steps;
}

async function safely(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'pipeline_failure_handler_failed', error: String(error) }));
  }
}
