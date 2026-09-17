import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suites (tests/e2e):
 *  - auth-flow: public pages + registration / OTP / login / logout, against the
 *    in-memory GoTrue mock (support/supabase-mock.ts).
 *  - payment-flow, tax-dashboard, tax-simulator (modules 4 + 5): authenticated
 *    flows against the PostgREST / Edge Functions / Realtime mock
 *    (support/mockSupabase.ts).
 *
 * Both run against the production build served by `vite preview` — the static
 * shell and paint-first loader only exist there — and both intercept Supabase
 * at the network layer, so the suite needs no credentials or database. The
 * Supabase URL is baked into the build below; the mocks match it (any
 * `*.supabase.co` host for the auth mock, this exact origin for the data mock).
 */
export const E2E_SUPABASE_URL = 'https://e2e-mock.supabase.co';
export const E2E_PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'fr-CD',
    timezoneId: 'Africa/Kinshasa',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1350, height: 940 } } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${E2E_PORT} --strictPort`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: E2E_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
      VITE_APP_ENV: 'test',
    },
  },
});
