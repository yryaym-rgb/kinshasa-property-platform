/**
 * Orange Money (RDC) adapter — Orange Developer "Web Payment" API.
 *
 * Auth flow : OAuth2 client_credentials → Bearer token (TTL ~ 90 days on OM
 *             but we cache with the TTL the token endpoint returns).
 * Endpoints (production, to be confirmed with the Orange RDC account manager):
 *   POST {baseUrl}/oauth/v3/token                                  → access_token
 *   POST {baseUrl}/orange-money-webpay/{cc}/v1/webpayment          → pay_token, payment_url, notif_token
 *   POST {baseUrl}/orange-money-webpay/{cc}/v1/transactionstatus   → status (INITIATED | PENDING | SUCCESS | FAILED | EXPIRED)
 *   Refund: not exposed by WebPayment; done through the OM merchant back-office
 *           or the "Cash-out / Merchant Payment" API — modelled here as a
 *           request logged for manual processing.
 * Webhook : Orange POSTs {status, notif_token, txnid} to `notif_url`. There is
 *           no vendor HMAC; we secure the endpoint with our own shared secret
 *           in the `X-Signature` header (HMAC-SHA256 of raw body), configured
 *           on the OM side as a static header, plus the per-payment
 *           `notif_token` echo check done in payment-webhook.
 *
 * Every real HTTP call is guarded by `config.sandbox` and marked
 * `// TODO: Enable in production` — in sandbox the deterministic simulator
 * in base.ts is used and no network call is made.
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

/** Orange Money native status → normalised status. */
const STATUS_MAP: Record<string, ProviderStatus> = {
  INITIATED: 'pending',
  PENDING: 'processing',
  SUCCESS: 'succeeded',
  SUCCESSFUL: 'succeeded',
  FAILED: 'failed',
  EXPIRED: 'failed',
  CANCELLED: 'failed',
};

/** Orange Money native error codes → canonical codes (docs/MOBILE_MONEY_INTEGRATION.md). */
const ERROR_MAP: Record<string, string> = {
  '60019': 'insufficient_funds', // "Le solde du compte est insuffisant"
  '60020': 'account_limit_exceeded',
  '60021': 'phone_not_registered',
  '60022': 'account_blocked',
  '60023': 'wrong_pin',
  '60024': 'pin_attempts_exceeded',
  '60025': 'user_cancelled',
  '60026': 'user_timeout',
  '60030': 'provider_unavailable',
  '50': 'provider_error',
  '4001': 'invalid_amount',
  '4002': 'invalid_phone',
  EXPIRED: 'user_timeout',
  CANCELLED: 'user_cancelled',
};

interface OmTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface OmWebPaymentResponse {
  status: number;
  message: string;
  pay_token: string;
  payment_url: string;
  notif_token: string;
}

interface OmStatusResponse {
  status: string; // INITIATED | PENDING | SUCCESS | FAILED | EXPIRED
  order_id: string;
  txnid?: string;
  amount?: number;
  code?: string;
}

export class OrangeMoneyProvider extends BaseProvider {
  readonly signatureHeader = 'x-signature';

  constructor() {
    super('orange_money', 'Orange Money');
  }

  private token(config: ProviderConfig): Promise<string> {
    return getCachedToken(`om:${config.merchantId}`, async () => {
      // TODO: Enable in production — real OAuth call to Orange.
      const basic = btoa(`${config.apiKey}:${config.apiSecret}`);
      const { status, data } = await httpJson<OmTokenResponse>(this.key, `${config.baseUrl}/oauth/v3/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: undefined,
      });
      if (status !== 200 || !data.access_token) {
        throw new ProviderError(this.key, 'provider_unavailable', 'Échec OAuth Orange Money', { retryable: true, raw: data });
      }
      return { token: data.access_token, expiresInSeconds: data.expires_in ?? 3600 };
    });
  }

  async initiate(config: ProviderConfig, req: ProviderInitRequest): Promise<ProviderInitResponse> {
    if (config.sandbox) return sandboxInitiate('OM', req);

    // TODO: Enable in production — validated against Orange RDC sandbox first.
    const token = await this.token(config);
    const cc = config.extra?.countryCode ?? 'cd';
    const { status, data } = await httpJson<OmWebPaymentResponse>(this.key, `${config.baseUrl}/orange-money-webpay/${cc}/v1/webpayment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        merchant_key: config.extra?.merchantKey ?? config.merchantId,
        currency: req.currency === 'CDF' ? 'CDF' : 'USD',
        order_id: req.reference,
        amount: Math.round(req.amount),
        return_url: req.returnUrl,
        cancel_url: req.returnUrl,
        notif_url: req.notifyUrl,
        lang: 'fr',
        reference: req.description.slice(0, 50),
      },
    });

    if (status !== 201 || !data.pay_token) {
      const code = this.mapError(data.status, ERROR_MAP);
      throw new ProviderError(this.key, code, data.message ?? 'Initiation refusée par Orange Money', { raw: data });
    }

    return {
      providerTransactionId: data.pay_token,
      status: 'requires_action',
      redirectUrl: data.payment_url,
      message: 'Confirmez le paiement sur la page Orange Money',
      raw: { ...data, notif_token: '[REDACTED]' },
    };
  }

