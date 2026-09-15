import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // Explicit groups keep React core in `vendor` and stop heavy, route-specific libraries
        // (charts, maps) from being pulled into the initial bundle of the public landing page.
        advancedChunks: {
          groups: [
            {
              name: 'vendor',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
              priority: 100,
            },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 90 },
            {
              name: 'utils',
              test: /node_modules[\\/](clsx|tailwind-merge|class-variance-authority|date-fns|react-is|use-sync-external-store)[\\/]/,
              priority: 85,
            },
            {
              name: 'charts',
              test: /node_modules[\\/](recharts|react-smooth|victory-vendor|d3-[a-z-]+|@reduxjs|redux|redux-thunk|react-redux|immer|reselect|decimal\.js-light|internmap|es-toolkit|eventemitter3)[\\/]/,
              priority: 80,
            },
            { name: 'maps', test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/, priority: 80 },
            {
              name: 'motion',
              test: /node_modules[\\/](framer-motion|motion-dom|motion-utils|@react-spring)[\\/]/,
              priority: 80,
            },
          ],
        },
      },
    },
  },
});
