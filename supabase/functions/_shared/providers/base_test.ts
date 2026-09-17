/**
 * Provider base tests — webhook signature verification, payload parsing and
 * the deterministic sandbox simulator.
 *
 *   deno test --allow-env --allow-net _shared/
 */

import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { hmacSha256Base64, hmacSha256Hex, sandboxInitiate, sandboxVerify, timingSafeEqual } from './base.ts';
import { orangeMoneyProvider } from './orange-money.ts';
import { mpesaProvider } from './mpesa.ts';
import { airtelMoneyProvider } from './airtel-money.ts';
import { getProviderAdapter } from './index.ts';

const SECRET = 'whsec_test_0123456789';
const BODY = JSON.stringify({ status: 'SUCCESS', txnid: 'OM-123', order_id: 'PAY-2026-0001', amount: 850000 });

// ─── HMAC verification ─────────────────────────────────────────────────────

Deno.test('verifyWebhookSignature accepts a valid hex HMAC-SHA256', async () => {
  const sig = await hmacSha256Hex(SECRET, BODY);
  assert(await orangeMoneyProvider.verifyWebhookSignature(BODY, sig, SECRET));
});

Deno.test('verifyWebhookSignature accepts upper-case hex and the sha256= prefix', async () => {
  const sig = await hmacSha256Hex(SECRET, BODY);
  assert(await orangeMoneyProvider.verifyWebhookSignature(BODY, sig.toUpperCase(), SECRET));
  assert(await orangeMoneyProvider.verifyWebhookSignature(BODY, `sha256=${sig}`, SECRET));
});

Deno.test('verifyWebhookSignature accepts a base64 HMAC-SHA256', async () => {
  const sig = await hmacSha256Base64(SECRET, BODY);
  assert(await airtelMoneyProvider.verifyWebhookSignature(BODY, sig, SECRET));
});

Deno.test('verifyWebhookSignature rejects a tampered body', async () => {
  const sig = await hmacSha256Hex(SECRET, BODY);
  const tampered = BODY.replace('850000', '850001');
  assertEquals(await orangeMoneyProvider.verifyWebhookSignature(tampered, sig, SECRET), false);
});

Deno.test('verifyWebhookSignature rejects a wrong secret', async () => {
  const sig = await hmacSha256Hex('another-secret', BODY);
  assertEquals(await orangeMoneyProvider.verifyWebhookSignature(BODY, sig, SECRET), false);
});

Deno.test('verifyWebhookSignature never throws: empty secret / signature / garbage → false', async () => {
  const sig = await hmacSha256Hex(SECRET, BODY);
  assertEquals(await orangeMoneyProvider.verifyWebhookSignature(BODY, sig, ''), false);
  assertEquals(await orangeMoneyProvider.verifyWebhookSignature(BODY, '', SECRET), false);
  assertEquals(await orangeMoneyProvider.verifyWebhookSignature(BODY, 'not-a-signature', SECRET), false);
});

Deno.test('timingSafeEqual compares full strings and rejects length mismatches', () => {
  assert(timingSafeEqual('abcdef', 'abcdef'));
  assertEquals(timingSafeEqual('abcdef', 'abcdeg'), false);
  assertEquals(timingSafeEqual('abcdef', 'abcde'), false);
  assertEquals(timingSafeEqual('', 'a'), false);
});

// ─── Webhook parsing ───────────────────────────────────────────────────────

Deno.test('Orange Money parseWebhook maps SUCCESS and uses notif_token as event id', () => {
  const parsed = orangeMoneyProvider.parseWebhook(
    { status: 'SUCCESS', notif_token: 'ntk-1', txnid: 'OM-123', order_id: 'PAY-2026-0001', amount: 850000 },
    new Headers(),
  );
  assert(parsed);
  assertEquals(parsed.status, 'succeeded');
  assertEquals(parsed.eventId, 'ntk-1');
  assertEquals(parsed.providerTransactionId, 'OM-123');
  assertEquals(parsed.merchantReference, 'PAY-2026-0001');
  assertEquals(parsed.amount, 850000);
  assert(parsed.paidAt);
});

Deno.test('Orange Money parseWebhook maps FAILED with native error code and EXPIRED to expired', () => {
  const failed = orangeMoneyProvider.parseWebhook({ status: 'FAILED', txnid: 'OM-9', code: '60019' }, new Headers());
  assert(failed);
  assertEquals(failed.status, 'failed');
  assertEquals(failed.failureReason, 'insufficient_funds');

  const expired = orangeMoneyProvider.parseWebhook({ status: 'EXPIRED', txnid: 'OM-10' }, new Headers());
  assert(expired);
  assertEquals(expired.status, 'expired');
});

Deno.test('Orange Money parseWebhook returns null for malformed payloads', () => {
  assertEquals(orangeMoneyProvider.parseWebhook(null, new Headers()), null);
  assertEquals(orangeMoneyProvider.parseWebhook('SUCCESS', new Headers()), null);
  assertEquals(orangeMoneyProvider.parseWebhook({ status: 'SUCCESS' }, new Headers()), null);
  assertEquals(orangeMoneyProvider.parseWebhook({ txnid: 'OM-1' }, new Headers()), null);
});

