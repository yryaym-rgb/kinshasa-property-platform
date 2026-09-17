/**
 * Frontend payment service — a thin, typed client of the payment Edge
 * Functions. The browser NEVER writes `paiements` and never talks to a
 * mobile-money operator: every mutation goes through
 * payment-initiate / payment-verify / payment-refund (service role + audit),
 * and user cancellation goes through the ownership-checked SQL RPC
 * `cancel_own_payment`.
 *
 * Reads (payment list, receipt lookup, provider catalogue) use the RLS-scoped
 * Supabase client directly.
 */

import { supabase } from '@/config/supabase';
import type { Paiement } from '@/types/database.types';
import type {
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  PaymentMethod,
  PaymentProviderKey,
  PaymentProviderRecord,
  PaymentRecord,
  RefundPaymentRequest,
  RefundPaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
} from '@/types/payment';
import { isMobileMoneyProvider } from '@/types/payment';
import { mapEdgeError, PaymentError } from '@/utils/paymentErrors';
import { withRetry } from './retryPolicy';
import type { InitiatePaymentInput, PaymentResult, PaymentStatus } from './types';
import type { PaymentStateTransition } from './stateMachine';

const PROVIDER_ICONS: Record<PaymentProviderKey, string> = {
  orange_money: 'orange',
  mpesa: 'mpesa',
  airtel_money: 'airtel',
  card: 'card',
  bank_transfer: 'bank',
};

export function generateIdempotencyKey(contractId: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `pay-${contractId.slice(0, 8)}-${Date.now()}-${rand}`;
}

async function invoke<TReq extends object, TRes>(name: string, body: TReq): Promise<TRes> {
  const { data, error } = await supabase.functions.invoke<TRes>(name, { body: body as Record<string, unknown> });
  if (error) throw await mapEdgeError(error);
  if (data === null || data === undefined) throw new PaymentError('invalid_provider_response');
  return data;
}

