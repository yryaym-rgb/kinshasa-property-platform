import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { FullPageLoading } from '@/components/ui/LoadingSpinner';
import { Toaster } from '@/components/ui/Toast';
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

/**
 * index.html ships a static shell of the landing page (navbar identity + hero
 * backdrop). When present, let the browser paint the hero image once before
 * React takes over, so the very first frames are the branded page rather than
 * a blank root. decode() resolves once the bitmap is ready to paint, not merely
 * fetched.
 */
function whenShellPainted(): Promise<void> {
  const shellHero = document.querySelector<HTMLImageElement>('#lp-shell .sh-bg img');
  if (!shellHero) return Promise.resolve();

  // Element Timing reports the exact frame the image was presented in.
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

  return shellHero
    .decode()
    .catch(() => undefined)
    .then(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

// Never let a slow asset hold the app hostage: mount after 1 s regardless.
const deadline = new Promise<void>((resolve) => window.setTimeout(resolve, 1000));
Promise.race([Promise.all([whenStylesReady(), whenShellPainted()]), deadline]).then(boot);