Deno.test('M-Pesa parseWebhook maps INS-0 to succeeded and other codes to failed', () => {
  const ok = mpesaProvider.parseWebhook(
    {
      output_ResponseCode: 'INS-0',
      output_TransactionID: 'MP-777',
      output_ThirdPartyConversationID: 'PAY-2026-0002',
      input_Amount: '120000',
      input_Currency: 'CDF',
    },
    new Headers(),
  );
  assert(ok);
  assertEquals(ok.status, 'succeeded');
  assertEquals(ok.providerTransactionId, 'MP-777');
  assertEquals(ok.merchantReference, 'PAY-2026-0002');
  assertEquals(ok.amount, 120000);
  assertEquals(ok.currency, 'CDF');

  const ko = mpesaProvider.parseWebhook({ output_ResponseCode: 'INS-2006', output_TransactionID: 'MP-778' }, new Headers());
  assert(ko);
  assertEquals(ko.status, 'failed');
  assertEquals(ko.failureReason, 'insufficient_funds');

  assertEquals(mpesaProvider.parseWebhook({ foo: 'bar' }, new Headers()), null);
});

Deno.test('Airtel Money parseWebhook reads the nested transaction and maps TS/TF/TE', () => {
  const ok = airtelMoneyProvider.parseWebhook(
    { transaction: { id: 'PAY-2026-0003', airtel_money_id: 'AM-1', status_code: 'TS', amount: 50000 } },
    new Headers(),
  );
  assert(ok);
  assertEquals(ok.status, 'succeeded');
  assertEquals(ok.providerTransactionId, 'AM-1');
  assertEquals(ok.merchantReference, 'PAY-2026-0003');

  const failed = airtelMoneyProvider.parseWebhook(
    { transaction: { id: 'PAY-2026-0004', status_code: 'TF', message: 'Insufficient balance' } },
    new Headers(),
  );
  assert(failed);
  assertEquals(failed.status, 'failed');

  const expired = airtelMoneyProvider.parseWebhook({ transaction: { id: 'PAY-2026-0005', status_code: 'TE' } }, new Headers());
  assert(expired);
  assertEquals(expired.status, 'expired');

  assertEquals(airtelMoneyProvider.parseWebhook({ transaction: {} }, new Headers()), null);
  assertEquals(airtelMoneyProvider.parseWebhook({}, new Headers()), null);
});

Deno.test('provider registry resolves every catalogue key and rejects unknown ones', () => {
  for (const key of ['orange_money', 'mpesa', 'airtel_money', 'card', 'bank_transfer'] as const) {
    assertEquals(getProviderAdapter(key).key, key);
  }
  let threw = false;
  try {
    getProviderAdapter('paypal');
  } catch {
    threw = true;
  }
  assert(threw, 'unknown provider must throw');
});

// ─── Sandbox simulator ─────────────────────────────────────────────────────

const baseReq = { amount: 850000, currency: 'CDF', reference: 'PAY-TEST', description: 'Loyer test' };

Deno.test('sandbox: forced-success suffix settles instantly and verify agrees', () => {
  const init = sandboxInitiate('OM', { ...baseReq, phone: '+243810000111' });
  assertEquals(init.status, 'succeeded');
  assertMatch(init.providerTransactionId, /^OM-SBX-[0-9a-z]+-S0-[0-9a-f]{6}$/);
  // Verify is time-based; a freshly created S-outcome id is still "processing" until the settle delay elapses.
  const verify = sandboxVerify(init.providerTransactionId);
  assert(verify.status === 'processing' || verify.status === 'succeeded');
});

Deno.test('sandbox: forced-failure suffix yields a failing transaction id', () => {
  const init = sandboxInitiate('MP', { ...baseReq, phone: '+243810000000' });
  assertEquals(init.status, 'processing');
  assertMatch(init.providerTransactionId, /-F\d-/);
});

Deno.test('sandbox: forced-action suffix reports requires_action', () => {
  const init = sandboxInitiate('AM', { ...baseReq, phone: '+243810000222' });
  assertEquals(init.status, 'requires_action');
  assertEquals(sandboxVerify(init.providerTransactionId).status, 'requires_action');
});

Deno.test('sandbox: verify is deterministic from the id alone — settled ids resolve without in-memory state', () => {
  const past = (Date.now() - 60_000).toString(36);
  const succeeded = sandboxVerify(`OM-SBX-${past}-S0-abc123`);
  assertEquals(succeeded.status, 'succeeded');
  assert(succeeded.paidAt);

  const failed = sandboxVerify(`OM-SBX-${past}-F0-abc123`);
  assertEquals(failed.status, 'failed');
  assertEquals(failed.failureReason, 'insufficient_funds');

  const unknown = sandboxVerify('not-a-sandbox-id');
  assertEquals(unknown.status, 'failed');
  assertEquals(unknown.failureReason, 'provider_error');
});

Deno.test('sandbox: phone numbers are redacted in the raw echo', () => {
  const init = sandboxInitiate('OM', { ...baseReq, phone: '+243810000111' });
  const echoed = (init.raw as { request: { phone?: string } }).request.phone;
  assertEquals(echoed, '…0111');
});