export const paymentService = {
  generateIdempotencyKey,

  /**
   * Creates the payment and hands it to the operator. Safe to retry: the
   * idempotency key guarantees the same key → the same payment.
   */
  async initiatePayment(input: InitiatePaymentInput, options?: { signal?: AbortSignal }): Promise<PaymentResult> {
    const idempotencyKey = input.idempotencyKey ?? generateIdempotencyKey(input.contratId);
    const body: InitiatePaymentRequest = {
      contractId: input.contratId,
      amount: Math.round(input.amount),
      rentAmount: Math.round(input.rentAmount),
      currency: input.currency,
      method: input.method,
      phone: input.phone,
      periode: input.periode,
      idempotencyKey,
      description: input.description,
      returnUrl: input.returnUrl ?? (typeof window !== 'undefined' ? `${window.location.origin}/locataire/paiements/succes` : undefined),
    };

    return withRetry(() => invoke<InitiatePaymentRequest, InitiatePaymentResponse>('payment-initiate', body), {
      idempotent: true,
      signal: options?.signal,
      policy: { maxAttempts: 3, baseDelayMs: 800, maxDelayMs: 4000 },
    });
  },

  /** Smart status check (terminal → DB, otherwise provider verify, rate-limited server-side). */
  async verifyPayment(paymentId: string, options?: { force?: boolean; signal?: AbortSignal }): Promise<VerifyPaymentResponse> {
    const body: VerifyPaymentRequest = { paymentId, force: options?.force };
    return withRetry(() => invoke<VerifyPaymentRequest, VerifyPaymentResponse>('payment-verify', body), {
      idempotent: true,
      signal: options?.signal,
      policy: { maxAttempts: 2, baseDelayMs: 500, maxDelayMs: 2000 },
    });
  },

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const v = await this.verifyPayment(paymentId);
    return {
      id: v.paymentId,
      state: v.state,
      status: v.status,
      failureReason: v.failureReason,
      providerReference: v.providerTransactionId,
      paidAt: v.paidAt,
      receiptId: v.receiptId,
      receiptCode: v.receiptCode,
    };
  },

  /** User cancellation through the state machine (only legal from draft/validating/pending/requires_action). */
  async cancelPayment(paymentId: string, reason?: string): Promise<PaymentRecord> {
    const { data, error } = await supabase.rpc('cancel_own_payment', { p_paiement_id: paymentId, p_reason: reason ?? null });
    if (error) {
      const code = error.message.includes('invalid_transition') ? 'invalid_state' : error.message.includes('forbidden') ? 'forbidden' : error.message.includes('payment_not_found') ? 'payment_not_found' : 'unknown';
      throw new PaymentError(code, { details: error.message });
    }
    return data as unknown as PaymentRecord;
  },

  /** Landlord / admin refund. Never retried automatically (the provider call is not idempotent). */
  async refundPayment(paymentId: string, amount: number | undefined, reason: string): Promise<RefundPaymentResponse> {
    const body: RefundPaymentRequest = { paymentId, amount, reason };
    return invoke<RefundPaymentRequest, RefundPaymentResponse>('payment-refund', body);
  },

  /** Provider catalogue (`payment_providers`) as wizard view models. */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const { data, error } = await supabase
      .from('payment_providers')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('display_name', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as PaymentProviderRecord[]).map((p) => ({
      id: p.provider_key,
      name: p.display_name,
      icon: p.icon_url ?? PROVIDER_ICONS[p.provider_key] ?? 'bank',
      subtext: p.subtext ?? '',
      supportsPartial: p.supports_partial,
      supportsRefund: p.supports_refund,
      requiresPhone: p.requires_phone ?? isMobileMoneyProvider(p.provider_key),
      processingTime: p.processing_time ?? '',
      feePercentage: Number(p.fee_percentage),
      feeFixed: Number(p.fee_fixed),
      minAmount: Number(p.min_amount),
      maxAmount: Number(p.max_amount),
      available: p.is_active,
      sandbox: p.is_sandbox,
    }));
  },

  async getPaymentById(id: string): Promise<PaymentRecord> {
    const { data, error } = await supabase.from('paiements').select('*').eq('id', id).single();
    if (error) throw new PaymentError(error.code === 'PGRST116' ? 'payment_not_found' : 'unknown', { details: error.message });
    return data as unknown as PaymentRecord;
  },

  async getStateHistory(paymentId: string): Promise<PaymentStateTransition[]> {
    const { data, error } = await supabase
      .from('payment_state_history')
      .select('*')
      .eq('paiement_id', paymentId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PaymentStateTransition[];
  },

  async getPaymentsForTenant(
    tenantId: string,
    filters?: { year?: number | 'all'; status?: string; search?: string },
  ) {
    let query = supabase
      .from('paiements')
      .select(`
        *,
        recu:recus(code, id),
        contrat:contrats!inner(
          locataire_id,
          logement:logements(code, address, type, rooms, commune)
        )
      `)
      .eq('contrat.locataire_id', tenantId)
      .order('created_at', { ascending: false });

    if (filters?.year && filters.year !== 'all') {
      query = query.gte('periode', `${filters.year}-01`).lte('periode', `${filters.year}-12`);
    }
    if (filters?.status && filters.status !== 'all') {
      const statusMap: Record<string, Paiement['status']> = {
        reussi: 'complete',
        en_attente: 'en_attente',
        echoue: 'echoue',
      };
      const dbStatus = statusMap[filters.status] ?? (filters.status as Paiement['status']);
      query = query.eq('status', dbStatus);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let results = data ?? [];
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter((p) => {
        const logement = (p.contrat as { logement?: { code?: string } })?.logement;
        return p.reference.toLowerCase().includes(q) || (logement?.code?.toLowerCase().includes(q) ?? false);
      });
    }
    return results;
  },
};
