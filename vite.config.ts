import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import path from 'path';

/**
 * Loads the bundled stylesheet without blocking first paint. index.html carries
 * inline critical CSS for its static landing shell, and main.tsx waits for the
 * tagged stylesheet (`data-app-css`) before mounting React, so nothing renders
 * unstyled.
 */
function nonBlockingCss(): Plugin {
  return {
    name: 'eloyer:non-blocking-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet" crossorigin href="([^"]+\.css)">/g,
        (_match, href: string) =>
          `<link rel="preload" as="style" crossorigin href="${href}" data-app-css onload="this.onload=null;this.rel='stylesheet'">` +
          `<noscript><link rel="stylesheet" crossorigin href="${href}"></noscript>`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), nonBlockingCss()],
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
              test: /node_modules[\\/](clsx|tailwind-merge|class-variance-authority|react-is|use-sync-external-store)[\\/]/,
              priority: 85,
            },
            // Kept apart from `utils` so the landing page (which only needs `cn`) never downloads date-fns.
            { name: 'dates', test: /node_modules[\\/]date-fns[\\/]/, priority: 85 },
            {
              name: 'charts',
              test: /node_modules[\\/](recharts|react-smooth|victory-vendor|d3-[a-z-]+|@reduxjs|redux|redux-thunk|react-redux|immer|reselect|decimal\.js-light|internmap|es-toolkit|eventemitter3)[\\/]/,
              priority: 80,
            },
            { name: 'maps', test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/, priority: 80 },
            {
              name: 'motion',
              test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/,
              priority: 80,
            },
          ],
        },
      },
    },
  },
});
