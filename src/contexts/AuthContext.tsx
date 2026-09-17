import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { ROUTES, getDashboardPathForRole } from '@/config/routes';
import { AUTH_CONFIG } from '@/config/app.config';
import { getLockState, recordAttempt, resetAttempts } from '@/lib/authRateLimit';
import {
  clearPendingFlow,
  clearRegisterDraft,
  getPendingFlow,
  isRemembered,
  loadRegisterDraft,
  saveRegisterDraft,
  setPendingDocument,
  setPendingFlow,
  setRememberMe,
  takePendingDocument,
  type AuthFlow,
  type RegisterDraft,
} from '@/lib/authStorage';
import { toE164 } from '@/lib/phone';
import { getSupabase, hasAuthParamsInUrl, hasPersistedSession } from '@/lib/lazySupabase';
import { isAuthPath } from '@/routes/entryRoutes';
import type { TypedSupabaseClient } from '@/config/supabase';
import type { AuthUser, UserProfileFormData } from '@/types';

export type LoginInput =
  | { method: 'phone'; phone: string; password: string; rememberMe: boolean }
  | { method: 'email'; email: string; password: string; rememberMe: boolean };

export type PasswordResetInput = { method: 'phone'; phone: string } | { method: 'email'; email: string };

/** Surfaced to the login page as `?reason=` so it can explain why the user is back there. */
export type LogoutReason = 'inactivity' | 'password-updated';