  async verify(config: ProviderConfig, txId: string): Promise<ProviderVerifyResponse> {
    if (config.sandbox) return sandboxVerify(txId);

    // TODO: Enable in production.
    const token = await this.token(config);
    const cc = config.extra?.countryCode ?? 'cd';
    const { status, data } = await httpJson<OmStatusResponse>(this.key, `${config.baseUrl}/orange-money-webpay/${cc}/v1/transactionstatus`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { order_id: txId, amount: undefined, pay_token: txId },
    });

    if (status >= 500) throw new ProviderError(this.key, 'provider_unavailable', 'Orange Money indisponible', { retryable: true, raw: data });
    if (status >= 400) throw new ProviderError(this.key, this.mapError(data.code, ERROR_MAP), 'Statut indisponible', { raw: data });

    const normalized = this.normalizeStatus(data.status, STATUS_MAP);
    return {
      status: normalized,
      providerReference: data.txnid ?? txId,
      paidAt: normalized === 'succeeded' ? new Date().toISOString() : undefined,
      amount: data.amount,
      failureReason: normalized === 'failed' ? this.mapError(data.code ?? data.status, ERROR_MAP) : undefined,
      raw: data,
    };
  }

  refund(config: ProviderConfig, txId: string, amount: number, reason: string): Promise<ProviderRefundResponse> {
    if (config.sandbox) return Promise.resolve(sandboxRefund('OM', txId, amount));

    // TODO: Enable in production — OM WebPayment has no refund endpoint; the
    // Merchant Payment API "refund" (or back-office) must be wired here. Until
    // then we return `pending` so the ops team completes it manually.
    return Promise.resolve({
      providerRefundId: `OM-RFD-MANUAL-${Date.now().toString(36)}`,
      status: 'pending',
      message: `Remboursement à traiter manuellement dans le back-office Orange Money (${reason})`,
      raw: { manual: true, txId, amount, reason },
    });
  }

  parseWebhook(payload: unknown, _headers: Headers): ParsedWebhook | null {
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as Record<string, unknown>;
    // Orange notif body: { status, notif_token, txnid } (+ order_id in newer versions).
    const status = typeof p.status === 'string' ? p.status : undefined;
    const txnid = (p.txnid ?? p.pay_token) as string | undefined;
    const orderId = (p.order_id ?? p.reference) as string | undefined;
    if (!status || (!txnid && !orderId)) return null;

    const normalized = this.normalizeStatus(status, STATUS_MAP);
    return {
      eventId: (p.notif_token as string | undefined) ?? `${txnid ?? orderId}:${status}`,
      eventType: `payment.${status.toLowerCase()}`,
      providerTransactionId: (p.pay_token as string | undefined) ?? txnid ?? null,
      merchantReference: orderId ?? null,
      status: status.toUpperCase() === 'EXPIRED' ? 'expired' : normalized,
      failureReason: normalized === 'failed' ? this.mapError((p.code as string | undefined) ?? status, ERROR_MAP) : undefined,
      amount: typeof p.amount === 'number' ? p.amount : undefined,
      currency: typeof p.currency === 'string' ? p.currency : undefined,
      paidAt: normalized === 'succeeded' ? new Date().toISOString() : undefined,
    };
  }
}

export const orangeMoneyProvider = new OrangeMoneyProvider();
