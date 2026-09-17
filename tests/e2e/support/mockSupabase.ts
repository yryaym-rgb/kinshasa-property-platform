/**
 * In-browser mock of the Supabase surface used by the app: GoTrue session,
 * PostgREST tables + RPCs, Edge Functions and the Realtime websocket.
 *
 * Everything is intercepted with `page.route` on `E2E_SUPABASE_URL`, so the
 * suite runs offline and deterministically. The mock keeps a small amount of
 * state (payments created by `payment-initiate`, verify call counters, receipts)
 * to replay the realtime + polling flow end to end:
 *
 *   payment-initiate → processing
 *   payment-verify #1 → processing (provider checked)
 *   payment-verify #2 → succeeded + pipeline done (tax, receipt…) and a `recus` row
 */

import type { Page, Route } from '@playwright/test';
import { E2E_SUPABASE_URL } from '../../../playwright.config';
import {
  BAILLEUR_ROW,
  COMPLIANCE,
  CONTRAT,
  IDS,
  IMPOTS,
  LANDLORD_USER,
  PAYMENT_PROVIDERS,
  RENT,
  TAX_RULES,
  TAX_SUMMARY,
  TENANT_USER,
} from './fixtures';

type Json = Record<string, unknown>;
type Row = Record<string, unknown>;

export type MockRole = 'locataire' | 'bailleur';

export interface MockOptions {
  role: MockRole;
  /** Number of `payment-verify` calls before the sandbox payment settles (default 2). */
  settleAfterVerifyCalls?: number;
  /** Provider verdict when the payment settles. */
  outcome?: 'succeeded' | 'failed';
  failureReason?: string;
  /** State returned by payment-initiate (default `processing`; `requires_action` = USSD prompt pending). */
  initialState?: 'pending' | 'processing' | 'requires_action';
}

export interface FunctionCall {
  name: string;
  body: Json;
  headers: Record<string, string>;
}

export interface MockBackend {
  calls: FunctionCall[];
  rpcCalls: Array<{ name: string; args: Json }>;
  payments: Map<string, Row>;
  receipts: Row[];
  /** Console errors + uncaught page errors observed during the test. */
  consoleErrors: string[];
  callsTo(name: string): FunctionCall[];
}

const PROJECT_REF = new URL(E2E_SUPABASE_URL).hostname.split('.')[0]!;
export const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

// ─── Session ───────────────────────────────────────────────────────────────

function b64url(input: string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fakeJwt(userId: string, role: MockRole): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: `${E2E_SUPABASE_URL}/auth/v1`,
      sub: userId,
      aud: 'authenticated',
      role: 'authenticated',
      exp: now + 6 * 3600,
      iat: now,
      session_id: 'e2e-session',
      app_metadata: { provider: 'phone', role },
      user_metadata: {},
    }),
  );
  return `${header}.${payload}.e2e-signature`;
}

function authUser(user: typeof TENANT_USER | typeof LANDLORD_USER) {
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    phone: user.phone.replace('+', ''),
    email_confirmed_at: user.created_at,
    phone_confirmed_at: user.created_at,
    app_metadata: { provider: 'phone', providers: ['phone'] },
    user_metadata: { full_name: user.full_name, role: user.role },
    identities: [],
    created_at: user.created_at,
    updated_at: user.updated_at,
    is_anonymous: false,
  };
}

function buildSession(role: MockRole) {
  const user = role === 'bailleur' ? LANDLORD_USER : TENANT_USER;
  const expiresIn = 6 * 3600;
  return {
    access_token: fakeJwt(user.id, role),
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: 'e2e-refresh-token',
    user: authUser(user),
  };
}

// ─── PostgREST query engine (subset) ───────────────────────────────────────

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function get(row: Row, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Row)[k] : undefined), row);
}

