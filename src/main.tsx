import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { FullPageLoading } from '@/components/ui/LoadingSpinner';
import { Toaster } from '@/components/ui/Toast';
import { isAuthPath, preloadEntryRoute } from '@/routes/entryRoutes';
import App from './App';
import '@/styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

function boot() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <HelmetProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <AuthProvider>
                <Suspense fallback={<FullPageLoading />}>
                  <App />
                </Suspense>
                <Toaster />
              </AuthProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </HelmetProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

/** Resolves once the (non-render-blocking) app stylesheet has been applied. */
function whenStylesReady(): Promise<void> {
  const link = document.querySelector<HTMLLinkElement>('link[data-app-css]');
  if (!link || link.sheet) return Promise.resolve();
  return new Promise((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
  });
}

/** Two animation frames after decode — guarantees the shell bitmap is painted. */
function afterPaint(img: HTMLImageElement): Promise<void> {
  return img
    .decode()
    .catch(() => undefined)
    .then(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

/**
 * index.html ships a static shell of the landing page (navbar identity + hero
 * backdrop). When present, let the browser paint the hero image once before
 * React takes over.
 */
function whenLandingShellPainted(): Promise<void> {
  const shellHero = document.querySelector<HTMLImageElement>('#lp-shell .sh-bg img');
  if (!shellHero) return Promise.resolve();

  if (PerformanceObserver.supportedEntryTypes?.includes('element')) {
    return new Promise((resolve) => {
      const observer = new PerformanceObserver((list) => {
        if (list.getEntries().some((entry) => (entry as PerformanceEntry & { identifier?: string }).identifier === 'lp-shell-hero')) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe({ type: 'element', buffered: true });
    });
  }

  return afterPaint(shellHero);
}

/**
 * Split auth pages ship a left-panel photo in the static shell — decode it first,
 * but only on desktop where the panel is visible. On mobile the panel is hidden
 * and waiting on the bitmap would delay LCP for no visual benefit.
 */
function whenAuthShellPainted(): Promise<void> {
  const shell = document.getElementById('auth-shell');
  if (!shell?.classList.contains('as--split')) return Promise.resolve();
  if (!window.matchMedia('(min-width: 1024px)').matches) return Promise.resolve();
  const panelImg = document.querySelector<HTMLImageElement>('#auth-shell .as-panel__bg img');
  if (panelImg) return afterPaint(panelImg);
  return Promise.resolve();
}

const pathname = window.location.pathname;
const authEntry = isAuthPath(pathname);
const mountCapMs = authEntry ? 800 : 1000;

// Preload the matching entry route *and* wait for the static shell so React's
// first commit paints the final page on top of the shell (no Suspense flash).
const deadline = new Promise<void>((resolve) => window.setTimeout(resolve, mountCapMs));
Promise.race([
  Promise.all([
    whenStylesReady(),
    authEntry ? whenAuthShellPainted() : whenLandingShellPainted(),
    preloadEntryRoute(pathname),
  ]),
  deadline,
]).then(boot);
