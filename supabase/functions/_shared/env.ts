/**
 * Environment configuration for the payment / tax Edge Functions.
 *
 * All secrets come from Supabase Edge Function secrets
 * (`supabase secrets set KEY=value` or Dashboard → Edge Functions → Secrets).
 * Nothing here is ever committed. Full list: docs/MOBILE_MONEY_INTEGRATION.md.
 */

import type { ProviderConfig } from './providers/types.ts';

function env(name: string, fallback = ''): string {
  return Deno.env.get(name) ?? fallback;
}

export type PaymentMode = 'sandbox' | 'production';

/** `PAYMENT_MODE=production` switches every provider to live endpoints. */
export const PAYMENT_MODE: PaymentMode = env('PAYMENT_MODE') === 'production' ? 'production' : 'sandbox';
export const IS_SANDBOX = PAYMENT_MODE === 'sandbox';

export const SUPABASE_URL = env('SUPABASE_URL');
export const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY');
export const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');

/** Public origin of the frontend — used for card return URLs. */
export const APP_URL = env('APP_URL', 'http://localhost:5173');

/** Origins allowed to call the JWT-protected functions (comma separated). `*` in sandbox. */
export const ALLOWED_ORIGINS: string[] = env('ALLOWED_ORIGINS', IS_SANDBOX ? '*' : APP_URL)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** Minutes a pending payment stays alive before `expire_stale_payments()` marks it expired. */
export const PAYMENT_EXPIRY_MINUTES = Number(env('PAYMENT_EXPIRY_MINUTES', '15'));

/** Idempotency window for payment-initiate (spec: 5 minutes). */
export const IDEMPOTENCY_WINDOW_MS = Number(env('IDEMPOTENCY_WINDOW_MINUTES', '5')) * 60 * 1000;

/** payment-verify: minimum seconds between two provider calls for the same payment. */
export const VERIFY_MIN_INTERVAL_SECONDS = Number(env('VERIFY_MIN_INTERVAL_SECONDS', '5'));
/** payment-verify: only ask the provider if the last check is older than this. */
export const VERIFY_PROVIDER_STALENESS_SECONDS = Number(env('VERIFY_PROVIDER_STALENESS_SECONDS', '10'));

/** Refund window (days) when the provider row does not override it. */
export const DEFAULT_REFUND_WINDOW_DAYS = Number(env('REFUND_WINDOW_DAYS', '30'));

/** Platform fee (fraction) — mirrors the frontend estimate; authoritative value lives here. */
export const PLATFORM_FEE_RATE = Number(env('PLATFORM_FEE_RATE', '0.02'));

/** Semantic version of the tax calculation algorithm, stored on every calculation. */
export const TAX_CALCULATION_VERSION = env('TAX_CALCULATION_VERSION', '1.0.0');

/** Sandbox simulation knobs (ignored in production). */
export const SANDBOX = {
  /** Probability [0..1] that a sandbox payment succeeds. */
  successRate: Number(env('SANDBOX_SUCCESS_RATE', '0.9')),
  /** Seconds before a sandbox payment settles. */
  settleAfterSeconds: Number(env('SANDBOX_SETTLE_SECONDS', '4')),
  /** Phone suffix that forces a failure (e.g. "…000" → insufficient_funds). */
  forceFailSuffix: env('SANDBOX_FORCE_FAIL_SUFFIX', '000'),
  /** Phone suffix that forces success instantly. */
  forceSuccessSuffix: env('SANDBOX_FORCE_SUCCESS_SUFFIX', '111'),
  /** Phone suffix that forces `requires_action`. */
  forceActionSuffix: env('SANDBOX_FORCE_ACTION_SUFFIX', '222'),
} as const;

export const providerConfigs: Record<'orange_money' | 'mpesa' | 'airtel_money', ProviderConfig> = {
  orange_money: {
    apiKey: env('ORANGE_MONEY_API_KEY'),
    apiSecret: env('ORANGE_MONEY_API_SECRET'),
    merchantId: env('ORANGE_MONEY_MERCHANT_ID'),
    baseUrl: env('ORANGE_MONEY_BASE_URL', IS_SANDBOX ? 'https://api.orange.com' : 'https://api.orange.com'),
    webhookSecret: env('ORANGE_MONEY_WEBHOOK_SECRET'),
    sandbox: IS_SANDBOX,
    extra: {
      // Orange Money Web Payment "merchant key" — distinct from the OAuth client id.
      merchantKey: env('ORANGE_MONEY_MERCHANT_KEY'),
      // ISO-3166 country used in the OM WebPayment path (`/orange-money-webpay/cd/v1`).
      countryCode: env('ORANGE_MONEY_COUNTRY', 'cd'),
    },
  },
  mpesa: {
    apiKey: env('MPESA_CONSUMER_KEY'),
    apiSecret: env('MPESA_CONSUMER_SECRET'),
    merchantId: env('MPESA_SHORTCODE'),
    baseUrl: env('MPESA_BASE_URL', IS_SANDBOX ? 'https://openapi.m-pesa.com/sandbox' : 'https://openapi.m-pesa.com/openapi'),
    webhookSecret: env('MPESA_WEBHOOK_SECRET'),
    sandbox: IS_SANDBOX,
    extra: {
      // Vodacom M-Pesa Open API (DRC): public key used to encrypt the API key into a session key.
      publicKey: env('MPESA_PUBLIC_KEY'),
      market: env('MPESA_MARKET', 'vodacomDRC'),
      serviceProviderCode: env('MPESA_SERVICE_PROVIDER_CODE'),
    },
  },
  airtel_money: {
    apiKey: env('AIRTEL_MONEY_CLIENT_ID'),
    apiSecret: env('AIRTEL_MONEY_CLIENT_SECRET'),
    merchantId: env('AIRTEL_MONEY_MERCHANT_ID'),
    baseUrl: env('AIRTEL_MONEY_BASE_URL', IS_SANDBOX ? 'https://openapiuat.airtel.africa' : 'https://openapi.airtel.africa'),
    webhookSecret: env('AIRTEL_MONEY_WEBHOOK_SECRET'),
    sandbox: IS_SANDBOX,
    extra: {
      country: env('AIRTEL_MONEY_COUNTRY', 'CD'),
      currency: env('AIRTEL_MONEY_CURRENCY', 'CDF'),
    },
  },
};

/** Secret used to authenticate internal function-to-function calls (webhook → tax-calculate). */
export const INTERNAL_FUNCTION_SECRET = env('INTERNAL_FUNCTION_SECRET');

/** Optional: user id (agent_fiscal) that receives DGI notifications. Falls back to all agent_fiscal users. */
export const DGI_NOTIFICATION_USER_ID = env('DGI_NOTIFICATION_USER_ID');

/** Optional: admin user id alerted when a post-success pipeline step fails. */
export const ADMIN_ALERT_USER_ID = env('ADMIN_ALERT_USER_ID');

/**
 * Fails fast at boot when a required variable is missing. Provider keys are
 * only required in production — sandbox adapters never contact the network.
 */
export function assertRequiredEnv(): void {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!IS_SANDBOX) {
    for (const [key, cfg] of Object.entries(providerConfigs)) {
      if (!cfg.apiKey) missing.push(`${key.toUpperCase()}_API_KEY`);
      if (!cfg.webhookSecret) missing.push(`${key.toUpperCase()}_WEBHOOK_SECRET`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
  }
}
