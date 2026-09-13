import type { Paiement } from '@/types/database.types';
import type { TaxCalculationResult } from '@/services/tax/taxService';

export type PaymentProviderId =
  | 'orange_money'
  | 'mpesa'
  | 'airtel_money'
  | 'card'
  | 'bank';

export interface PaymentProvider {
  id: PaymentProviderId;
  name: string;
  icon: string;
  subtext: string;
  supportsPartial: boolean;
  processingTime: string;
  initiate(params: PaymentInitParams): Promise<PaymentInitResult>;
  verify(transactionId: string): Promise<PaymentVerifyResult>;
  cancel(transactionId: string): Promise<void>;
}

export interface PaymentInitParams {
  amount: number;
  currency: 'CDF' | 'USD';
  phone?: string;
  reference: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitResult {
  providerTransactionId: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  redirectUrl?: string;
  message?: string;
}

export interface PaymentVerifyResult {
  status: 'pending' | 'processing' | 'success' | 'failed';
  providerReference?: string;
  paidAt?: string;
  failureReason?: string;
}

export interface InitiatePaymentInput {
  contratId: string;
  tenantId: string;
  amount: number;
  rentAmount: number;
  currency: 'CDF' | 'USD';
  method: PaymentProviderId;
  phone?: string;
  periode: string;
  idempotencyKey: string;
  description?: string;
}

export interface PaymentResult {
  status: 'success' | 'failed' | 'pending';
  payment?: Paiement & { receiptId?: string; receiptCode?: string };
  failureReason?: string;
  providerReference?: string;
}

export interface PaymentStatus {
  id: string;
  status: Paiement['status'];
  failureReason?: string | null;
  providerReference?: string | null;
}

export interface PaymentMethod {
  id: PaymentProviderId;
  name: string;
  icon: string;
  subtext: string;
  supportsPartial: boolean;
  processingTime: string;
  available: boolean;
}

export interface PaymentBreakdown extends TaxCalculationResult {
  method: PaymentProviderId;
}

export type PaymentStep = 'select' | 'amount' | 'method' | 'confirm' | 'processing' | 'success' | 'failed';

export interface PaymentWizardState {
  contratId?: string;
  amount?: number;
  rentAmount?: number;
  periode?: string;
  method?: PaymentProviderId;
  phone?: string;
  breakdown?: PaymentBreakdown;
  idempotencyKey?: string;
  paymentId?: string;
  failureReason?: string;
}

export const FAILURE_REASON_MESSAGES: Record<string, string> = {
  insufficient_funds: 'Solde insuffisant sur votre compte Orange Money.',
  user_cancelled: 'Vous avez annulé le paiement.',
  timeout: 'Le délai de traitement a expiré. Veuillez réessayer.',
  provider_error: 'Erreur du service Orange Money. Réessayez dans quelques instants.',
};

export function getFailureMessage(reason?: string | null): string {
  if (!reason) return 'Une erreur est survenue. Veuillez réessayer.';
  return FAILURE_REASON_MESSAGES[reason] ?? reason;
}

export function providerIdToDbMethod(id: PaymentProviderId): string {
  const map: Record<PaymentProviderId, string> = {
    orange_money: 'Orange Money',
    mpesa: 'M-Pesa',
    airtel_money: 'Airtel Money',
    card: 'Bank',
    bank: 'Bank',
  };
  return map[id];
}

export function isMobileMoneyProvider(id: PaymentProviderId): boolean {
  return id === 'orange_money' || id === 'mpesa' || id === 'airtel_money';
}
