/**
 * Base class shared by every provider adapter:
 * - HMAC-SHA256 webhook verification (Web Crypto, constant-time compare)
 * - OAuth token cache with TTL
 * - HTTP helper with timeout + structured error mapping
 * - Deterministic sandbox simulator (no network, replay-safe across isolates)
 */

import { SANDBOX } from '../env.ts';
import type {
  ParsedWebhook,
  PaymentProviderAdapter,
  ProviderConfig,
  ProviderInitRequest,
  ProviderInitResponse,
  ProviderKey,
  ProviderRefundResponse,
  ProviderStatus,
  ProviderVerifyResponse,
} from './types.ts';
import { ProviderError } from './types.ts';

const encoder = new TextEncoder();

// ─── Crypto helpers ────────────────────────────────────────────────────────

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return bytesToHex(new Uint8Array(sig));
}

export async function hmacSha256Base64(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison (length leak is acceptable for HMAC digests). */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i]! ^ bb[i]!;
  return diff === 0;
}

// ─── Token cache ───────────────────────────────────────────────────────────

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

/** Safety margin so we never present a token about to expire. */
const TOKEN_EXPIRY_MARGIN_MS = 30_000;

export async function getCachedToken(
  cacheKey: string,
  fetcher: () => Promise<{ token: string; expiresInSeconds: number }>,
): Promise<string> {
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - TOKEN_EXPIRY_MARGIN_MS > Date.now()) return cached.token;
  const fresh = await fetcher();
  tokenCache.set(cacheKey, { token: fresh.token, expiresAt: Date.now() + fresh.expiresInSeconds * 1000 });
  return fresh.token;
}

export function clearTokenCache(): void {
  tokenCache.clear();
}

// ─── HTTP ──────────────────────────────────────────────────────────────────

export interface HttpJsonOptions {
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export async function httpJson<T = unknown>(
  provider: string,
  url: string,
  options: HttpJsonOptions = {},
): Promise<{ status: number; data: T }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  try {
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...options.headers },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const text = await res.text();
    let data: T;
    try {
      data = (text ? JSON.parse(text) : {}) as T;
    } catch {
      throw new ProviderError(provider, 'invalid_provider_response', `Réponse non-JSON (${res.status})`, { raw: text });
    }
    return { status: res.status, data };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw new ProviderError(provider, 'provider_timeout', 'Délai dépassé', { retryable: true });
    }
    throw new ProviderError(provider, 'provider_unavailable', (error as Error).message, { retryable: true });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Sandbox simulator ─────────────────────────────────────────────────────

const SANDBOX_FAILURES = ['insufficient_funds', 'user_cancelled', 'phone_not_registered', 'provider_timeout', 'wrong_pin'] as const;

type SandboxOutcome = 'S' | 'F' | 'A'; // succeeded | failed | requires_action first

/**
 * Sandbox transaction ids embed everything `verify` needs, so behaviour is
 * deterministic across Edge Function isolates (no in-memory state):
 *   <PREFIX>-SBX-<createdAtBase36>-<outcome><failureIndex>-<random>
 */
export function sandboxInitiate(prefix: string, req: ProviderInitRequest): ProviderInitResponse {
  const phone = req.phone ?? '';
  let outcome: SandboxOutcome;
  let failureIdx = 0;

  if (phone.endsWith(SANDBOX.forceFailSuffix)) outcome = 'F';
  else if (phone.endsWith(SANDBOX.forceSuccessSuffix)) outcome = 'S';
  else if (phone.endsWith(SANDBOX.forceActionSuffix)) outcome = 'A';
  else {
    const roll = Math.random();
    outcome = roll < SANDBOX.successRate ? 'S' : 'F';
    failureIdx = Math.floor(Math.random() * SANDBOX_FAILURES.length);
  }

  const providerTransactionId = `${prefix}-SBX-${Date.now().toString(36)}-${outcome}${failureIdx}-${crypto.randomUUID().slice(0, 6)}`;

  const instantSuccess = phone.endsWith(SANDBOX.forceSuccessSuffix);
  return {
    providerTransactionId,
    status: instantSuccess ? 'succeeded' : outcome === 'A' ? 'requires_action' : 'processing',
    message: instantSuccess
      ? '[SANDBOX] Paiement confirmé instantanément'
      : outcome === 'A'
        ? '[SANDBOX] Confirmez le paiement sur votre téléphone (*144#)'
        : `[SANDBOX] Demande envoyée, règlement dans ${SANDBOX.settleAfterSeconds}s`,
    raw: { sandbox: true, outcome, request: { ...req, phone: phone ? `…${phone.slice(-4)}` : undefined } },
  };
}

