/**
 * payment-webhook — authoritative status updates pushed by the operators.
 *
 *   POST /functions/v1/payment-webhook?provider=orange_money|mpesa|airtel_money|card|bank_transfer
 *
 *  1. Read the RAW body (signature is computed over bytes, not parsed JSON).
 *  2. Persist the delivery in `payment_webhooks` BEFORE interpreting it —
 *     even when the signature is invalid. Raw evidence always survives.
 *  3. Verify the HMAC signature (adapter-specific header). Invalid → 401,
 *     nothing else happens; the row keeps `signature_valid = false`.
 *  4. Idempotency: `(provider, provider_event_id)` is UNIQUE. A duplicate
 *     delivery is acknowledged with 200 and `duplicate: true`, no processing.
 *  5. Resolve the payment (provider_transaction_id, then our reference).
 *  6. Map the provider status → state-machine event via settlement.ts.
 *     On `succeeded` the full downstream pipeline runs
 *     (tax → impôt → ledger → receipt → notifications → compliance → audit).
 *  7. Mark the webhook processed (or record the processing error).
 *  8. Always answer 200 quickly once the payload is stored — operators retry
 *     on non-2xx, and we never want a retry storm because *our* pipeline is
 *     slow. Failed pipeline steps are queued, not surfaced as errors.
 *
 * `verify_jwt = false` in supabase/config.toml: the caller is the operator.
 * Manual confirmations (bank_transfer) are signed with the same HMAC scheme
 * using BANK_TRANSFER_WEBHOOK_SECRET.
 */

import { clientIp, corsHeaders, HttpError } from '../_shared/auth.ts';
import { getPaymentByProviderTx, getPaymentByReference, type PaymentRow, serviceClient, writeAuditLog } from '../_shared/db.ts';
import { IS_SANDBOX } from '../_shared/env.ts';
import { isUniqueViolation } from '../_shared/idempotency.ts';
import { createLogger } from '../_shared/logger.ts';
import { getProviderAdapter, getProviderConfig, isProviderKey, type ParsedWebhook } from '../_shared/providers/index.ts';
import { applyProviderVerdict, type ProviderVerdictStatus } from '../_shared/settlement.ts';

const MAX_BODY_BYTES = 256 * 1024;
const SAFE_HEADERS = ['content-type', 'user-agent', 'x-signature', 'x-request-id', 'x-forwarded-for', 'x-callback-signature', 'x-hub-signature-256', 'x-webhook-signature', 'date'];

function pickHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of SAFE_HEADERS) {
    const v = headers.get(name);
    if (v) out[name] = v;
  }
  return out;
}

function respond(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });
}

