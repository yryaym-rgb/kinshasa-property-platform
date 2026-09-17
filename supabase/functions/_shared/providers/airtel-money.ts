/**
 * Airtel Money (RDC) adapter — Airtel Africa Open API (openapi.airtel.africa).
 *
 * Auth flow : OAuth2 client_credentials (client_id / client_secret) →
 *             Bearer token, `expires_in` ≈ 180 s. Cached with TTL.
 * Endpoints :
 *   POST {baseUrl}/auth/oauth2/token                              → access_token
 *   POST {baseUrl}/merchant/v1/payments/                          → USSD push (X-Country: CD, X-Currency: CDF)
 *   GET  {baseUrl}/standard/v1/payments/{transactionId}           → status (TIP | TS | TF | TA | TE)
 *   POST {baseUrl}/standard/v1/payments/refund                    → refund
 * Webhook : Airtel POSTs `{ transaction: { id, message, status_code, airtel_money_id } }`
 *           to the callback URL configured in the merchant portal. Airtel
 *           supports a hash in the `X-Auth-Token`/`hash` field computed as
 *           HMAC-SHA256(body, callback secret) — verified here.
 *
 * All real HTTP calls: `// TODO: Enable in production`.
 */

import { BaseProvider, getCachedToken, httpJson, sandboxInitiate, sandboxRefund, sandboxVerify } from './base.ts';
import type {
  ParsedWebhook,
  ProviderConfig,
  ProviderInitRequest,
  ProviderInitResponse,
  ProviderRefundResponse,
  ProviderStatus,
  ProviderVerifyResponse,
} from './types.ts';
import { ProviderError } from './types.ts';

/**
 * Airtel transaction status codes:
 *   TIP = Transaction In Progress, TS = Success, TF = Failed,
 *   TA = Ambiguous (query again), TE = Expired.
 */
const STATUS_MAP: Record<string, ProviderStatus> = {
  TIP: 'processing',
  TA: 'processing',
  TS: 'succeeded',
  TF: 'failed',
  TE: 'failed',
  SUCCESS: 'succeeded',
  FAILED: 'failed',
};

/** Airtel `status.response_code` / `result_code` → canonical codes. */
const ERROR_MAP: Record<string, string> = {
  DP00800001000: 'succeeded', // Transaction successful
  DP00800001001: 'processing', // Transaction in progress
  DP00800001002: 'user_cancelled',
  DP00800001003: 'insufficient_funds',
  DP00800001004: 'phone_not_registered', // Invalid MSISDN / not registered
  DP00800001005: 'account_limit_exceeded',
  DP00800001006: 'user_timeout', // Transaction timed out
  DP00800001007: 'wrong_pin',
  DP00800001008: 'account_blocked',
  DP00800001009: 'invalid_amount',
  DP00800001010: 'provider_error',
  DP00800001024: 'duplicate_payment', // Duplicate transaction id
  DP00800001025: 'provider_unavailable',
  ESB000001: 'provider_error',
  ESB000004: 'provider_unavailable',
  ESB000008: 'invalid_provider_response', // Field validation
  ESB000010: 'invalid_provider_response',
  ESB000011: 'provider_error',
  ESB000033: 'invalid_phone',
  ESB000034: 'invalid_amount',
  ESB000035: 'provider_rejected',
  ESB000036: 'invalid_provider_response',
  ESB000039: 'provider_timeout',
  ESB000041: 'provider_error',
  ESB000045: 'invalid_provider_response',
};

interface AirtelTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface AirtelPaymentResponse {
  data?: { transaction?: { id?: string; status?: string; airtel_money_id?: string; message?: string } };
  status?: { code?: string; message?: string; result_code?: string; response_code?: string; success?: boolean };
}

export class AirtelMoneyProvider extends BaseProvider {
  readonly signatureHeader = 'x-auth-token';

  constructor() {
    super('airtel_money', 'Airtel Money');
  }

  private async token(config: ProviderConfig): Promise<string> {
    return getCachedToken(`airtel:${config.apiKey}`, async () => {
      // TODO: Enable in production.
      const { status, data } = await httpJson<AirtelTokenResponse>(this.key, `${config.baseUrl}/auth/oauth2/token`, {
        method: 'POST',
        body: { client_id: config.apiKey, client_secret: config.apiSecret, grant_type: 'client_credentials' },
      });
      if (status !== 200 || !data.access_token) {
        throw new ProviderError(this.key, 'provider_unavailable', 'Échec OAuth Airtel Money', { retryable: true, raw: data });
      }
      return { token: data.access_token, expiresInSeconds: data.expires_in ?? 180 };
    });
  }

