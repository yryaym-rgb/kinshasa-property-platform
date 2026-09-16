/**
 * Browser-storage helpers for the authentication flow.
 *
 * - "Remember me": decides whether the Supabase session lives in localStorage
 *   (survives browser restarts) or sessionStorage (cleared when the tab closes).
 * - Registration draft: the wizard autosaves its fields so a refresh or a
 *   dropped 3G connection never loses the citizen's progress. Secrets
 *   (password, PIN) and the uploaded file are deliberately never persisted.
 * - Pending flow: tells the OTP page what to do once the code is verified.
 */

import type { KinshasaCommune, UserRole } from '@/types';

const REMEMBER_KEY = 'eloyer-remember';
const DRAFT_KEY = 'eloyer-register-draft';
const FLOW_KEY = 'eloyer-auth-flow';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/* ── Remember me ─────────────────────────────────────────────── */

export function setRememberMe(remember: boolean): void {
  safe(() => {
    if (remember) window.localStorage.setItem(REMEMBER_KEY, '1');
    else window.localStorage.removeItem(REMEMBER_KEY);
  }, undefined);
}

export function isRemembered(): boolean {
  return safe(() => window.localStorage.getItem(REMEMBER_KEY) === '1', true);
}

/**
 * Storage adapter handed to the Supabase client. Reads check both stores so an
 * existing session is always found; writes follow the current "remember me"
 * preference and evict the copy in the other store.
 */
export const sessionStorageAdapter = {
  getItem(key: string): string | null {
    return safe(() => window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key), null);
  },
  setItem(key: string, value: string): void {
    safe(() => {
      const persistent = isRemembered();
      const target = persistent ? window.localStorage : window.sessionStorage;
      const other = persistent ? window.sessionStorage : window.localStorage;
      target.setItem(key, value);
      other.removeItem(key);
    }, undefined);
  },
  removeItem(key: string): void {
    safe(() => {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }, undefined);
  },
};

/* ── Registration draft ──────────────────────────────────────── */

export type RegisterRole = Extract<UserRole, 'locataire' | 'bailleur' | 'agence'>;

export interface RegisterDraft {
  step: 1 | 2 | 3;
  role: RegisterRole | null;
  fullName: string;
  /** Nine national digits, e.g. "812345678". */
  phone: string;
  email: string;
  commune: KinshasaCommune | '';
  address: string;
  /** Metadata only — the File object itself lives in memory. */
  document: { name: string; size: number; type: string } | null;
  acceptTerms: boolean;
  notifications: boolean;
  savedAt: number;
}

export const EMPTY_DRAFT: RegisterDraft = {
  step: 1,
  role: null,
  fullName: '',
  phone: '',
  email: '',
  commune: '',
  address: '',
  document: null,
  acceptTerms: false,
  notifications: true,
  savedAt: 0,
};

export function loadRegisterDraft(): RegisterDraft | null {
  return safe(() => {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RegisterDraft>;
    return { ...EMPTY_DRAFT, ...parsed };
  }, null);
}

export function saveRegisterDraft(draft: RegisterDraft): void {
  safe(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  }, undefined);
}

export function clearRegisterDraft(): void {
  safe(() => window.localStorage.removeItem(DRAFT_KEY), undefined);
}

/* ── Pending identity document (memory only) ──────────────────── */

let pendingDocument: File | null = null;

/** Keeps the chosen file across the /register → /verify navigation without persisting it. */
export function setPendingDocument(file: File | null): void {
  pendingDocument = file;
}

export function takePendingDocument(): File | null {
  const file = pendingDocument;
  pendingDocument = null;
  return file;
}

/* ── Pending flow (login → OTP → …) ───────────────────────────── */

export type AuthFlow = 'login' | 'register' | 'reset';

export interface PendingFlow {
  type: AuthFlow;
  /** E.164 phone the code was sent to. */
  phone: string;
  email?: string;
  startedAt: number;
}

export function setPendingFlow(flow: Omit<PendingFlow, 'startedAt'>): void {
  safe(() => window.sessionStorage.setItem(FLOW_KEY, JSON.stringify({ ...flow, startedAt: Date.now() })), undefined);
}

export function getPendingFlow(): PendingFlow | null {
  return safe(() => {
    const raw = window.sessionStorage.getItem(FLOW_KEY);
    return raw ? (JSON.parse(raw) as PendingFlow) : null;
  }, null);
}

export function clearPendingFlow(): void {
  safe(() => window.sessionStorage.removeItem(FLOW_KEY), undefined);
}
