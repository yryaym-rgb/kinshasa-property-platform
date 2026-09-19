# Production deployment — eLoyer Kinshasa

Step-by-step guide for the ops team. Project Supabase: `moxfwfxmdctkvjbfvxgx`.

## 1. Prerequisites

- Node.js 20+, npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) 2.x (`supabase login`)
- Netlify (or government CDN) account for the Vite frontend
- Orange / M-Pesa / Airtel sandbox or production merchant credentials

## 2. Database migrations

Migrations live in `supabase/migrations/` (001–010). On a fresh project:

```bash
supabase link --project-ref moxfwfxmdctkvjbfvxgx
supabase db push
```

Verify in Dashboard → Database → Migrations that 001–010 are applied.

Seed reference data (communes + DRC tax rules):

```bash
psql "$DATABASE_URL" -f supabase/seed/01_communes.sql
psql "$DATABASE_URL" -f supabase/seed/03_tax_rules_drc.sql
```

Or run the equivalent SQL via Supabase SQL editor.

## 3. Edge Functions (6)

Functions: `payment-initiate`, `payment-verify`, `payment-webhook`, `payment-refund`, `tax-calculate`, `tax-recalculate`.

### Secrets (Dashboard → Project Settings → Edge Functions → Secrets)

Set at minimum for sandbox:

| Secret | Example / notes |
|--------|------------------|
| `PAYMENT_MODE` | `sandbox` |
| `ORANGE_MONEY_API_KEY` | placeholder (maps to OAuth client id in code) |
| `ORANGE_MONEY_API_SECRET` | placeholder |
| `ORANGE_MONEY_MERCHANT_ID` | placeholder |
| `ORANGE_MONEY_WEBHOOK_SECRET` | placeholder |
| `MPESA_CONSUMER_KEY` | placeholder (task docs may say `MPESA_API_KEY` — use consumer key name in code) |
| `MPESA_CONSUMER_SECRET` | placeholder |
| `MPESA_SHORTCODE` | placeholder (merchant id) |
| `MPESA_WEBHOOK_SECRET` | placeholder |
| `AIRTEL_MONEY_CLIENT_ID` | placeholder |
| `AIRTEL_MONEY_CLIENT_SECRET` | placeholder |
| `AIRTEL_MONEY_MERCHANT_ID` | placeholder |
| `AIRTEL_MONEY_WEBHOOK_SECRET` | placeholder |
| `INTERNAL_FUNCTION_SECRET` | random string (function-to-function auth) |
| `APP_URL` | production frontend URL |

Full reference: [MOBILE_MONEY_INTEGRATION.md](./MOBILE_MONEY_INTEGRATION.md).

### Deploy

```bash
cd supabase
supabase functions deploy payment-initiate --project-ref moxfwfxmdctkvjbfvxgx
supabase functions deploy payment-verify --project-ref moxfwfxmdctkvjbfvxgx
supabase functions deploy payment-webhook --project-ref moxfwfxmdctkvjbfvxgx
supabase functions deploy payment-refund --project-ref moxfwfxmdctkvjbfvxgx
supabase functions deploy tax-calculate --project-ref moxfwfxmdctkvjbfvxgx
supabase functions deploy tax-recalculate --project-ref moxfwfxmdctkvjbfvxgx
```

Helper (MCP-sized bundles): `node scripts/build-edge-deploy-payload.mjs <name> > /tmp/payload.json`

Smoke test webhook (expect **200**, signature may fail):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST \
  "https://moxfwfxmdctkvjbfvxgx.supabase.co/functions/v1/payment-webhook?provider=orange_money" \
  -H "Content-Type: application/json" \
  -d '{"test":true}'
```

## 4. Frontend (Netlify)

```bash
cp .env.example .env.production
# Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_ENV=production
npm ci && npm run build
```

Netlify: build command `npm run build`, publish directory `dist`, env vars from `.env.production`.

## 5. Governor demo data

```bash
export SUPABASE_URL=https://moxfwfxmdctkvjbfvxgx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...
node scripts/seed-governor-demo.mjs
```

Dry run: `node scripts/seed-governor-demo.mjs --dry-run`

## 6. Post-deploy checks

- [ ] Migrations 001–010 applied
- [ ] All 6 Edge Functions respond (401/400 acceptable without JWT; no 5xx on webhook POST)
- [ ] `payment_providers` has 5 rows, `regles_fiscales` has DRC rules
- [ ] Sandbox payment flow: initiate → verify → succeeded → impôt + ledger + receipt
- [ ] Landlord tax dashboard RPC `get_bailleur_tax_summary`
- [ ] Fiscal agent dashboard RPC `get_fiscal_dashboard`
- [ ] Playwright: `npm run test:e2e` (mock Supabase) or manual device checklist in [DEVICE_TESTING.md](./DEVICE_TESTING.md)

## 7. Rollback

- Frontend: Netlify instant rollback to previous deploy
- DB: restore Supabase point-in-time backup (Pro plan) — do not delete migration history manually
- Edge: redeploy previous function bundle from git tag
