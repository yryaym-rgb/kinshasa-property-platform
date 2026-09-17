/**
 * Payment service types.
 *
 * The canonical domain types live in `@/types/payment` (shared with the Edge
 * Functions). This module keeps the wizard-specific view models and a few
 * backwards-compatible aliases used by Module 2 screens.
 */

import type { Paiement } from '@/types/database.types';
import type { TaxBreakdown } from '@/services/tax/taxService';
import type { PaymentProviderKey, PaymentState } from '@/types/payment';
import { getPaymentErrorMessage } from '@/utils/paymentErrors';

export type {
  PaymentMethod,
  PaymentStep,
  PaymentProviderKey,
  PaymentState,
  PaymentStatusSnapshot,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  RefundPaymentRequest,
  RefundPaymentResponse,
  PaymentRecord,
  PipelineStatus,
} from '@/types/payment';
export { isMobileMoneyProvider, providerKeyToDbMethod, MOBILE_MONEY_PROVIDERS } from '@/types/payment';

/** @deprecated use `PaymentProviderKey` */
export type PaymentProviderId = PaymentProviderKey;

/** Input of `paymentService.initiatePayment` (frontend side). */
export interface InitiatePaymentInput {
  contratId: string;
  tenantId: string;
  /** Total charged to the tenant. */
  amount: number;
  /** Gross rent (tax base). */
  rentAmount: number;
  currency: 'CDF' | 'USD';
  method: PaymentProviderKey;
  phone?: string;
  periode: string;
  idempotencyKey?: string;
  description?: string;
  returnUrl?: string;
}

/** Result of `paymentService.initiatePayment`. */
export interface PaymentResult {
  paymentId: string;
  reference: string;
  state: PaymentState;
  providerTransactionId: string | null;
  redirectUrl?: string;
  message?: string;
  expiresAt: string | null;
  idempotentReplay: boolean;
}

/** Lightweight status returned by `paymentService.getPaymentStatus`. */
export interface PaymentStatus {
  id: string;
  state: PaymentState;
  status: Paiement['status'];
  failureReason?: string | null;
  providerReference?: string | null;
  paidAt?: string | null;
  receiptId?: string | null;
  receiptCode?: string | null;
}

export interface PaymentBreakdown extends TaxBreakdown {
  method: PaymentProviderKey;
}

export interface PaymentWizardState {
  contratId?: string;
  amount?: number;
  rentAmount?: number;
  periode?: string;
  method?: PaymentProviderKey;
  phone?: string;
  breakdown?: PaymentBreakdown;
  idempotencyKey?: string;
  paymentId?: string;
  failureReason?: string;
}

/** @deprecated use `getPaymentErrorMessage` from `@/utils/paymentErrors` */
export function getFailureMessage(reason?: string | null): string {
  return getPaymentErrorMessage(reason);
}