export function sandboxVerify(txId: string): ProviderVerifyResponse {
  const match = /-SBX-([0-9a-z]+)-([SFA])(\d)-/.exec(txId);
  if (!match) return { status: 'failed', failureReason: 'provider_error', raw: { sandbox: true, reason: 'unknown_tx' } };

  const createdAt = parseInt(match[1]!, 36);
  const outcome = match[2] as SandboxOutcome;
  const failureIdx = Number(match[3]);
  const elapsed = (Date.now() - createdAt) / 1000;

  if (elapsed < SANDBOX.settleAfterSeconds) {
    return { status: outcome === 'A' ? 'requires_action' : 'processing', raw: { sandbox: true, elapsed } };
  }
  if (outcome === 'F') {
    return { status: 'failed', failureReason: SANDBOX_FAILURES[failureIdx] ?? 'provider_error', raw: { sandbox: true, elapsed } };
  }
  return {
    status: 'succeeded',
    providerReference: txId,
    paidAt: new Date(createdAt + SANDBOX.settleAfterSeconds * 1000).toISOString(),
    raw: { sandbox: true, elapsed },
  };
}

export function sandboxRefund(prefix: string, txId: string, amount: number): ProviderRefundResponse {
  return {
    providerRefundId: `${prefix}-RFD-SBX-${Date.now().toString(36)}`,
    status: 'succeeded',
    message: `[SANDBOX] Remboursement de ${amount} accepté pour ${txId}`,
    raw: { sandbox: true },
  };
}

// ─── Base adapter ──────────────────────────────────────────────────────────

export abstract class BaseProvider implements PaymentProviderAdapter {
  readonly key: ProviderKey;
  readonly displayName: string;
  abstract readonly signatureHeader: string;

  constructor(key: ProviderKey, displayName: string) {
    this.key = key;
    this.displayName = displayName;
  }

  abstract initiate(config: ProviderConfig, req: ProviderInitRequest): Promise<ProviderInitResponse>;
  abstract verify(config: ProviderConfig, txId: string): Promise<ProviderVerifyResponse>;
  abstract parseWebhook(payload: unknown, headers: Headers): ParsedWebhook | null;

  /**
   * HMAC-SHA256 over the raw body, hex or base64 encoded, constant-time
   * comparison. Accepts an optional `sha256=` prefix (GitHub style). Returns
   * false on any error — never throws.
   */
  async verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
    try {
      if (!secret || !signature) return false;
      const provided = signature.trim().replace(/^sha256=/i, '');
      const [hex, b64] = await Promise.all([hmacSha256Hex(secret, payload), hmacSha256Base64(secret, payload)]);
      return timingSafeEqual(provided.toLowerCase(), hex) || timingSafeEqual(provided, b64);
    } catch {
      return false;
    }
  }

  /** Maps a provider-native code to our canonical error vocabulary. */
  protected mapError(nativeCode: string | number | undefined | null, table: Record<string, string>): string {
    if (nativeCode === undefined || nativeCode === null) return 'provider_error';
    return table[String(nativeCode)] ?? 'provider_error';
  }

  protected normalizeStatus(native: string | undefined | null, table: Record<string, ProviderStatus>): ProviderStatus {
    if (!native) return 'pending';
    return table[native.toUpperCase()] ?? table[native] ?? 'pending';
  }
}
