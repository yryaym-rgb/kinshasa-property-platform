/**
 * Payment error codes → friendly French messages.
 *
 * Every provider adapter normalises its native error codes to one of the
 * `PaymentErrorCode` values below (see supabase/functions/_shared/providers/*).
 * The frontend never displays raw provider messages.
 */

export type PaymentErrorCode =
  // Wallet / account
  | 'insufficient_funds'
  | 'phone_not_registered'
  | 'account_blocked'
  | 'account_limit_exceeded'
  | 'wrong_pin'
  | 'pin_attempts_exceeded'
  // User behaviour
  | 'user_cancelled'
  | 'user_timeout'
  | 'otp_expired'
  // Provider side
  | 'provider_timeout'
  | 'provider_error'
  | 'provider_unavailable'
  | 'provider_rejected'
  | 'invalid_provider_response'
  // Our validation
  | 'duplicate_payment'
  | 'invalid_amount'
  | 'amount_below_minimum'
  | 'amount_above_maximum'
  | 'invalid_phone'
  | 'contract_not_found'
  | 'contract_inactive'
  | 'period_already_paid'
  | 'method_unavailable'
  | 'validation_failed'
  // Lifecycle
  | 'payment_not_found'
  | 'payment_expired'
  | 'invalid_state'
  | 'refund_not_allowed'
  | 'refund_window_closed'
  // Auth / infra
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'network_error'
  | 'unknown';

export const PAYMENT_ERROR_MESSAGES: Readonly<Record<PaymentErrorCode, string>> = {
  insufficient_funds: 'Solde insuffisant sur votre compte Mobile Money.',
  phone_not_registered: "Ce numéro n'est pas enregistré auprès de l'opérateur.",
  account_blocked: 'Votre compte Mobile Money est bloqué. Contactez votre opérateur.',
  account_limit_exceeded: 'Le plafond de transaction de votre compte est dépassé.',
  wrong_pin: 'Code PIN incorrect. Réessayez.',
  pin_attempts_exceeded: 'Trop de tentatives de code PIN. Votre compte est temporairement bloqué.',

  user_cancelled: 'Vous avez annulé le paiement.',
  user_timeout: "Vous n'avez pas confirmé le paiement à temps sur votre téléphone.",
  otp_expired: 'Le code de confirmation a expiré. Relancez le paiement.',

  provider_timeout: "Le service de l'opérateur ne répond pas. Réessayez.",
  provider_error: "Erreur du service de l'opérateur. Réessayez dans quelques instants.",
  provider_unavailable: "Le service de l'opérateur est momentanément indisponible.",
  provider_rejected: "L'opérateur a refusé la transaction.",
  invalid_provider_response: "Réponse invalide de l'opérateur. Le paiement n'a pas été confirmé.",

  duplicate_payment: 'Ce paiement a déjà été effectué.',
  invalid_amount: 'Le montant du paiement est invalide.',
  amount_below_minimum: 'Le montant est inférieur au minimum autorisé pour ce mode de paiement.',
  amount_above_maximum: 'Le montant dépasse le maximum autorisé pour ce mode de paiement.',
  invalid_phone: 'Numéro de téléphone invalide. Format attendu : +243 8XX XXX XXX.',
  contract_not_found: 'Contrat introuvable.',
  contract_inactive: "Ce contrat n'est pas actif. Contactez votre bailleur.",
  period_already_paid: 'Le loyer de cette période a déjà été réglé.',
  method_unavailable: "Ce mode de paiement n'est pas disponible actuellement.",
  validation_failed: 'Les informations du paiement sont incomplètes ou invalides.',

  payment_not_found: 'Paiement introuvable.',
  payment_expired: 'Ce paiement a expiré. Veuillez en créer un nouveau.',
  invalid_state: "Cette opération n'est pas possible dans l'état actuel du paiement.",
  refund_not_allowed: "Ce paiement ne peut pas être remboursé.",
  refund_window_closed: 'Le délai de remboursement est dépassé.',

  unauthorized: 'Votre session a expiré. Reconnectez-vous.',
  forbidden: "Vous n'êtes pas autorisé à effectuer cette opération.",
  rate_limited: 'Trop de requêtes. Patientez quelques secondes.',
  network_error: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
  unknown: 'Une erreur est survenue. Veuillez réessayer.',
};

const KNOWN_CODES = new Set<string>(Object.keys(PAYMENT_ERROR_MESSAGES));