function matches(row: Row, key: string, raw: string): boolean {
  const idx = raw.indexOf('.');
  const op = idx === -1 ? 'eq' : raw.slice(0, idx);
  const val = idx === -1 ? raw : raw.slice(idx + 1);
  const actual = get(row, key);
  const cmp = (a: unknown, b: string) => {
    const na = Number(a);
    const nb = Number(b);
    return Number.isFinite(na) && Number.isFinite(nb) ? na - nb : String(a).localeCompare(b);
  };
  switch (op) {
    case 'eq':
      return String(actual) === val;
    case 'neq':
      return String(actual) !== val;
    case 'in': {
      const list = val.replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
      return list.includes(String(actual));
    }
    case 'gte':
      return actual !== null && actual !== undefined && cmp(actual, val) >= 0;
    case 'lte':
      return actual !== null && actual !== undefined && cmp(actual, val) <= 0;
    case 'gt':
      return actual !== null && actual !== undefined && cmp(actual, val) > 0;
    case 'lt':
      return actual !== null && actual !== undefined && cmp(actual, val) < 0;
    case 'is':
      return val === 'null' ? actual === null || actual === undefined : String(actual) === val;
    case 'ilike':
    case 'like': {
      const re = new RegExp(`^${val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`, op === 'ilike' ? 'i' : '');
      return re.test(String(actual ?? ''));
    }
    default:
      return true;
  }
}

function applyQuery(rows: Row[], url: URL): Row[] {
  let out = rows.filter((row) =>
    [...url.searchParams.entries()].every(([key, raw]) => {
      if (RESERVED.has(key)) return true;
      // Embedded-resource filters (e.g. `contrat.locataire_id`) are not modelled; fixtures are pre-scoped.
      if (key.includes('.')) return true;
      return matches(row, key, raw);
    }),
  );

  const order = url.searchParams.get('order');
  if (order) {
    const clauses = order.split(',').map((c) => c.split('.'));
    out = [...out].sort((a, b) => {
      for (const [col, dir] of clauses) {
        const av = get(a, col!);
        const bv = get(b, col!);
        if (av === bv) continue;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return dir === 'desc' ? -c : c;
      }
      return 0;
    });
  }

  const limit = url.searchParams.get('limit');
  if (limit) out = out.slice(0, Number(limit));
  return out;
}

// ─── Mock tax engine (mirrors the seed rules) ──────────────────────────────

const COMMERCIAL = new Set(['Bureau', 'Magasin', 'Entrepôt']);

