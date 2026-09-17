/**
 * Supabase clients for Edge Functions.
 *
 * - `serviceClient()`  → bypasses RLS. Used for every state mutation so that
 *                        the frontend never needs write access to `paiements`.
 * - `userClient(jwt)`  → runs with the caller's RLS context. Used to *read*
 *                        what the caller is allowed to see (e.g. their contract).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from './env.ts';

// The generated Database type lives in the frontend (src/types/database.types.ts).
// Edge Functions use an untyped client and validate rows with zod where it matters.
// deno-lint-ignore no-explicit-any
export type DbClient = SupabaseClient<any, 'public', any>;

let cachedService: DbClient | null = null;

export function serviceClient(): DbClient {
  if (!cachedService) {
    cachedService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-eloyer-client': 'edge-function' } },
    });
  }
  return cachedService;
}

export function userClient(jwt: string): DbClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

// ─── Common row shapes (subset of columns actually used) ───────────────────

export interface PaymentRow {
  id: string;
  reference: string;
  contrat_id: string;
  montant: number;
  currency: 'CDF' | 'USD';
  method: string;
  status: string;
  state: string;
  previous_state: string | null;
  provider: string | null;
  provider_transaction_id: string | null;
  periode: string;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
  idempotency_key: string | null;
  failure_reason: string | null;
  provider_metadata: Record<string, unknown> | null;
  tax_calculation: Record<string, unknown> | null;
  notifications_sent: boolean;
  attempt_count: number;
  last_attempt_at: string | null;
  last_verified_at: string | null;
  expires_at: string | null;
  initiated_by: string | null;
  pipeline: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ContractRow {
  id: string;
  code: string;
  logement_id: string;
  bailleur_id: string;
  locataire_id: string;
  status: string;
  loyer_mensuel: number;
  currency: 'CDF' | 'USD';
  logement?: {
    id: string;
    code: string;
    type: string;
    commune: string;
    address: string;
    loyer_mensuel: number;
  } | null;
  bailleur?: {
    id: string;
    user_id: string;
    business_name: string | null;
    tax_id: string | null;
  } | null;
}

export interface ProviderRow {
  provider_key: string;
  display_name: string;
  is_active: boolean;
  is_sandbox: boolean;
  supports_refund: boolean;
  requires_phone: boolean;
  min_amount: number;
  max_amount: number;
  fee_percentage: number;
  fee_fixed: number;
  refund_window_days: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export async function getPayment(db: DbClient, id: string): Promise<PaymentRow | null> {
  const { data, error } = await db.from('paiements').select('*').eq('id', id).maybeSingle();
  if (error) throw new DbError('paiements.select', error.message);
  return (data as PaymentRow | null) ?? null;
}

export async function getPaymentByProviderTx(db: DbClient, provider: string, providerTxId: string): Promise<PaymentRow | null> {
  const { data, error } = await db
    .from('paiements')
    .select('*')
    .eq('provider', provider)
    .eq('provider_transaction_id', providerTxId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new DbError('paiements.selectByProviderTx', error.message);
  return (data as PaymentRow | null) ?? null;
}

export async function getPaymentByReference(db: DbClient, reference: string): Promise<PaymentRow | null> {
  const { data, error } = await db.from('paiements').select('*').eq('reference', reference).maybeSingle();
  if (error) throw new DbError('paiements.selectByReference', error.message);
  return (data as PaymentRow | null) ?? null;
}

export async function getContract(db: DbClient, id: string): Promise<ContractRow | null> {
  const { data, error } = await db
    .from('contrats')
    .select(
      `id, code, logement_id, bailleur_id, locataire_id, status, loyer_mensuel, currency,
       logement:logements(id, code, type, commune, address, loyer_mensuel),
       bailleur:bailleurs(id, user_id, business_name, tax_id)`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new DbError('contrats.select', error.message);
  return (data as unknown as ContractRow | null) ?? null;
}

export async function getProviderRow(db: DbClient, key: string): Promise<ProviderRow | null> {
  const { data, error } = await db.from('payment_providers').select('*').eq('provider_key', key).maybeSingle();
  if (error) throw new DbError('payment_providers.select', error.message);
  return (data as ProviderRow | null) ?? null;
}

export interface TransitionPatch {
  provider_transaction_id?: string;
  failure_reason?: string | null;
  paid_at?: string;
  expires_at?: string;
  provider_metadata?: Record<string, unknown>;
}

/**
 * Atomic state transition through the SQL function defined in migration 006.
 * Writes the `payment_state_history` row in the same transaction.
 */
export async function transitionPayment(
  db: DbClient,
  args: {
    paymentId: string;
    from: string | null;
    to: string;
    event: string;
    reason?: string;
    actor?: string;
    metadata?: Record<string, unknown>;
    patch?: TransitionPatch;
  },
): Promise<PaymentRow> {
  const { data, error } = await db.rpc('transition_payment_state', {
    p_paiement_id: args.paymentId,
    p_from_state: args.from,
    p_to_state: args.to,
    p_event: args.event,
    p_reason: args.reason ?? null,
    p_actor: args.actor ?? 'system',
    p_metadata: args.metadata ?? null,
    p_patch: args.patch ?? null,
  });
  if (error) {
    if (error.message.includes('invalid_transition')) throw new DbError('transition', error.message, 'invalid_state');
    if (error.message.includes('payment_not_found')) throw new DbError('transition', error.message, 'payment_not_found');
    throw new DbError('transition', error.message);
  }
  return data as PaymentRow;
}

export async function writeAuditLog(
  db: DbClient,
  entry: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    oldData?: unknown;
    newData?: unknown;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<void> {
  const { error } = await db.from('audit_logs').insert({
    user_id: entry.userId ?? null,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    old_data: entry.oldData ?? null,
    new_data: entry.newData ?? null,
    ip_address: entry.ip ?? null,
    user_agent: entry.userAgent ?? null,
  });
  // Audit failures must never break the business flow — but they must be visible.
  if (error) console.error(JSON.stringify({ level: 'error', msg: 'audit_log_failed', action: entry.action, error: error.message }));
}

export async function updatePipeline(
  db: DbClient,
  paymentId: string,
  step: string,
  status: { status: 'pending' | 'done' | 'failed' | 'queued'; error?: string; result?: Record<string, unknown>; attempts?: number },
): Promise<void> {
  const current = await getPayment(db, paymentId);
  const pipeline = { ...(current?.pipeline ?? {}), [step]: { ...status, at: new Date().toISOString() } };
  const { error } = await db.from('paiements').update({ pipeline }).eq('id', paymentId);
  if (error) throw new DbError('paiements.updatePipeline', error.message);
}

export class DbError extends Error {
  readonly operation: string;
  readonly code: string;
  constructor(operation: string, message: string, code = 'db_error') {
    super(`${operation}: ${message}`);
    this.name = 'DbError';
    this.operation = operation;
    this.code = code;
  }
}
