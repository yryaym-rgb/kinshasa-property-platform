import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import path from 'path';

/**
 * Loads the bundled stylesheet without blocking first paint. index.html carries
 * inline critical CSS for its static shells, and main.tsx waits for the tagged
 * stylesheet (`data-app-css`) before mounting React, so nothing renders unstyled.
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

/** Maps entry routes to the page module name used to locate its JS chunk in the bundle. */
const ENTRY_ROUTE_MODULES: Record<string, string> = {
  '/': 'LandingPage',
  '/login': 'LoginPage',
  '/register': 'RegisterPage',
  '/verify': 'VerifyOTPPage',
  '/forgot-password': 'ForgotPasswordPage',
  '/reset-password': 'ResetPasswordPage',
};

/**
 * Injects an inline script that adds `<link rel="modulepreload">` for the chunk
 * belonging to the current pathname, so the route module starts downloading in
 * parallel with the entry bundle instead of after React boots.
 */
function routeModulePreload(): Plugin {
  return {
    name: 'eloyer:route-module-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;

        const routes: Record<string, string[]> = {};
        for (const [route, moduleName] of Object.entries(ENTRY_ROUTE_MODULES)) {
          const hrefs: string[] = [];
          for (const [fileName, item] of Object.entries(bundle)) {
            if (item.type !== 'chunk') continue;
            const chunk = item as {
              facadeModuleId?: string | null;
              moduleIds: string[];
            };
            const hit =
              chunk.facadeModuleId?.includes(moduleName) ||
              chunk.moduleIds.some((id) => id.includes(moduleName) && id.includes('/pages/'));
            if (hit) hrefs.push('/' + fileName);
          }
          if (hrefs.length) routes[route] = hrefs;
        }

        const script = `<script>(function(r){var p=location.pathname.replace(/\\/+$/,'')||'/';var c=r[p];if(!c)return;c.forEach(function(h){var l=document.createElement('link');l.rel='modulepreload';l.href=h;l.crossOrigin='';document.head.appendChild(l)})})(${JSON.stringify(routes)})</script>`;
        return html.replace('</head>', `${script}\n</head>`);
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), nonBlockingCss(), routeModulePreload()],
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
