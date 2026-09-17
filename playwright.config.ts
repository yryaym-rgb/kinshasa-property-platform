import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * End-to-end suite for the public + authentication flow.
 *
 * Runs against the production build served by `vite preview`; Supabase is
 * replaced by an in-memory mock (tests/e2e/support/supabase-mock.ts), so the
 * suite needs no credentials and is deterministic.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'fr-CD',
    timezoneId: 'Africa/Kinshasa',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1350, height: 940 } } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
