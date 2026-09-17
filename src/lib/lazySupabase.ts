import type { TypedSupabaseClient } from '@/config/supabase';

/**
 * Lazy access to the Supabase client for the authentication flow.
 *
 * `@/config/supabase` creates the client at module-evaluation time and pulls
 * the whole SDK (~55 KB gzipped) with it. The auth pages never touch Supabase
 * before the visitor submits a form, so the module — and therefore the SDK — is
 * only imported on first use, through this singleton. It resolves to the *same*
 * client instance the dashboards import statically, so there is never more
 * than one GoTrue client per tab.
 */
let pending: Promise<TypedSupabaseClient> | null = null;

export function getSupabase(): Promise<TypedSupabaseClient> {
  pending ??= import('@/config/supabase').then((m) => m.supabase);
  return pending;
}

/** `sb-<project-ref>-auth-token`, the key supabase-js persists the session under. */
function sessionStorageKey(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return null;
  try {
    return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}

/**
 * True when a previous visit left a session in storage (either store — see
 * `sessionStorageAdapter`). Without one the visitor is certainly signed out,
 * so the SDK does not need to be fetched just to confirm it.
 */
export function hasPersistedSession(): boolean {
  const key = sessionStorageKey();
  if (!key || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) !== null || window.sessionStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/** Recovery links and OAuth/PKCE callbacks carry tokens the SDK must exchange right away. */
export function hasAuthParamsInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const { hash, search } = window.location;
  return /(^|[#&?])(access_token|refresh_token|code|token_hash|error_code|error_description)=/.test(hash + search);
}
