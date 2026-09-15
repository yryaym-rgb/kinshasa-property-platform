import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { ROUTES, getDashboardPathForRole } from '@/config/routes';
import type { AuthUser, LoginFormData, RegisterFormData, UserProfileFormData } from '@/types';

interface AuthContextValue {
  user: AuthUser | null;
  session: ReturnType<typeof useAuthStore.getState>['session'];
  loading: boolean;
  error: string | null;
  login: (data: LoginFormData) => Promise<void>;
  loginWithOTP: (phone: string) => Promise<void>;
  verifyOTPCode: (phone: string, token: string) => Promise<void>;
  register: (data: RegisterFormData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: UserProfileFormData) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// The Supabase SDK (~55 KB gzipped) is loaded on demand so the public landing
// page's first paint never waits on it. Every consumer below is already async.
const loadSupabase = () => import('@/config/supabase').then((m) => m.supabase);
const loadAuthService = () => import('@/services/auth.service');

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, session, loading, setUser, setSession, setLoading, clearAuth, updateProfile: storeUpdateProfile } = useAuthStore();
  const error = null;

  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const { fetchUserProfile } = await loadAuthService();
      const profile = await fetchUserProfile(userId);
      setUser(profile as AuthUser);
    } catch {
      setUser(null);
    }
  }, [setUser]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      setLoading(true);
      const supabase = await loadSupabase();
      if (cancelled) return;

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        setSession(newSession);
        if (event === 'SIGNED_IN' && newSession?.user) {
          await loadUserProfile(newSession.user.id);
        }
        if (event === 'SIGNED_OUT') {
          clearAuth();
        }
      });
      unsubscribe = () => subscription.unsubscribe();

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(currentSession);
      if (currentSession?.user) {
        await loadUserProfile(currentSession.user.id);
      }
      setLoading(false);
    };

    void initAuth();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [setSession, setLoading, loadUserProfile, clearAuth]);

  const login = useCallback(async (data: LoginFormData) => {
    setLoading(true);
    try {
      const { signInWithPassword, sendOTP, fetchUserProfile } = await loadAuthService();
      if (data.password) {
        const result = await signInWithPassword(data.phone, data.password);
        if (result.session) {
          setSession(result.session);
          await loadUserProfile(result.session.user.id);
          const profile = await fetchUserProfile(result.session.user.id);
          navigate(getDashboardPathForRole(profile.role));
        }
      } else {
        await sendOTP(data.phone);
        navigate(`${ROUTES.VERIFY}?phone=${encodeURIComponent(data.phone)}`);
      }
    } finally {
      setLoading(false);
    }
  }, [setLoading, setSession, loadUserProfile, navigate]);

  const loginWithOTP = useCallback(async (phone: string) => {
    const { sendOTP } = await loadAuthService();
    await sendOTP(phone);
    navigate(`${ROUTES.VERIFY}?phone=${encodeURIComponent(phone)}`);
  }, [navigate]);

  const verifyOTPCode = useCallback(async (phone: string, token: string) => {
    setLoading(true);
    try {
      const { verifyOTP, fetchUserProfile } = await loadAuthService();
      const result = await verifyOTP(phone, token);
      if (result.session) {
        setSession(result.session);
        await loadUserProfile(result.session.user.id);
        const profile = await fetchUserProfile(result.session.user.id);
        navigate(getDashboardPathForRole(profile.role));
      }
    } finally {
      setLoading(false);
    }
  }, [setLoading, setSession, loadUserProfile, navigate]);

  const register = useCallback(async (data: RegisterFormData) => {
    const [supabase, { registerUser }] = await Promise.all([loadSupabase(), loadAuthService()]);
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.user) throw new Error('Session requise pour l\'inscription');
    await registerUser({ ...data, id: currentSession.user.id });
    await loadUserProfile(currentSession.user.id);
    navigate(getDashboardPathForRole(data.role));
  }, [loadUserProfile, navigate]);

  const logout = useCallback(async () => {
    const { logout: authLogout } = await loadAuthService();
    await authLogout();
    clearAuth();
    navigate(ROUTES.LOGIN);
  }, [clearAuth, navigate]);

  const updateProfile = useCallback(async (data: UserProfileFormData) => {
    if (!user) throw new Error('Non authentifié');
    const { updateProfile: authUpdateProfile } = await loadAuthService();
    const updated = await authUpdateProfile(user.id, data);
    storeUpdateProfile(updated);
  }, [user, storeUpdateProfile]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    loading,
    error,
    login,
    loginWithOTP,
    verifyOTPCode,
    register,
    logout,
    updateProfile,
    clearError: () => {},
  }), [user, session, loading, error, login, loginWithOTP, verifyOTPCode, register, logout, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
}
