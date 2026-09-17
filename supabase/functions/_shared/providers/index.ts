/**
 * Provider registry. `getProviderAdapter(key)` is the only way Edge Functions
 * obtain an adapter; unknown / inactive providers raise `method_unavailable`.
 */

import { IS_SANDBOX, providerConfigs } from '../env.ts';
import { BaseProvider, sandboxInitiate, sandboxRefund, sandboxVerify } from './base.ts';
import { orangeMoneyProvider } from './orange-money.ts';
import { mpesaProvider } from './mpesa.ts';
import { airtelMoneyProvider } from './airtel-money.ts';
import type {
  ParsedWebhook,
  PaymentProviderAdapter,
  ProviderConfig,
  ProviderInitRequest,
  ProviderInitResponse,
  ProviderKey,
  ProviderRefundResponse,
  ProviderVerifyResponse,
} from './types.ts';
import { ProviderError } from './types.ts';

export * from './types.ts';
export { BaseProvider, hmacSha256Hex, timingSafeEqual } from './base.ts';
export { orangeMoneyProvider, mpesaProvider, airtelMoneyProvider };

/**
 * Card (Visa/Mastercard) — no PSP contracted yet. Sandbox uses the simulator
 * with a redirect; production raises `method_unavailable` until a PSP adapter
 * (e.g. CinetPay / Flutterwave / Stripe) is implemented behind this class.
 */
class CardProvider extends BaseProvider {
  readonly signatureHeader = 'x-signature';
  constructor() {
    super('card', 'Carte bancaire');
  }
  initiate(config: ProviderConfig, req: ProviderInitRequest): Promise<ProviderInitResponse> {
    if (!config.sandbox) {
      // TODO: Enable in production — plug the contracted PSP here.
      throw new ProviderError(this.key, 'method_unavailable', 'Paiement par carte non encore activé');
    }
    const res = sandboxInitiate('CARD', req);
    return Promise.resolve({
      ...res,
      status: 'requires_action',
      redirectUrl: `${req.returnUrl ?? '/'}${req.returnUrl?.includes('?') ? '&' : '?'}sandbox_card=${res.providerTransactionId}`,
    });
  }
  verify(_config: ProviderConfig, txId: string): Promise<ProviderVerifyResponse> {
    return Promise.resolve(sandboxVerify(txId));
  }
  refund(_config: ProviderConfig, txId: string, amount: number): Promise<ProviderRefundResponse> {
    return Promise.resolve(sandboxRefund('CARD', txId, amount));
  }
  parseWebhook(_payload: unknown): ParsedWebhook | null {
    return null;
  }
}

/**
 * Bank transfer — always asynchronous: the payment stays `pending` until a
 * gestionnaire confirms receipt (manual webhook / admin action).
 */
class BankTransferProvider extends BaseProvider {
  readonly signatureHeader = 'x-signature';
  constructor() {
    super('bank_transfer', 'Virement bancaire');
  }
  initiate(config: ProviderConfig, req: ProviderInitRequest): Promise<ProviderInitResponse> {
    if (config.sandbox) return Promise.resolve(sandboxInitiate('BANK', req));
    return Promise.resolve({
      providerTransactionId: `BANK-${req.reference}`,
      status: 'pending',
      message: `Effectuez un virement avec la référence ${req.reference}. Le paiement sera confirmé sous 1-2 jours ouvrés.`,
      raw: { manual: true },
    });
  }
  verify(config: ProviderConfig, txId: string): Promise<ProviderVerifyResponse> {
    if (config.sandbox) return Promise.resolve(sandboxVerify(txId));
    // Real bank transfers are confirmed by a gestionnaire through the webhook
    // endpoint (provider=bank_transfer, signed with BANK_TRANSFER_WEBHOOK_SECRET).
    return Promise.resolve({ status: 'pending', raw: { manual: true } });
  }
  parseWebhook(payload: unknown): ParsedWebhook | null {
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as Record<string, unknown>;
    if (typeof p.reference !== 'string' || typeof p.status !== 'string') return null;
    const status = p.status === 'received' ? 'succeeded' : p.status === 'rejected' ? 'failed' : 'pending';
    return {
      eventId: (p.event_id as string | undefined) ?? `${p.reference}:${p.status}`,
      eventType: `bank.${p.status}`,
      providerTransactionId: (p.bank_reference as string | undefined) ?? `BANK-${p.reference}`,
      merchantReference: p.reference,
      status,
      amount: typeof p.amount === 'number' ? p.amount : undefined,
      paidAt: status === 'succeeded' ? ((p.received_at as string | undefined) ?? new Date().toISOString()) : undefined,
    };
  }
}

const cardProvider = new CardProvider();
const bankTransferProvider = new BankTransferProvider();

const REGISTRY: Record<ProviderKey, PaymentProviderAdapter> = {
  orange_money: orangeMoneyProvider,
  mpesa: mpesaProvider,
  airtel_money: airtelMoneyProvider,
  card: cardProvider,
  bank_transfer: bankTransferProvider,
};

export const PROVIDER_KEYS = Object.keys(REGISTRY) as ProviderKey[];

export function isProviderKey(value: unknown): value is ProviderKey {
  return typeof value === 'string' && value in REGISTRY;
}

export function getProviderAdapter(key: string): PaymentProviderAdapter {
  if (!isProviderKey(key)) throw new ProviderError(key, 'method_unavailable', `Fournisseur inconnu : ${key}`);
  return REGISTRY[key];
}

export function getProviderConfig(key: ProviderKey): ProviderConfig {
  if (key === 'orange_money' || key === 'mpesa' || key === 'airtel_money') return providerConfigs[key];
  return {
    apiKey: '',
    apiSecret: '',
    merchantId: '',
    baseUrl: '',
    webhookSecret: Deno.env.get(`${key.toUpperCase()}_WEBHOOK_SECRET`) ?? '',
    sandbox: IS_SANDBOX,
  };
}

/** Legacy `payment_method` enum value stored on `paiements.method`. */
export function providerKeyToDbMethod(key: ProviderKey): 'Orange Money' | 'M-Pesa' | 'Airtel Money' | 'Bank' {
  switch (key) {
    case 'orange_money':
      return 'Orange Money';
    case 'mpesa':
      return 'M-Pesa';
    case 'airtel_money':
      return 'Airtel Money';
    default:
      return 'Bank';
  }
}
