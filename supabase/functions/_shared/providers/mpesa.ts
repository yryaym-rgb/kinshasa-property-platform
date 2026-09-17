/**
 * M-Pesa (Vodacom RDC) adapter — Vodacom "M-Pesa Open API" (openapi.m-pesa.com).
 *
 * Auth flow : the API key is RSA-encrypted with Vodacom's public key to obtain
 *             a *session key* (POST /getSession), valid ~1h. The session key
 *             is then sent as `Authorization: Bearer <encryptedSessionKey>`.
 *             (Different from Safaricom Daraja — do not mix the two.)
 * Endpoints (market = vodacomDRC):
 *   GET  {baseUrl}/ipg/v2/{market}/getSession/                         → output_SessionID
 *   POST {baseUrl}/ipg/v2/{market}/c2bPayment/singleStage/              → USSD push to the customer (STK)
 *   GET  {baseUrl}/ipg/v2/{market}/queryTransactionStatus/?input_QueryReference=… → status
 *   POST {baseUrl}/ipg/v2/{market}/reversal/                            → refund (reversal)
 * Webhook : Vodacom calls back the `input_CallbackUrl`? — the C2B single-stage
 *           flow is synchronous, but async result notifications exist for
 *           USSD push timeouts. We sign our own callback URL with a shared
 *           secret (`X-Mpesa-Signature`, HMAC-SHA256 of raw body).
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
 * Vodacom result codes (output_ResponseCode). INS-0 is success; others are
 * documented in the Open API "Response codes" table.
 */
const ERROR_MAP: Record<string, string> = {
  'INS-0': 'succeeded',
  'INS-1': 'provider_error', // Internal error
  'INS-2': 'invalid_provider_response', // Invalid API key
  'INS-4': 'provider_error', // User is not active
  'INS-5': 'user_timeout', // Transaction cancelled by customer / timed out
  'INS-6': 'provider_rejected', // Transaction failed
  'INS-9': 'provider_timeout', // Request timeout
  'INS-10': 'duplicate_payment', // Duplicate transaction
  'INS-13': 'invalid_phone', // Invalid shortcode / msisdn
  'INS-14': 'invalid_phone',
  'INS-15': 'invalid_amount',
  'INS-16': 'provider_unavailable', // Unable to handle the request due to temporary overloading
  'INS-17': 'invalid_provider_response',
  'INS-18': 'invalid_provider_response',
  'INS-19': 'invalid_provider_response',
  'INS-20': 'invalid_provider_response',
  'INS-21': 'invalid_provider_response',
  'INS-22': 'invalid_provider_response',
  'INS-23': 'invalid_provider_response',
  'INS-24': 'invalid_provider_response',
  'INS-25': 'invalid_provider_response',
  'INS-26': 'invalid_provider_response',
  'INS-993': 'provider_rejected', // Direct debit missing
  'INS-994': 'provider_rejected', // Direct debit already exists
  'INS-995': 'account_blocked', // Customer's profile has problems
  'INS-996': 'account_blocked', // Customer account status not active
  'INS-997': 'invalid_provider_response', // Linking transaction not found
  'INS-998': 'phone_not_registered', // Invalid market
  'INS-2001': 'wrong_pin', // Initiator authentication error
  'INS-2002': 'phone_not_registered', // Receiver invalid
  'INS-2006': 'insufficient_funds', // Insufficient balance
  'INS-2051': 'invalid_phone', // MSISDN invalid
  'INS-2057': 'invalid_phone', // Language code invalid (treated as bad request)
};

const STATUS_MAP: Record<string, ProviderStatus> = {
  COMPLETED: 'succeeded',
  SUCCESSFUL: 'succeeded',
  SUCCESS: 'succeeded',
  'IN PROGRESS': 'processing',
  IN_PROGRESS: 'processing',
  PENDING: 'processing',
  INITIATED: 'pending',
  FAILED: 'failed',
  CANCELLED: 'failed',
  EXPIRED: 'failed',
};

interface MpesaSessionResponse {
  output_ResponseCode: string;
  output_ResponseDesc: string;
  output_SessionID: string;
}