  private headers(config: ProviderConfig, token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'X-Country': config.extra?.country ?? 'CD',
      'X-Currency': config.extra?.currency ?? 'CDF',
    };
  }

  async initiate(config: ProviderConfig, req: ProviderInitRequest): Promise<ProviderInitResponse> {
    if (config.sandbox) return sandboxInitiate('AM', req);
    if (!req.phone) throw new ProviderError(this.key, 'invalid_phone', 'Numéro requis pour Airtel Money');

    // TODO: Enable in production.
    const token = await this.token(config);
    const { status, data } = await httpJson<AirtelPaymentResponse>(this.key, `${config.baseUrl}/merchant/v1/payments/`, {
      method: 'POST',
      headers: this.headers(config, token),
      body: {
        reference: req.description.slice(0, 64),
        subscriber: { country: config.extra?.country ?? 'CD', currency: req.currency, msisdn: req.phone.replace(/^\+243/, '') },
        transaction: { amount: Math.round(req.amount), country: config.extra?.country ?? 'CD', currency: req.currency, id: req.reference },
      },
    });

    if (status >= 500) throw new ProviderError(this.key, 'provider_unavailable', 'Airtel Money indisponible', { retryable: true, raw: data });
    if (status >= 400 || data.status?.success === false) {
      const mapped = this.mapError(data.status?.response_code ?? data.status?.result_code ?? data.status?.code, ERROR_MAP);
      return { providerTransactionId: req.reference, status: 'failed', failureCode: mapped, message: data.status?.message, raw: data };
    }

    return {
      providerTransactionId: data.data?.transaction?.id ?? req.reference,
      status: 'requires_action',
      message: 'Confirmez le paiement avec votre code PIN Airtel Money',
      raw: data,
    };
  }

  async verify(config: ProviderConfig, txId: string): Promise<ProviderVerifyResponse> {
    if (config.sandbox) return sandboxVerify(txId);

    // TODO: Enable in production.
    const token = await this.token(config);
    const { status, data } = await httpJson<AirtelPaymentResponse>(this.key, `${config.baseUrl}/standard/v1/payments/${encodeURIComponent(txId)}`, {
      method: 'GET',
      headers: this.headers(config, token),
    });
    if (status >= 500) throw new ProviderError(this.key, 'provider_unavailable', 'Airtel Money indisponible', { retryable: true, raw: data });

    const native = data.data?.transaction?.status;
    const normalized = this.normalizeStatus(native, STATUS_MAP);
    return {
      status: normalized,
      providerReference: data.data?.transaction?.airtel_money_id ?? txId,
      paidAt: normalized === 'succeeded' ? new Date().toISOString() : undefined,
      failureReason: normalized === 'failed' ? this.mapError(data.status?.response_code ?? data.status?.result_code, ERROR_MAP) : undefined,
      raw: data,
    };
  }

  async refund(config: ProviderConfig, txId: string, amount: number, _reason: string): Promise<ProviderRefundResponse> {
    if (config.sandbox) return sandboxRefund('AM', txId, amount);

    // TODO: Enable in production.
    const token = await this.token(config);
    const { status, data } = await httpJson<AirtelPaymentResponse>(this.key, `${config.baseUrl}/standard/v1/payments/refund`, {
      method: 'POST',
      headers: this.headers(config, token),
      body: { transaction: { airtel_money_id: txId } },
    });
    if (status >= 500) throw new ProviderError(this.key, 'provider_unavailable', 'Airtel Money indisponible', { retryable: true, raw: data });
    return {
      providerRefundId: data.data?.transaction?.airtel_money_id ?? `AM-RFD-${Date.now().toString(36)}`,
      status: data.status?.success === false ? 'failed' : 'succeeded',
      message: data.status?.message,
      raw: data,
    };
  }

  parseWebhook(payload: unknown, _headers: Headers): ParsedWebhook | null {
    if (!payload || typeof payload !== 'object') return null;
    const tx = (payload as { transaction?: Record<string, unknown> }).transaction;
    if (!tx) return null;
    const id = tx.id as string | undefined;
    const statusCode = (tx.status_code as string | undefined) ?? (tx.status as string | undefined);
    if (!id || !statusCode) return null;

    const normalized = this.normalizeStatus(statusCode, STATUS_MAP);
    return {
      eventId: `${(tx.airtel_money_id as string | undefined) ?? id}:${statusCode}`,
      eventType: `payment.${statusCode}`,
      providerTransactionId: (tx.airtel_money_id as string | undefined) ?? id,
      merchantReference: id,
      status: statusCode === 'TE' ? 'expired' : normalized,
      failureReason: normalized === 'failed' ? this.mapError(tx.message as string | undefined, ERROR_MAP) : undefined,
      amount: typeof tx.amount === 'number' ? tx.amount : undefined,
      paidAt: normalized === 'succeeded' ? new Date().toISOString() : undefined,
    };
  }
}

export const airtelMoneyProvider = new AirtelMoneyProvider();
