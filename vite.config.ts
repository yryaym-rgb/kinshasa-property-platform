import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import path from 'path';

/** Entry routes (pages a visitor can land on) → the source module that renders them. */
const ENTRY_ROUTE_MODULES: Record<string, string> = {
  '/': 'src/pages/public/LandingPage.tsx',
  '/login': 'src/pages/auth/LoginPage.tsx',
  '/register': 'src/pages/auth/register/RegisterPage.tsx',
  '/verify': 'src/pages/auth/VerifyOTPPage.tsx',
  '/forgot-password': 'src/pages/auth/ForgotPasswordPage.tsx',
  '/reset-password': 'src/pages/auth/ResetPasswordPage.tsx',
};

/** Routes whose static shell in index.html is complete enough to be the page's LCP. */
const PAINT_FIRST_ROUTES = Object.keys(ENTRY_ROUTE_MODULES).filter((route) => route !== '/');

/** Chunks the register wizard only needs after step 1 — fetched at idle priority. */
const REGISTER_STEP_DIR = 'src/pages/auth/register/steps/';

interface BundleChunk {
  type: 'chunk' | 'asset';
  fileName: string;
  isEntry?: boolean;
  facadeModuleId?: string | null;
  imports?: string[];
}

/**
 * Replaces Vite's static `<script type="module">`, `<link rel="modulepreload">`
 * and `<link rel="stylesheet">` tags with one inline loader that knows the route:
 *
 * - The bundled stylesheet is loaded without blocking first paint (index.html
 *   carries inline critical CSS for its static shells; main.tsx waits for the
 *   tagged `data-app-css` stylesheet before mounting so nothing renders unstyled).
 * - The current route's page chunk *and its static dependency chunks* are
 *   module-preloaded from the HTML, so the route renders after one round trip
 *   instead of a waterfall (entry → page chunk → its imports).
 * - On /register the lazy step chunks are `prefetch`ed at idle priority.
 * - On routes with a full static shell, all of the above starts one frame after
 *   the shell has painted, so the shell's paint is never contended by script
 *   fetching and compilation (paint-first). Elsewhere it starts immediately.
 */
function paintFirstLoader(): Plugin {
  return {
    name: 'eloyer:paint-first-loader',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle as Record<string, BundleChunk> | undefined;
        if (!bundle) return html;

        const chunks = Object.values(bundle).filter((item): item is BundleChunk => item.type === 'chunk');
        const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
        const entry = chunks.find((chunk) => chunk.isEntry);
        if (!entry) return html;

        /** Static import closure of a chunk (excluding itself). */
        const closure = (start: BundleChunk): string[] => {
          const seen = new Set<string>();
          const stack = [...(start.imports ?? [])];
          while (stack.length) {
            const file = stack.pop()!;
            if (seen.has(file)) continue;
            seen.add(file);
            stack.push(...(byFile.get(file)?.imports ?? []));
          }
          return [...seen];
        };

        const entryFiles = new Set([entry.fileName, ...closure(entry)]);
        const routes: Record<string, { preload: string[]; prefetch?: string[] }> = {};
        for (const [route, moduleId] of Object.entries(ENTRY_ROUTE_MODULES)) {
          const page = chunks.find((chunk) => chunk.facadeModuleId?.endsWith(moduleId));
          if (!page) continue;
          const preload = [page.fileName, ...closure(page)].filter((file) => !entryFiles.has(file));
          const config: { preload: string[]; prefetch?: string[] } = { preload: preload.map((file) => '/' + file) };
          if (route === '/register') {
            const steps = chunks.filter((chunk) => chunk.facadeModuleId?.includes(REGISTER_STEP_DIR));
            if (steps.length) config.prefetch = steps.map((chunk) => '/' + chunk.fileName);
          }
          routes[route] = config;
        }

        const scriptSrc: string[] = [];
        const preloads: string[] = [];
        const styles: string[] = [];
        html = html
          .replace(/\s*<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_m, src: string) => {
            scriptSrc.push(src);
            return '';
          })
          .replace(/\s*<link rel="modulepreload" crossorigin href="([^"]+)">/g, (_m, href: string) => {
            preloads.push(href);
            return '';
          })
          .replace(/\s*<link rel="stylesheet" crossorigin href="([^"]+\.css)">/g, (_m, href: string) => {
            styles.push(href);
            return '';
          });

        const data = JSON.stringify({ e: scriptSrc, m: preloads, c: styles, r: routes, p: PAINT_FIRST_ROUTES });
        const loader = `<script>(function(d){var p=location.pathname.replace(/\\/+$/,'')||'/';var r=d.r[p]||{};var h=document.head;
function link(rel,href,as){var l=document.createElement('link');l.rel=rel;l.href=href;if(as)l.as=as;l.crossOrigin='';h.appendChild(l);return l}
function load(){if(load.done)return;load.done=1;
d.c.forEach(function(c){var l=link('preload',c,'style');l.setAttribute('data-app-css','');l.onload=function(){this.onload=null;this.rel='stylesheet'}});
d.m.concat(r.preload||[]).forEach(function(m){link('modulepreload',m)});
d.e.forEach(function(e){var s=document.createElement('script');s.type='module';s.crossOrigin='';s.src=e;h.appendChild(s)});
(r.prefetch||[]).forEach(function(f){link('prefetch',f,'script')})}
if(d.p.indexOf(p)===-1){load();return}
requestAnimationFrame(function(){requestAnimationFrame(load)});setTimeout(load,300)})(${data})</script>`;
        const noscript = styles.map((href) => `<noscript><link rel="stylesheet" crossorigin href="${href}"></noscript>`).join('');
        return html.replace('</head>', `    ${loader}${noscript}\n  </head>`);
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), paintFirstLoader()],
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