interface MpesaC2BResponse {
  output_ResponseCode: string;
  output_ResponseDesc: string;
  output_TransactionID: string;
  output_ConversationID: string;
  output_ThirdPartyConversationID: string;
}

interface MpesaStatusResponse {
  output_ResponseCode: string;
  output_ResponseDesc: string;
  output_ResponseTransactionStatus: string; // Completed | In Progress | Failed | Cancelled | Expired
  output_ConversationID?: string;
  output_TransactionID?: string;
}

export class MpesaProvider extends BaseProvider {
  readonly signatureHeader = 'x-mpesa-signature';

  constructor() {
    super('mpesa', 'M-Pesa');
  }

  /**
   * Vodacom requires the API key to be RSA/PKCS1-v1.5 encrypted with their
   * public key before requesting a session. We keep the encryption here so the
   * secret never leaves the Edge Function.
   */
  private async encryptApiKey(config: ProviderConfig): Promise<string> {
    // TODO: Enable in production — import Vodacom PEM public key and encrypt.
    const pem = config.extra?.publicKey ?? '';
    if (!pem) throw new ProviderError(this.key, 'provider_unavailable', 'MPESA_PUBLIC_KEY manquant');
    const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, '')), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('spki', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, new TextEncoder().encode(config.apiKey));
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  }

  private session(config: ProviderConfig): Promise<string> {
    return getCachedToken(`mpesa:${config.merchantId}`, async () => {
      // TODO: Enable in production.
      const encrypted = await this.encryptApiKey(config);
      const market = config.extra?.market ?? 'vodacomDRC';
      const { status, data } = await httpJson<MpesaSessionResponse>(this.key, `${config.baseUrl}/ipg/v2/${market}/getSession/`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${encrypted}`, Origin: '*' },
      });
      if (status !== 200 || data.output_ResponseCode !== 'INS-0') {
        throw new ProviderError(this.key, 'provider_unavailable', data.output_ResponseDesc ?? 'Session M-Pesa refusée', { retryable: true, raw: data });
      }
      // Session keys are valid for ~1 hour on the Open API.
      return { token: data.output_SessionID, expiresInSeconds: 3300 };
    });
  }

  async initiate(config: ProviderConfig, req: ProviderInitRequest): Promise<ProviderInitResponse> {
    if (config.sandbox) return sandboxInitiate('MP', req);
    if (!req.phone) throw new ProviderError(this.key, 'invalid_phone', 'Numéro requis pour M-Pesa');

    // TODO: Enable in production.
    const session = await this.session(config);
    const market = config.extra?.market ?? 'vodacomDRC';
    const { status, data } = await httpJson<MpesaC2BResponse>(this.key, `${config.baseUrl}/ipg/v2/${market}/c2bPayment/singleStage/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session}`, Origin: '*' },
      body: {
        input_Amount: String(Math.round(req.amount)),
        input_Country: 'DRC',
        input_Currency: req.currency,
        input_CustomerMSISDN: req.phone.replace(/^\+/, ''),
        input_ServiceProviderCode: config.extra?.serviceProviderCode ?? config.merchantId,
        input_ThirdPartyConversationID: req.reference.slice(0, 40),
        input_TransactionReference: req.reference.slice(0, 20),
        input_PurchasedItemsDesc: req.description.slice(0, 50),
      },
      timeoutMs: 60_000, // USSD push waits for the customer's PIN
    });

    if (status >= 500) throw new ProviderError(this.key, 'provider_unavailable', 'M-Pesa indisponible', { retryable: true, raw: data });

    const code = data.output_ResponseCode;
    if (code === 'INS-0') {
      return { providerTransactionId: data.output_TransactionID, status: 'succeeded', message: 'Paiement M-Pesa confirmé', raw: data };
    }
    if (code === 'INS-5' || code === 'INS-9') {
      // Customer did not answer the USSD prompt yet — poll with queryTransactionStatus.
      return {
        providerTransactionId: data.output_ConversationID ?? data.output_ThirdPartyConversationID,
        status: 'requires_action',
        message: 'Confirmez le paiement avec votre code PIN M-Pesa',
        raw: data,
      };
    }
    const mapped = this.mapError(code, ERROR_MAP);
    return { providerTransactionId: data.output_TransactionID ?? req.reference, status: 'failed', failureCode: mapped, message: data.output_ResponseDesc, raw: data };
  }

  async verify(config: ProviderConfig, txId: string): Promise<ProviderVerifyResponse> {
    if (config.sandbox) return sandboxVerify(txId);

    // TODO: Enable in production.
    const session = await this.session(config);
    const market = config.extra?.market ?? 'vodacomDRC';
    const qs = new URLSearchParams({
      input_QueryReference: txId,
      input_ServiceProviderCode: config.extra?.serviceProviderCode ?? config.merchantId,
      input_ThirdPartyConversationID: txId,
      input_Country: 'DRC',
    });
    const { status, data } = await httpJson<MpesaStatusResponse>(this.key, `${config.baseUrl}/ipg/v2/${market}/queryTransactionStatus/?${qs}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${session}`, Origin: '*' },
    });
    if (status >= 500) throw new ProviderError(this.key, 'provider_unavailable', 'M-Pesa indisponible', { retryable: true, raw: data });

    const normalized = this.normalizeStatus(data.output_ResponseTransactionStatus, STATUS_MAP);
    return {
      status: normalized,
      providerReference: data.output_TransactionID ?? txId,
      paidAt: normalized === 'succeeded' ? new Date().toISOString() : undefined,
      failureReason: normalized === 'failed' ? this.mapError(data.output_ResponseCode, ERROR_MAP) : undefined,
      raw: data,
    };
  }

  async refund(config: ProviderConfig, txId: string, amount: number, reason: string): Promise<ProviderRefundResponse> {
    if (config.sandbox) return sandboxRefund('MP', txId, amount);

    // TODO: Enable in production — /reversal/ endpoint.
    const session = await this.session(config);
    const market = config.extra?.market ?? 'vodacomDRC';
    const { status, data } = await httpJson<MpesaC2BResponse>(this.key, `${config.baseUrl}/ipg/v2/${market}/reversal/`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${session}`, Origin: '*' },
      body: {
        input_ReversalAmount: String(Math.round(amount)),
        input_Country: 'DRC',
        input_TransactionID: txId,
        input_ServiceProviderCode: config.extra?.serviceProviderCode ?? config.merchantId,
        input_ThirdPartyConversationID: `RFD-${txId}`.slice(0, 40),
        input_Remarks: reason.slice(0, 50),
      },
    });
    if (status >= 500) throw new ProviderError(this.key, 'provider_unavailable', 'M-Pesa indisponible', { retryable: true, raw: data });
    return {
      providerRefundId: data.output_TransactionID ?? `MP-RFD-${Date.now().toString(36)}`,
      status: data.output_ResponseCode === 'INS-0' ? 'succeeded' : 'failed',
      message: data.output_ResponseDesc,
      raw: data,
    };
  }

  parseWebhook(payload: unknown, _headers: Headers): ParsedWebhook | null {
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as Record<string, unknown>;
    const code = p.output_ResponseCode as string | undefined;
    const txId = (p.output_TransactionID ?? p.output_ConversationID) as string | undefined;
    const ref = (p.output_ThirdPartyConversationID ?? p.input_ThirdPartyConversationID) as string | undefined;
    if (!code && !p.output_ResponseTransactionStatus) return null;

    const statusText = (p.output_ResponseTransactionStatus as string | undefined) ?? (code === 'INS-0' ? 'Completed' : 'Failed');
    const normalized = this.normalizeStatus(statusText, STATUS_MAP);
    return {
      eventId: `${txId ?? ref ?? 'unknown'}:${statusText}`,
      eventType: `c2b.${normalized}`,
      providerTransactionId: txId ?? null,
      merchantReference: ref ?? null,
      status: normalized,
      failureReason: normalized === 'failed' ? this.mapError(code, ERROR_MAP) : undefined,
      amount: p.input_Amount ? Number(p.input_Amount) : undefined,
      currency: (p.input_Currency as string | undefined) ?? undefined,
      paidAt: normalized === 'succeeded' ? new Date().toISOString() : undefined,
    };
  }
}

export const mpesaProvider = new MpesaProvider();
