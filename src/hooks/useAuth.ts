import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { ROUTES, getDashboardPathForRole } from '@/config/routes';
import type { UserRole } from '@/types';

export function useAuth() {
  const auth = useAuthContext();
  const navigate = useNavigate();

  const hasRole = useCallback(
    (role: UserRole) => auth.user?.role === role,
    [auth.user?.role],
  );

  const hasAnyRole = useCallback(
    (roles: UserRole[]) => (auth.user ? roles.includes(auth.user.role) : false),
    [auth.user],
  );

  const requireRole = useCallback(
    (roles: UserRole | UserRole[]) => {
      const roleList = Array.isArray(roles) ? roles : [roles];
      if (!auth.user) {
        navigate(ROUTES.LOGIN);
        return false;
      }
      if (!roleList.includes(auth.user.role)) {
        navigate(ROUTES.UNAUTHORIZED);
        return false;
      }
      return true;
    },
    [auth.user, navigate],
  );

  const redirectToDashboard = useCallback(() => {
    if (auth.user) {
      navigate(getDashboardPathForRole(auth.user.role));
    }
  }, [auth.user, navigate]);

  return {
    user: auth.user,
    session: auth.session,
    loading: auth.loading,
    error: auth.error,
    role: auth.user?.role ?? null,
    isAuthenticated: !!auth.user,
    login: auth.login,
    loginWithOTP: auth.loginWithOTP,
    verifyOTPCode: auth.verifyOTPCode,
    register: auth.register,
    logout: auth.logout,
    updateProfile: auth.updateProfile,
    hasRole,
    hasAnyRole,
    requireRole,
    redirectToDashboard,
  };
}
