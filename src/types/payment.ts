/**
 * Payment domain types shared between the frontend, the Edge Functions and the
 * database. Request/response contracts of the payment Edge Functions live here
 * so both sides compile against the same shapes.
 */

import type { Paiement } from './database.types';
import type { PaymentEvent, PaymentState, PaymentStateTransition } from '@/services/payment/stateMachine';
import type { PaymentErrorCode } from '@/utils/paymentErrors';

export type { PaymentEvent, PaymentState, PaymentStateTransition, PaymentErrorCode };

/** Provider keys — must match `payment_providers.provider_key`. */
export type PaymentProviderKey = 'orange_money' | 'mpesa' | 'airtel_money' | 'card' | 'bank_transfer';

export const MOBILE_MONEY_PROVIDERS: readonly PaymentProviderKey[] = ['orange_money', 'mpesa', 'airtel_money'] as const;

export type Currency = 'CDF' | 'USD';

/** Row of `payment_providers` (catalogue shown to tenants). */
export interface PaymentProviderRecord {
  id: string;
  provider_key: PaymentProviderKey;
  display_name: string;
  icon_url: string | null;
  subtext: string | null;
  is_active: boolean;
  is_sandbox: boolean;
  supports_partial: boolean;
  supports_refund: boolean;
  requires_phone: boolean;
  min_amount: number;
  max_amount: number;
  processing_time: string | null;
  fee_percentage: number;
  fee_fixed: number;
  refund_window_days: number;
  sort_order: number;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** `paiements` row with the Module-4 state machine columns strongly typed. */
export interface PaymentRecord extends Omit<Paiement, 'state' | 'previous_state' | 'pipeline'> {
  state: PaymentState;
  previous_state: PaymentState | null;
  pipeline: PipelineStatus;
}

// ─── Post-success pipeline ─────────────────────────────────────────────────

export type PipelineStep = 'tax' | 'ledger' | 'receipt' | 'notifications' | 'compliance' | 'audit';

export interface PipelineStepStatus {
  status: 'pending' | 'done' | 'failed' | 'queued';
  at?: string;
  attempts?: number;
  error?: string;
  /** Step-specific result (e.g. impotId, receiptId, ledger entry ids). */
  result?: Record<string, unknown>;
}

export type PipelineStatus = Partial<Record<PipelineStep, PipelineStepStatus>>;

// ─── Edge Function contracts ───────────────────────────────────────────────

export interface InitiatePaymentRequest {
  contractId: string;
  /** Total amount charged to the tenant (rent + tax + fees) in `currency`. */
  amount: number;
  /** Gross rent for the period — the tax base. */
  rentAmount: number;
  currency?: Currency;
  method: PaymentProviderKey;
  phone?: string;
  /** 'YYYY-MM' */
  periode: string;
  idempotencyKey: string;
  description?: string;
  /** Where card / redirect providers should send the user back. */
  returnUrl?: string;
}

export interface InitiatePaymentResponse {
  paymentId: string;
  reference: string;
  state: PaymentState;
  providerTransactionId: string | null;
  redirectUrl?: string;
  message?: string;
  expiresAt: string | null;
  /** True when this response was served from the idempotency cache. */
  idempotentReplay: boolean;
}

export interface VerifyPaymentRequest {
  paymentId: string;
  /** Skip the per-payment rate limit (staff only). */
  force?: boolean;
}

export interface VerifyPaymentResponse {
  paymentId: string;
  state: PaymentState;
  status: Paiement['status'];
  failureReason: string | null;
  providerTransactionId: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  /** Whether the provider was actually queried on this call. */
  providerChecked: boolean;
  receiptId: string | null;
  receiptCode: string | null;
  impotId: string | null;
  pipeline: PipelineStatus;
}

export interface CancelPaymentRequest {
  paymentId: string;
  reason?: string;
}

export interface RefundPaymentRequest {
  paymentId: string;
  /** Defaults to the full amount. */
  amount?: number;
  reason: string;
}

export interface RefundPaymentResponse {
  paymentId: string;
  state: PaymentState;
  refundedAmount: number;
  providerRefundId: string | null;
  taxReversed: boolean;
}

/** Error envelope returned by every Edge Function on failure. */
export interface EdgeFunctionError {
  error: {
    code: PaymentErrorCode | string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

// ─── Frontend view models ──────────────────────────────────────────────────

export interface PaymentMethod {
  id: PaymentProviderKey;
  name: string;
  icon: string;
  subtext: string;
  supportsPartial: boolean;
  supportsRefund: boolean;
  requiresPhone: boolean;
  processingTime: string;
  feePercentage: number;
  feeFixed: number;
  minAmount: number;
  maxAmount: number;
  available: boolean;
  sandbox: boolean;
}

export type PaymentStep = 'select' | 'amount' | 'method' | 'confirm' | 'processing' | 'success' | 'failed';

export interface PaymentStatusSnapshot {
  paymentId: string;
  state: PaymentState;
  failureReason: string | null;
  providerTransactionId: string | null;
  paidAt: string | null;
  receiptId: string | null;
  receiptCode: string | null;
  impotId: string | null;
  pipeline: PipelineStatus;
  /** Where the snapshot came from — useful for debugging the hybrid hook. */
  source: 'initial' | 'realtime' | 'poll' | 'timeout';
  updatedAt: string;
}

export function isMobileMoneyProvider(key: PaymentProviderKey | string): boolean {
  return (MOBILE_MONEY_PROVIDERS as readonly string[]).includes(key);
}

/** Maps a provider key to the legacy `payment_method` enum of `paiements.method`. */
export function providerKeyToDbMethod(key: PaymentProviderKey): Paiement['method'] {
  switch (key) {
    case 'orange_money':
      return 'Orange Money';
    case 'mpesa':
      return 'M-Pesa';
    case 'airtel_money':
      return 'Airtel Money';
    case 'card':
    case 'bank_transfer':
    default:
      return 'Bank';
  }
}