/** Statuses a webhook may carry that the state machine understands. */
function toVerdictStatus(status: ParsedWebhook['status']): ProviderVerdictStatus | null {
  switch (status) {
    case 'pending':
    case 'processing':
    case 'requires_action':
    case 'succeeded':
    case 'failed':
    case 'cancelled':
    case 'expired':
      return status;
    default:
      return null; // 'refunded' / 'unknown' are handled by payment-refund or ignored
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders(req) });
  const log = createLogger('payment-webhook', req);
  const db = serviceClient();
  const url = new URL(req.url);
  const providerKey = url.searchParams.get('provider') ?? req.headers.get('x-provider') ?? '';

  if (req.method !== 'POST') return respond(req, { error: { code: 'method_not_allowed' } }, 405);
  if (!isProviderKey(providerKey)) {
    log.warn('webhook for unknown provider', { providerKey });
    return respond(req, { error: { code: 'unknown_provider', message: `provider=${providerKey}` } }, 400);
  }

  const adapter = getProviderAdapter(providerKey);
  const config = getProviderConfig(providerKey);
  const plog = log.child({ provider: providerKey });

  // 1. Raw body
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) return respond(req, { error: { code: 'payload_too_large' } }, 413);
  let payload: unknown = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    payload = { _unparsed: rawBody.slice(0, 4000) };
  }

  const signature = req.headers.get(adapter.signatureHeader) ?? req.headers.get('x-signature') ?? '';
  const parsed = payload && !(payload as Record<string, unknown>)._unparsed ? adapter.parseWebhook(payload, req.headers) : null;

  // 3. Signature — verified before the row is written so `signature_valid` is
  //    stored with the evidence. In sandbox a missing secret is tolerated
  //    (simulator deliveries are unsigned); in production it is fatal.
  let signatureValid = false;
  if (config.webhookSecret) {
    signatureValid = await adapter.verifyWebhookSignature(rawBody, signature, config.webhookSecret);
  } else if (IS_SANDBOX) {
    signatureValid = true;
    plog.warn('no webhook secret configured — accepting unsigned webhook (sandbox only)');
  }

  // 2. Persist BEFORE interpreting.
  const webhookRow = {
    provider: providerKey,
    event_type: parsed?.eventType ?? 'unknown',
    provider_event_id: parsed?.eventId ?? null,
    provider_transaction_id: parsed?.providerTransactionId ?? null,
    payload: payload ?? {},
    headers: pickHeaders(req.headers),
    signature_valid: signatureValid,
    source_ip: clientIp(req),
    processed: false,
  };

  let webhookId: string | null = null;
  {
    const { data, error } = await db.from('payment_webhooks').insert(webhookRow).select('id').single();
    if (error) {
      // 4. Duplicate delivery of the same provider event → already handled.
      if (isUniqueViolation(error)) {
        plog.info('duplicate webhook ignored', { eventId: parsed?.eventId });
        return respond(req, { received: true, duplicate: true });
      }
      plog.error('failed to persist webhook', error);
      // Storing the evidence failed — ask the operator to retry.
      return respond(req, { error: { code: 'storage_failed' } }, 500);
    }
    webhookId = (data as { id: string }).id;
  }
  const wlog = plog.child({ webhookId });

  async function finish(processed: boolean, processingError: string | null, paymentId: string | null) {
    await db
      .from('payment_webhooks')
      .update({
        processed,
        processed_at: processed ? new Date().toISOString() : null,
        processing_error: processingError,
        processing_attempts: 1,
        paiement_id: paymentId,
      })
      .eq('id', webhookId);
  }

  if (!signatureValid) {
    wlog.warn('invalid webhook signature', { hasSignature: Boolean(signature) });
    await finish(false, 'invalid_signature', null);
    await writeAuditLog(db, { action: 'webhook.invalid_signature', entityType: 'payment_webhooks', entityId: webhookId, newData: { provider: providerKey, ip: clientIp(req) } });
    return respond(req, { error: { code: 'invalid_signature' } }, 401);
  }

  if (!parsed) {
    wlog.warn('unrecognised webhook payload');
    await finish(true, 'unrecognised_payload', null);
    // 200: the payload is stored; the operator must not retry it.
    return respond(req, { received: true, ignored: 'unrecognised_payload' });
  }

  // 5. Resolve the payment.
  let payment: PaymentRow | null = null;
  try {
    if (parsed.providerTransactionId) payment = await getPaymentByProviderTx(db, providerKey, parsed.providerTransactionId);
    if (!payment && parsed.merchantReference) payment = await getPaymentByReference(db, parsed.merchantReference);
  } catch (error) {
    wlog.error('payment lookup failed', error);
    await finish(false, `lookup_failed: ${error instanceof Error ? error.message : String(error)}`, null);
    return respond(req, { received: true, error: 'lookup_failed' }, 500);
  }

  if (!payment) {
    wlog.warn('webhook for unknown payment', { providerTransactionId: parsed.providerTransactionId, merchantReference: parsed.merchantReference });
    await finish(true, 'payment_not_found', null);
    await writeAuditLog(db, { action: 'webhook.orphan', entityType: 'payment_webhooks', entityId: webhookId, newData: { provider: providerKey, providerTransactionId: parsed.providerTransactionId, merchantReference: parsed.merchantReference } });
    return respond(req, { received: true, ignored: 'payment_not_found' });
  }

  // 6. Apply the verdict through the state machine.
  const status = toVerdictStatus(parsed.status);
  if (!status) {
    await finish(true, `unsupported_status:${parsed.status}`, payment.id);
    return respond(req, { received: true, ignored: `status:${parsed.status}`, paymentId: payment.id });
  }

  try {
    const result = await applyProviderVerdict(
      db,
      payment,
      { status, failureReason: parsed.failureReason, providerReference: parsed.providerTransactionId ?? undefined, paidAt: parsed.paidAt, amount: parsed.amount, currency: parsed.currency, raw: payload },
      wlog.child({ paymentId: payment.id }),
      { actor: `webhook:${providerKey}`, reason: `Webhook ${parsed.eventType}`, metadata: { webhookId, eventId: parsed.eventId } },
    );

    await finish(true, result.changed ? null : `ignored:${result.ignoredReason}`, payment.id);
    await writeAuditLog(db, {
      action: result.changed ? 'webhook.applied' : 'webhook.ignored',
      entityType: 'paiements',
      entityId: payment.id,
      oldData: { state: payment.state },
      newData: { state: result.payment.state, event: result.event, eventId: parsed.eventId, webhookId, pipelineOk: result.pipeline?.ok ?? null, ignoredReason: result.ignoredReason ?? null },
    });

    wlog.info('webhook processed', { paymentId: payment.id, from: payment.state, to: result.payment.state, changed: result.changed, pipelineOk: result.pipeline?.ok });
    return respond(req, {
      received: true,
      paymentId: payment.id,
      state: result.payment.state,
      changed: result.changed,
      pipeline: result.pipeline ? { ok: result.pipeline.ok, steps: Object.fromEntries(Object.entries(result.pipeline.steps).map(([k, v]) => [k, v.status])) } : undefined,
    });
  } catch (error) {
    // The state change itself failed (DB outage, concurrent writer…). Leave the
    // webhook unprocessed so it can be replayed by an operator retry / admin.
    const message = error instanceof Error ? error.message : String(error);
    wlog.error('webhook processing failed', error, { paymentId: payment.id });
    await finish(false, message, payment.id);
    const status = error instanceof HttpError ? error.status : 500;
    return respond(req, { received: true, error: 'processing_failed', paymentId: payment.id }, status);
  }
});
