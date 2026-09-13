import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';

interface RoleGuardProps {
  roles: UserRole | UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({ roles, children, fallback = null }: RoleGuardProps) {
  const { hasAnyRole } = useAuth();
  const roleList = Array.isArray(roles) ? roles : [roles];

  if (!hasAnyRole(roleList)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
