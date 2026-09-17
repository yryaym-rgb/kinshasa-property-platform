/**
 * Provider adapter contract. Every mobile-money / card operator implements
 * this interface; the Edge Functions never talk to an operator directly.
 */

export type ProviderKey = 'orange_money' | 'mpesa' | 'airtel_money' | 'card' | 'bank_transfer';

export interface ProviderConfig {
  apiKey: string;
  apiSecret: string;
  merchantId: string;
  baseUrl: string;
  webhookSecret: string;
  sandbox: boolean;
  /** Provider-specific, non-secret extras (country code, market, public key…). */
  extra?: Record<string, string>;
}

export interface ProviderInitRequest {
  amount: number;
  currency: string;
  phone?: string;
  /** Our payment reference (TXN-…) — becomes the merchant reference at the provider. */
  reference: string;
  description: string;
  returnUrl?: string;
  /** URL the provider must call back (payment-webhook?provider=…). */
  notifyUrl?: string;
  metadata?: Record<string, unknown>;
}

/** Provider status normalised to our vocabulary. Maps 1:1 to state-machine events. */
export type ProviderStatus = 'pending' | 'processing' | 'requires_action' | 'succeeded' | 'failed';

export interface ProviderInitResponse {
  providerTransactionId: string;
  status: ProviderStatus;
  redirectUrl?: string;
  message?: string;
  /** Normalised failure code when status = failed. */
  failureCode?: string;
  raw: unknown;
}

export interface ProviderVerifyResponse {
  status: ProviderStatus;
  providerReference?: string;
  paidAt?: string;
  amount?: number;
  currency?: string;
  /** Normalised failure code when status = failed. */
  failureReason?: string;
  raw: unknown;
}

export interface ProviderRefundResponse {
  providerRefundId: string;
  status: 'pending' | 'succeeded' | 'failed';
  message?: string;
  raw: unknown;
}

/** Result of parsing a webhook body into something the state machine understands. */
export interface ParsedWebhook {
  /** Unique id of the event at the provider (for idempotency). */
  eventId: string;
  eventType: string;
  providerTransactionId: string | null;
  /** Our reference echoed back by the provider, if any. */
  merchantReference: string | null;
  status: ProviderStatus | 'cancelled' | 'expired' | 'refunded' | 'unknown';
  failureReason?: string;
  amount?: number;
  currency?: string;
  paidAt?: string;
}

export interface PaymentProviderAdapter {
  readonly key: ProviderKey;
  readonly displayName: string;

  initiate(config: ProviderConfig, req: ProviderInitRequest): Promise<ProviderInitResponse>;
  verify(config: ProviderConfig, txId: string): Promise<ProviderVerifyResponse>;
  refund?(config: ProviderConfig, txId: string, amount: number, reason: string): Promise<ProviderRefundResponse>;

  /** HMAC verification of the raw body. Must be constant-time and never throw. */
  verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean>;
  /** Header carrying the signature for this provider. */
  readonly signatureHeader: string;
  /** Turns the raw webhook JSON into a normalised event. Returns null when unrecognised. */
  parseWebhook(payload: unknown, headers: Headers): ParsedWebhook | null;
}

export class ProviderError extends Error {
  readonly code: string;
  readonly provider: string;
  readonly retryable: boolean;
  readonly raw?: unknown;
  constructor(provider: string, code: string, message: string, options?: { retryable?: boolean; raw?: unknown }) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.raw = options?.raw;
  }
}
