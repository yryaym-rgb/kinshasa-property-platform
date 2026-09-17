import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the Vite dev server with a *mocked* Supabase
 * backend (see tests/e2e/support/mockSupabase.ts): every request to
 * `E2E_SUPABASE_URL` is intercepted at the network layer, so the suite needs
 * neither credentials nor a database and never touches a real project.
 */
export const E2E_SUPABASE_URL = 'https://e2e-mock.supabase.co';
export const E2E_PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    locale: 'fr-CD',
    timezoneId: 'Africa/Kinshasa',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx vite --port ${E2E_PORT} --strictPort`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: E2E_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
      VITE_APP_ENV: 'test',
    },
  },
});