function mockTaxCalculate(input: Json) {
  const montantBrut = Number(input.montantBrut ?? 0);
  const typeLogement = String(input.typeLogement ?? '');
  const periode = typeof input.periode === 'string' ? input.periode : null;
  const dateEcheance = periode
    ? new Date(Date.UTC(Number(periode.slice(0, 4)), Number(periode.slice(5, 7)), 15)).toISOString().slice(0, 10)
    : null;

  const line = (rule: (typeof TAX_RULES)[number], type: string, montant: number) => ({
    ordre: 1,
    type,
    regleId: rule.id,
    regleNom: rule.nom,
    description: rule.motif_exoneration ?? rule.description,
    taux: rule.taux,
    montantFixe: null,
    base: montantBrut,
    montant,
    cumul: montant,
    referenceLegale: rule.reference_legale,
    articleLoi: rule.article_loi,
    priorite: rule.priorite,
  });
  const ref = (rule: (typeof TAX_RULES)[number]) => ({
    ruleId: rule.id,
    ruleName: rule.nom,
    reference: rule.reference_legale,
    article: rule.article_loi,
    pendingValidation: true,
  });

  let rule = TAX_RULES[3]!;
  if (montantBrut < 50000) rule = TAX_RULES[0]!;
  else if (COMMERCIAL.has(typeLogement)) rule = TAX_RULES[2]!;
  else if (TAX_RULES[1]!.type_logement!.includes(typeLogement)) rule = TAX_RULES[1]!;

  const exonere = rule.exonere;
  const montantImpot = exonere ? 0 : Math.round(montantBrut * rule.taux * 100) / 100;
  return {
    baseImposable: montantBrut,
    montantImpot,
    tauxApplique: exonere ? 0 : rule.taux * 100,
    tauxEffectif: exonere ? 0 : rule.taux,
    exonere,
    motifExoneration: exonere ? rule.motif_exoneration : null,
    reglesAppliquees: [rule.id],
    referenceLegale: `${rule.reference_legale} — ${rule.article_loi} (référence à valider)`,
    references: [ref(rule)],
    detail: [line(rule, exonere ? 'exoneration' : 'taux_base', montantImpot)],
    calculationVersion: '1.0.0',
    dateEcheance,
    calculId: input.persist === false ? undefined : `calc-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function applicableRules(args: Json) {
  const montant = Number(args.p_montant ?? 0);
  const type = String(args.p_type_logement ?? '');
  const commune = String(args.p_commune ?? '');
  return TAX_RULES.filter((r) => {
    if (r.type_logement && !r.type_logement.includes(type)) return false;
    if (r.commune && !(r.commune as string[]).includes(commune)) return false;
    if (r.tranche_min !== null && montant < r.tranche_min) return false;
    if (r.tranche_max !== null && montant > r.tranche_max) return false;
    return true;
  }).sort((a, b) => a.priorite - b.priorite);
}

// ─── Install ───────────────────────────────────────────────────────────────

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-expose-headers': '*',
};

function reply(route: Route, status: number, body: unknown, headers: Record<string, string> = {}) {
  return route.fulfill({
    status,
    headers: { 'content-type': 'application/json', ...CORS, ...headers },
    body: body === undefined ? '' : JSON.stringify(body),
  });
}

export async function installMockSupabase(page: Page, options: MockOptions): Promise<MockBackend> {
  const role = options.role;
  const settleAfter = options.settleAfterVerifyCalls ?? 2;
  const outcome = options.outcome ?? 'succeeded';
  const initialState = options.initialState ?? 'processing';
  const session = buildSession(role);
  const profile = role === 'bailleur' ? LANDLORD_USER : TENANT_USER;

  const backend: MockBackend = {
    calls: [],
    rpcCalls: [],
    payments: new Map(),
    receipts: [],
    consoleErrors: [],
    callsTo(name) {
      return this.calls.filter((c) => c.name === name);
    },
  };
  const verifyCounts = new Map<string, number>();
  const idempotency = new Map<string, string>();

  page.on('console', (msg) => {
    if (msg.type() === 'error') backend.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => backend.consoleErrors.push(`pageerror: ${err.message}`));

  // Persisted session (localStorage because "remember me" = 1) → AuthContext restores it without a network call.
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem('eloyer-remember', '1');
      window.localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: JSON.stringify(session) },
  );

  // Realtime: accept the websocket but never answer — the hooks must fall back to polling.
  await page.routeWebSocket(/realtime\/v1\/websocket/, () => {});

  const tables: Record<string, () => Row[]> = {
    users: () => [TENANT_USER, LANDLORD_USER],
    bailleurs: () => [BAILLEUR_ROW],
    contrats: () => [CONTRAT],
    payment_providers: () => PAYMENT_PROVIDERS,
    regles_fiscales: () => TAX_RULES,
    impots: () => IMPOTS,
    paiements: () => [...backend.payments.values()],
    recus: () => backend.receipts,
    payment_state_history: () => [],
    notifications: () => [],
    audit_logs: () => [],
    logements: () => [{ ...CONTRAT.logement, bailleur_id: IDS.bailleur, status: 'loue' }],
  };

  const settle = (paymentId: string) => {
    const payment = backend.payments.get(paymentId);
    if (!payment) return;
    const now = new Date().toISOString();
    if (outcome === 'failed') {
      Object.assign(payment, { state: 'failed', status: 'echoue', failure_reason: options.failureReason ?? 'insufficient_funds', state_changed_at: now });
      return;
    }
    const tax = mockTaxCalculate({ montantBrut: RENT, typeLogement: CONTRAT.logement.type, periode: payment.periode });
    backend.calls.push({ name: 'tax-calculate (pipeline)', body: { paiementId: paymentId, montantBrut: RENT }, headers: {} });
    const receiptId = `recu-${paymentId.slice(-6)}`;
    const receiptCode = `REC-2026-${paymentId.slice(-4).toUpperCase()}`;
    const impotId = `impot-${paymentId.slice(-6)}`;
    Object.assign(payment, {
      state: 'succeeded',
      status: 'complete',
      paid_at: now,
      state_changed_at: now,
      tax_calculation: {
        rentAmount: RENT,
        taxRate: tax.tauxEffectif,
        taxAmount: tax.montantImpot,
        platformFeeRate: 0.02,
        platformFee: Math.round(RENT * 0.02),
        mobileMoneyFeeRate: 0.015,
        mobileMoneyFee: Math.round(RENT * 0.015),
        total: Number(payment.montant),
        legalReference: tax.referenceLegale,
        estimated: false,
      },
      pipeline: {
        tax: { status: 'done', at: now, result: { impotId, montantImpot: tax.montantImpot } },
        ledger: { status: 'done', at: now },
        receipt: { status: 'done', at: now, result: { receiptId, receiptCode } },
        notifications: { status: 'done', at: now },
        compliance: { status: 'done', at: now },
        audit: { status: 'done', at: now },
      },
    });
    backend.receipts.push({
      id: receiptId,
      code: receiptCode,
      paiement_id: paymentId,
      contrat_id: IDS.contrat,
      montant: payment.montant,
      currency: 'CDF',
      periode: payment.periode,
      issued_at: now,
      pdf_url: null,
      email_sent: false,
      sms_sent: false,
      metadata: { tax_calculation: payment.tax_calculation },
      created_at: now,
      paiement: { ...payment },
      contrat: {
        ...CONTRAT,
        locataire: { full_name: TENANT_USER.full_name, phone: TENANT_USER.phone, email: TENANT_USER.email },
      },
    });
  };

  const functions: Record<string, (body: Json) => { status: number; body: unknown }> = {
    'payment-initiate': (body) => {
      const key = String(body.idempotencyKey ?? '');
      const existingId = idempotency.get(key);
      if (existingId) {
        const p = backend.payments.get(existingId)!;
        return {
          status: 200,
          body: { paymentId: existingId, reference: p.reference, state: p.state, providerTransactionId: p.provider_transaction_id, expiresAt: p.expires_at, idempotentReplay: true },
        };
      }
      const id = `pay-e2e-${Math.random().toString(36).slice(2, 10)}`;
      const now = new Date().toISOString();
      const row: Row = {
        id,
        reference: `PAY-2026-${id.slice(-4).toUpperCase()}`,
        contrat_id: body.contractId,
        montant: body.amount,
        currency: body.currency ?? 'CDF',
        method: body.method,
        provider: body.method,
        status: 'en_attente',
        state: initialState,
        previous_state: initialState === 'pending' ? 'validating' : 'pending',
        state_changed_at: now,
        provider_transaction_id: `OM-SBX-${id.slice(-6)}`,
        periode: body.periode,
        paid_at: null,
        failure_reason: null,
        metadata: { rentAmount: body.rentAmount, phone: body.phone },
        idempotency_key: key,
        tax_calculation: null,
        pipeline: {},
        attempt_count: 1,
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        created_at: now,
        updated_at: now,
      };
      backend.payments.set(id, row);
      idempotency.set(key, id);
      return {
        status: 200,
        body: {
          paymentId: id,
          reference: row.reference,
          state: initialState,
          providerTransactionId: row.provider_transaction_id,
          message: '[SANDBOX] Confirmez le paiement sur votre téléphone (*144#)',
          expiresAt: row.expires_at,
          idempotentReplay: false,
        },
      };
    },
    'payment-verify': (body) => {
      const id = String(body.paymentId);
      const payment = backend.payments.get(id);
      if (!payment) return { status: 404, body: { error: 'payment_not_found', message: 'Paiement introuvable' } };
      const n = (verifyCounts.get(id) ?? 0) + 1;
      verifyCounts.set(id, n);
      if (n >= settleAfter && ['pending', 'processing', 'requires_action'].includes(String(payment.state))) settle(id);
      const pipeline = (payment.pipeline as Json) ?? {};
      const receipt = (pipeline.receipt as Json | undefined)?.result as Json | undefined;
      const taxStep = (pipeline.tax as Json | undefined)?.result as Json | undefined;
      return {
        status: 200,
        body: {
          paymentId: id,
          state: payment.state,
          status: payment.status,
          failureReason: payment.failure_reason,
          providerTransactionId: payment.provider_transaction_id,
          paidAt: payment.paid_at,
          expiresAt: payment.expires_at,
          providerChecked: true,
          receiptId: receipt?.receiptId ?? null,
          receiptCode: receipt?.receiptCode ?? null,
          impotId: taxStep?.impotId ?? null,
          pipeline,
        },
      };
    },
    'tax-calculate': (body) => ({ status: 200, body: mockTaxCalculate(body) }),
    'payment-refund': (body) => ({ status: 200, body: { paymentId: body.paymentId, state: 'refunded', refundId: 'rfd-e2e', amount: body.amount ?? null } }),
    'tax-recalculate': () => ({ status: 200, body: { runId: 'run-e2e', dryRun: true, report: [], summary: { total: 0, changed: 0 } } }),
  };

  const rpcs: Record<string, (args: Json) => unknown> = {
    get_bailleur_tax_summary: (args) => ({ ...TAX_SUMMARY, periode: args.p_periode_prefix ?? '' }),
    get_compliance_breakdown: () => COMPLIANCE,
    regles_fiscales_applicables: (args) => applicableRules(args),
    cancel_own_payment: (args) => {
      const p = backend.payments.get(String(args.p_paiement_id));
      if (p) Object.assign(p, { state: 'cancelled', status: 'annule', failure_reason: 'user_cancelled' });
      return p ?? null;
    },
    check_compliance_score: () => COMPLIANCE.score,
  };

  await page.route(`${E2E_SUPABASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;

    if (method === 'OPTIONS') return reply(route, 204, undefined);

    // ── Auth ──
    if (path.startsWith('/auth/v1/')) {
      if (path.endsWith('/user')) return reply(route, 200, session.user);
      if (path.endsWith('/token')) return reply(route, 200, session);
      if (path.endsWith('/logout')) return reply(route, 204, undefined);
      return reply(route, 200, {});
    }

    // ── Edge Functions ──
    if (path.startsWith('/functions/v1/')) {
      const name = path.slice('/functions/v1/'.length);
      let body: Json = {};
      try {
        body = (request.postDataJSON() as Json) ?? {};
      } catch {
        body = {};
      }
      backend.calls.push({ name, body, headers: request.headers() });
      const handler = functions[name];
      if (!handler) return reply(route, 404, { error: 'not_found', message: `Fonction inconnue : ${name}` });
      const res = handler(body);
      return reply(route, res.status, res.body);
    }

    // ── PostgREST ──
    if (path.startsWith('/rest/v1/rpc/')) {
      const name = path.slice('/rest/v1/rpc/'.length);
      let args: Json = {};
      try {
        args = (request.postDataJSON() as Json) ?? {};
      } catch {
        args = {};
      }
      backend.rpcCalls.push({ name, args });
      const handler = rpcs[name];
      return reply(route, 200, handler ? handler(args) : null);
    }

    if (path.startsWith('/rest/v1/')) {
      const table = path.slice('/rest/v1/'.length);
      const accept = request.headers()['accept'] ?? '';
      const wantsObject = accept.includes('vnd.pgrst.object');
      const source = tables[table];

      if (method === 'GET' || method === 'HEAD') {
        const rows = source ? applyQuery(source(), url) : [];
        // The profile query embeds `bailleurs(*)`: only the caller's row is visible under RLS.
        const scoped = table === 'users' ? rows.filter((r) => r.id === profile.id) : rows;
        if (wantsObject) {
          if (scoped.length === 0) {
            return reply(route, 406, { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' });
          }
          return reply(route, 200, scoped[0]);
        }
        const prefer = request.headers()['prefer'] ?? '';
        const headers = prefer.includes('count=') ? { 'content-range': `0-${Math.max(scoped.length - 1, 0)}/${scoped.length}` } : {};
        return reply(route, 200, scoped, headers);
      }

      // Writes from the frontend (notifications read flags, profile updates…) are acknowledged, never persisted.
      let payload: unknown = {};
      try {
        payload = request.postDataJSON();
      } catch {
        payload = {};
      }
      const echoed = Array.isArray(payload) ? payload : [{ id: `mock-${Date.now()}`, ...(payload as Row) }];
      return reply(route, method === 'POST' ? 201 : 200, wantsObject ? echoed[0] : echoed);
    }

    if (path.startsWith('/storage/v1/')) return reply(route, 404, { error: 'not_found' });
    return reply(route, 200, {});
  });

  return backend;
}

/** Console noise that is not a defect (dev-server tooling, missing sample media). */
const IGNORED_CONSOLE = [/Download the React DevTools/i, /\[vite\]/i, /favicon/i, /net::ERR_/i, /WebSocket/i];

export function realConsoleErrors(backend: MockBackend): string[] {
  return backend.consoleErrors.filter((m) => !IGNORED_CONSOLE.some((re) => re.test(m)));
}
