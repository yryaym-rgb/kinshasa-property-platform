import { lazyRoute } from '@/lib/lazyRoute';
import { ROUTES } from '@/config/routes';

/**
 * Entry-point routes: the pages a visitor can land on directly from a URL.
 *
 * Each is code-split, and `main.tsx` preloads the one matching
 * `location.pathname` *before* mounting React, so the first commit renders the
 * final page on top of the static shell (no Suspense fallback, no layout shift).
 * A Vite plugin (`routeModulePreload` in vite.config.ts) also injects
 * `<link rel="modulepreload">` hints for that route's chunks so the fetch
 * starts from the HTML, in parallel with the entry bundle.
 */
export const LandingPage = lazyRoute(() => import('@/pages/public/LandingPage').then((m) => m.LandingPage));
export const LoginPage = lazyRoute(() => import('@/pages/auth/LoginPage').then((m) => m.LoginPage));
// The wizard also warms the step a saved draft left off on, so a restored
// session on step 2/3 paints its form directly instead of a skeleton.
export const RegisterPage = lazyRoute(() =>
  import('@/pages/auth/register/RegisterPage').then(async (m) => {
    await m.preloadRegisterStep();
    return m.RegisterPage;
  }),
);
export const VerifyOTPPage = lazyRoute(() => import('@/pages/auth/VerifyOTPPage').then((m) => m.VerifyOTPPage));
export const ForgotPasswordPage = lazyRoute(() =>
  import('@/pages/auth/ForgotPasswordPage').then((m) => m.ForgotPasswordPage),
);
export const ResetPasswordPage = lazyRoute(() =>
  import('@/pages/auth/ResetPasswordPage').then((m) => m.ResetPasswordPage),
);

const ENTRY_ROUTES: Record<string, { preload: () => Promise<void> }> = {
  [ROUTES.HOME]: LandingPage,
  [ROUTES.LOGIN]: LoginPage,
  [ROUTES.REGISTER]: RegisterPage,
  [ROUTES.VERIFY]: VerifyOTPPage,
  [ROUTES.FORGOT_PASSWORD]: ForgotPasswordPage,
  [ROUTES.RESET_PASSWORD]: ResetPasswordPage,
};

export const AUTH_PATHS: readonly string[] = [
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.VERIFY,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
];

function normalize(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.includes(normalize(pathname));
}

/** Resolves once the page module for `pathname` is ready (immediately for unknown paths). */
export function preloadEntryRoute(pathname: string): Promise<void> {
  const route = ENTRY_ROUTES[normalize(pathname)];
  return route ? route.preload() : Promise.resolve();
}