interface AuthContextValue {
  user: AuthUser | null;
  session: ReturnType<typeof useAuthStore.getState>['session'];
  /** True until the persisted session has been checked once. */
  loading: boolean;
  /** Password sign-in; navigates to the role dashboard on success. */
  login: (input: LoginInput) => Promise<void>;
  /** Sends a sign-in code by SMS and moves to the verification page. */
  sendLoginCode: (phoneE164: string, rememberMe: boolean) => Promise<void>;
  resendCode: (phoneE164: string) => Promise<void>;
  /** Verifies the SMS code and completes whichever flow is pending. Returns the next route. */
  verifyCode: (phoneE164: string, token: string) => Promise<{ redirectTo: string; flow: AuthFlow }>;
  /** Creates the auth user from the wizard draft and moves to phone verification. */
  startRegistration: (draft: RegisterDraft, password: string, document: File | null) => Promise<void>;
  requestPasswordReset: (input: PasswordResetInput) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  logout: (reason?: LogoutReason) => Promise<void>;
  updateProfile: (data: UserProfileFormData) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// The Supabase SDK (~55 KB gzipped) is loaded on demand through `getSupabase`
// so no page's first paint ever waits on it. Every consumer below is already
// async; the service module itself no longer imports the SDK statically.
const loadAuthService = () => import('@/services/auth.service');

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'] as const;
const WARMUP_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, session, loading, setUser, setSession, setLoading, clearAuth, updateProfile: storeUpdateProfile } =
    useAuthStore();

  const loadUserProfile = useCallback(
    async (userId: string): Promise<AuthUser | null> => {
      try {
        const { fetchUserProfile } = await loadAuthService();
        const profile = (await fetchUserProfile(userId)) as AuthUser;
        setUser(profile);
        return profile;
      } catch {
        setUser(null);
        return null;
      }
    },
    [setUser],
  );

  /* ── Lazy SDK access ──────────────────────────────────────── */
  const clientRef = useRef<Promise<TypedSupabaseClient> | null>(null);
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);
  const mountedRef = useRef(false);

  // Loads the SDK once per mount and mirrors its auth events into the store.
  // Every auth operation goes through here, so the listener is always attached
  // by the time a session can exist.
  const ensureClient = useCallback((): Promise<TypedSupabaseClient> => {
    clientRef.current ??= getSupabase().then((supabase) => {
      if (!mountedRef.current) return supabase;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, newSession) => {
        setSession(newSession);
        if (event === 'SIGNED_IN' && newSession?.user && !useAuthStore.getState().user) {
          void loadUserProfile(newSession.user.id);
        }
        if (event === 'SIGNED_OUT') clearAuth();
      });
      unsubscribeRef.current = () => subscription.unsubscribe();
      return supabase;
    });
    return clientRef.current;
  }, [setSession, clearAuth, loadUserProfile]);

  /** The auth service, with the SDK listener guaranteed to be (getting) attached. */
  const service = useCallback(() => {
    void ensureClient().catch(() => undefined);
    return loadAuthService();
  }, [ensureClient]);

  /* ── Session bootstrap (never blocks first paint) ─────────── */
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const restoreSession = async () => {
      setLoading(true);
      const supabase = await ensureClient();
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(currentSession);
      if (currentSession?.user) {
        await loadUserProfile(currentSession.user.id);
      } else {
        // A profile persisted from a previous visit is stale without a session.
        setUser(null);
      }
      setLoading(false);
    };

    const warm = () => {
      WARMUP_EVENTS.forEach((event) => window.removeEventListener(event, warm));
      void ensureClient().catch(() => undefined);
    };

    if (hasPersistedSession() || hasAuthParamsInUrl()) {
      void restoreSession().catch(() => setLoading(false));
    } else {
      // Nothing to restore: the visitor is signed out and the SDK is not needed
      // until they submit a form. On auth pages, warm it on the first tap or
      // keystroke so the eventual sign-in/sign-up call has no download to wait for.
      setSession(null);
      setUser(null);
      setLoading(false);
      if (isAuthPath(window.location.pathname)) {
        WARMUP_EVENTS.forEach((event) => window.addEventListener(event, warm, { passive: true }));
      }
    }

    return () => {
      cancelled = true;
      mountedRef.current = false;
      WARMUP_EVENTS.forEach((event) => window.removeEventListener(event, warm));
      unsubscribeRef.current?.();
      unsubscribeRef.current = undefined;
      clientRef.current = null;
    };
  }, [ensureClient, setSession, setLoading, setUser, loadUserProfile]);

  const logout = useCallback(
    async (reason?: LogoutReason) => {
      try {
        const { logout: authLogout } = await service();
        await authLogout();
      } finally {
        clearAuth();
        navigate(reason ? `${ROUTES.LOGIN}?reason=${reason}` : ROUTES.LOGIN, { replace: true });
      }
    },
    [service, clearAuth, navigate],
  );

  /* ── Inactivity sign-out for non-remembered sessions ──────── */
  const inactivityTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!session || isRemembered()) return;
    const timeoutMs = AUTH_CONFIG.inactivityTimeoutMinutes * 60_000;

    const arm = () => {
      window.clearTimeout(inactivityTimer.current);
      inactivityTimer.current = window.setTimeout(() => void logout('inactivity'), timeoutMs);
    };
    arm();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, arm, { passive: true }));
    return () => {
      window.clearTimeout(inactivityTimer.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, arm));
    };
  }, [session, logout]);

  const destinationFor = useCallback(
    (profile: AuthUser | null): string => {
      const from = (location.state as { from?: string } | null)?.from;
      if (from && from !== ROUTES.LOGIN) return from;
      return profile ? getDashboardPathForRole(profile.role) : ROUTES.REGISTER;
    },
    [location.state],
  );

  /* ── Password sign-in ─────────────────────────────────────── */
  const login = useCallback(
    async (input: LoginInput) => {
      const { AuthError, signInWithPassword } = await service();
      if (getLockState('login').locked) throw new AuthError('rate_limited');

      setRememberMe(input.rememberMe);
      let result: Awaited<ReturnType<typeof signInWithPassword>>;
      try {
        result =
          input.method === 'phone'
            ? await signInWithPassword({ phone: input.phone, password: input.password })
            : await signInWithPassword({ email: input.email, password: input.password });
      } catch (error) {
        if (error instanceof AuthError && error.code === 'invalid_credentials') recordAttempt('login');
        throw error;
      }

      resetAttempts('login');
      setSession(result.session);
      const profile = await loadUserProfile(result.user.id);
      navigate(destinationFor(profile), { replace: true });
    },
    [service, setSession, loadUserProfile, navigate, destinationFor],
  );

  /* ── SMS code sign-in ─────────────────────────────────────── */
  const sendLoginCode = useCallback(
    async (phoneE164: string, rememberMe: boolean) => {
      const { AuthError, sendOTP } = await service();
      if (getLockState('otp-send').locked) throw new AuthError('rate_limited');
      recordAttempt('otp-send');
      setRememberMe(rememberMe);
      await sendOTP(phoneE164, { shouldCreateUser: false });
      setPendingFlow({ type: 'login', phone: phoneE164 });
      navigate(`${ROUTES.VERIFY}?phone=${encodeURIComponent(phoneE164)}`);
    },
    [service, navigate],
  );

  const resendCode = useCallback(async (phoneE164: string) => {
    const { AuthError, sendOTP, resendSignUpOTP } = await service();
    if (getLockState('otp-send').locked) throw new AuthError('rate_limited');
    recordAttempt('otp-send');
    const flow = getPendingFlow();
    if (flow?.type === 'register') await resendSignUpOTP(phoneE164);
    else await sendOTP(phoneE164, { shouldCreateUser: false });
  }, [service]);

  const verifyCode = useCallback(
    async (phoneE164: string, token: string) => {
      const auth = await service();
      if (getLockState('otp-verify').locked) throw new auth.AuthError('rate_limited');

      let result: Awaited<ReturnType<typeof auth.verifyOTP>>;
      try {
        result = await auth.verifyOTP(phoneE164, token);
      } catch (error) {
        if (error instanceof auth.AuthError && (error.code === 'otp_invalid' || error.code === 'otp_expired')) {
          recordAttempt('otp-verify');
        }
        throw error;
      }

      resetAttempts('otp-verify');
      resetAttempts('otp-send');
      setSession(result.session);
      const userId = result.session!.user.id;
      const flow = getPendingFlow();
      const flowType: AuthFlow = flow?.type ?? 'login';

      if (flowType === 'reset') {
        clearPendingFlow();
        return { redirectTo: ROUTES.RESET_PASSWORD, flow: flowType };
      }

      if (flowType === 'register') {
        const draft = loadRegisterDraft();
        if (draft?.role) {
          await auth.completeRegistration(userId, draft);
          const document = takePendingDocument();
          if (document) await auth.uploadKycDocument(userId, document);
          if ((draft.role === 'bailleur' || draft.role === 'agence') && draft.email) {
            void auth.requestEmailVerification(draft.email).catch(() => undefined);
          }
          clearRegisterDraft();
        }
      }

      clearPendingFlow();
      const profile = await loadUserProfile(userId);
      return { redirectTo: destinationFor(profile), flow: flowType };
    },
    [service, setSession, loadUserProfile, destinationFor],
  );

  /* ── Registration ─────────────────────────────────────────── */
  const startRegistration = useCallback(
    async (draft: RegisterDraft, password: string, document: File | null) => {
      const { AuthError, signUpWithPhone } = await service();
      if (!draft.role) throw new AuthError('unknown');
      if (getLockState('otp-send').locked) throw new AuthError('rate_limited');

      recordAttempt('otp-send');
      setRememberMe(true);
      const phoneE164 = toE164(draft.phone);
      await signUpWithPhone({ phone: phoneE164, password, fullName: draft.fullName.trim(), role: draft.role });

      saveRegisterDraft(draft);
      setPendingDocument(document);
      setPendingFlow({ type: 'register', phone: phoneE164, email: draft.email || undefined });
      navigate(`${ROUTES.VERIFY}?phone=${encodeURIComponent(phoneE164)}`);
    },
    [service, navigate],
  );

  /* ── Password reset ───────────────────────────────────────── */
  const requestPasswordReset = useCallback(async (input: PasswordResetInput) => {
    const { AuthError, sendOTP, resetPasswordByEmail } = await service();
    if (getLockState('password-reset').locked) throw new AuthError('rate_limited');
    recordAttempt('password-reset');

    if (input.method === 'phone') {
      await sendOTP(input.phone, { shouldCreateUser: false });
      setPendingFlow({ type: 'reset', phone: input.phone });
    } else {
      await resetPasswordByEmail(input.email);
    }
  }, [service]);

  const updatePassword = useCallback(async (password: string) => {
    const { updatePassword: serviceUpdatePassword } = await service();
    await serviceUpdatePassword(password);
  }, [service]);

  const updateProfile = useCallback(
    async (data: UserProfileFormData) => {
      if (!user) throw new Error('Non authentifié');
      const { updateProfile: authUpdateProfile } = await service();
      const updated = await authUpdateProfile(user.id, data);
      storeUpdateProfile(updated);
    },
    [service, user, storeUpdateProfile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      login,
      sendLoginCode,
      resendCode,
      verifyCode,
      startRegistration,
      requestPasswordReset,
      updatePassword,
      logout,
      updateProfile,
    }),
    [user, session, loading, login, sendLoginCode, resendCode, verifyCode, startRegistration, requestPasswordReset, updatePassword, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
}