/** Legacy / provider-specific aliases normalised to canonical codes. */
const ALIASES: Readonly<Record<string, PaymentErrorCode>> = {
  timeout: 'provider_timeout',
  expired: 'payment_expired',
  cancelled: 'user_cancelled',
  canceled: 'user_cancelled',
  insufficient_balance: 'insufficient_funds',
  low_balance: 'insufficient_funds',
  invalid_msisdn: 'invalid_phone',
  subscriber_not_found: 'phone_not_registered',
  not_found: 'payment_not_found',
  unauthenticated: 'unauthorized',
  too_many_requests: 'rate_limited',
  fetch_failed: 'network_error',
  failed_to_fetch: 'network_error',
};

export function isPaymentErrorCode(value: unknown): value is PaymentErrorCode {
  return typeof value === 'string' && KNOWN_CODES.has(value);
}

export function normalizeErrorCode(code: string | null | undefined): PaymentErrorCode {
  if (!code) return 'unknown';
  const lower = code.toLowerCase().trim();
  if (isPaymentErrorCode(lower)) return lower;
  return ALIASES[lower] ?? 'unknown';
}

/** Friendly French message for any code (unknown codes fall back gracefully). */
export function getPaymentErrorMessage(code: string | null | undefined): string {
  return PAYMENT_ERROR_MESSAGES[normalizeErrorCode(code)];
}

/** Codes for which a retry of the same payment makes sense. */
const RETRYABLE: ReadonlySet<PaymentErrorCode> = new Set([
  'provider_timeout',
  'provider_error',
  'provider_unavailable',
  'invalid_provider_response',
  'network_error',
  'rate_limited',
  'user_timeout',
  'otp_expired',
]);

export function isRetryableError(code: string | null | undefined): boolean {
  return RETRYABLE.has(normalizeErrorCode(code));
}

/** Shape returned by Edge Functions on error: `{ error: { code, message, details? } }`. */
export interface EdgeErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
  code?: string;
  message?: string;
}

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly details?: unknown;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(code: string | null | undefined, options?: { message?: string; details?: unknown; status?: number }) {
    const normalized = normalizeErrorCode(code);
    super(options?.message ?? PAYMENT_ERROR_MESSAGES[normalized]);
    this.name = 'PaymentError';
    this.code = normalized;
    this.details = options?.details;
    this.retryable = RETRYABLE.has(normalized);
    this.status = options?.status;
  }

  /** French message safe to show to the user. */
  get userMessage(): string {
    return PAYMENT_ERROR_MESSAGES[this.code];
  }
}

/**
 * Converts the heterogeneous error shapes of `supabase.functions.invoke`
 * (FunctionsHttpError with a JSON body, FunctionsFetchError, plain Error) into
 * a `PaymentError` with a canonical code.
 */
export async function mapEdgeError(error: unknown): Promise<PaymentError> {
  if (error instanceof PaymentError) return error;

  if (error && typeof error === 'object') {
    const err = error as { name?: string; message?: string; context?: unknown };

    if (err.name === 'FunctionsFetchError') {
      return new PaymentError('network_error', { details: err.message });
    }

    if (err.name === 'FunctionsHttpError' && err.context instanceof Response) {
      const status = err.context.status;
      let body: EdgeErrorBody | null = null;
      try {
        body = (await err.context.clone().json()) as EdgeErrorBody;
      } catch {
        body = null;
      }
      const code = body?.error?.code ?? body?.code ?? statusToCode(status);
      const message = body?.error?.message ?? body?.message;
      return new PaymentError(code, { message: message ? PAYMENT_ERROR_MESSAGES[normalizeErrorCode(code)] : undefined, details: body?.error?.details, status });
    }

    if (err.name === 'FunctionsRelayError') {
      return new PaymentError('provider_unavailable', { details: err.message });
    }

    if (typeof err.message === 'string') {
      return new PaymentError(err.message.toLowerCase().includes('fetch') ? 'network_error' : 'unknown', {
        details: err.message,
      });
    }
  }

  return new PaymentError('unknown', { details: String(error) });
}

function statusToCode(status: number): PaymentErrorCode {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'payment_not_found';
    case 409:
      return 'invalid_state';
    case 422:
      return 'validation_failed';
    case 429:
      return 'rate_limited';
    case 502:
    case 503:
    case 504:
      return 'provider_unavailable';
    default:
      return 'unknown';
  }
}
