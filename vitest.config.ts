import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Edge Function code lives in Deno and is covered by `deno test` (see supabase/functions/deno.json).
    exclude: ['node_modules', 'dist', 'supabase/**', 'tests/e2e/**'],
  },
});
