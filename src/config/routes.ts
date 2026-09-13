import type { UserRole } from '@/types/app.types';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY: '/verify',
  FORGOT_PASSWORD: '/forgot-password',
  UNAUTHORIZED: '/unauthorized',

  BAILLEUR: {
    ROOT: '/bailleur',
    DASHBOARD: '/bailleur/tableau-de-bord',
    PROPERTIES: '/bailleur/biens',
    PROPERTY_NEW: '/bailleur/biens/nouveau',
    PROPERTY_EDIT: '/bailleur/biens/:id/modifier',
    PROPERTY_DETAIL: '/bailleur/biens/:id',
    TENANTS: '/bailleur/locataires',
    TENANT_DETAIL: '/bailleur/locataires/:id',
    CONTRACTS: '/bailleur/contrats',
    PAYMENTS: '/bailleur/paiements',
    RECEIPTS: '/bailleur/recus',
    TAXES: '/bailleur/fiscalite',
    REPORTS: '/bailleur/rapports',
    PROFILE: '/bailleur/profil',
  },

  LOCATAIRE: {
    ROOT: '/locataire',
    HOME: '/locataire/accueil',
    CONTRACTS: '/locataire/contrats',
    PAYMENTS: '/locataire/paiements',
    RECEIPTS: '/locataire/recus',
    NOTIFICATIONS: '/locataire/notifications',
    PROFILE: '/locataire/profil',
  },

  ADMIN: {
    ROOT: '/admin',
    DASHBOARD: '/admin/tableau-de-bord',
    TAXPAYERS: '/admin/contribuables',
    DECLARATIONS: '/admin/declarations',
    REVENUE: '/admin/recettes',
    CONTROLS: '/admin/controles',
    REPORTS: '/admin/rapports',
    SETTINGS: '/admin/parametres',
  },

  FISCAL: {
    ROOT: '/fiscal',
    DASHBOARD: '/fiscal/tableau-de-bord',
    DECLARATIONS: '/fiscal/declarations',
    REVENUE: '/fiscal/recettes',
    RECONCILIATION: '/fiscal/rapprochements',
    CONTROLS: '/fiscal/controles',
  },
} as const;

export interface RouteGuardConfig {
  path: string;
  roles?: UserRole[];
  requireAuth: boolean;
}

export const PUBLIC_ROUTES: RouteGuardConfig[] = [
  { path: ROUTES.HOME, requireAuth: false },
  { path: ROUTES.LOGIN, requireAuth: false },
  { path: ROUTES.REGISTER, requireAuth: false },
  { path: ROUTES.VERIFY, requireAuth: false },
  { path: ROUTES.FORGOT_PASSWORD, requireAuth: false },
];

export const PROTECTED_ROUTES: RouteGuardConfig[] = [
  { path: ROUTES.BAILLEUR.ROOT, roles: ['bailleur', 'gestionnaire'], requireAuth: true },
  { path: ROUTES.LOCATAIRE.ROOT, roles: ['locataire'], requireAuth: true },
  { path: ROUTES.ADMIN.ROOT, roles: ['admin'], requireAuth: true },
  { path: ROUTES.FISCAL.ROOT, roles: ['agent_fiscal'], requireAuth: true },
];

/** Returns the default dashboard path for a given role */
export function getDashboardPathForRole(role: UserRole): string {
  switch (role) {
    case 'bailleur':
    case 'gestionnaire':
      return ROUTES.BAILLEUR.DASHBOARD;
    case 'locataire':
      return ROUTES.LOCATAIRE.HOME;
    case 'admin':
      return ROUTES.ADMIN.DASHBOARD;
    case 'agent_fiscal':
      return ROUTES.FISCAL.DASHBOARD;
    case 'agence':
      return ROUTES.BAILLEUR.DASHBOARD;
    default:
      return ROUTES.HOME;
  }
}

/** Check if a route requires authentication */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route.path || pathname.startsWith(`${route.path}/`));
}

/** Get required roles for a protected route prefix */
export function getRequiredRoles(pathname: string): UserRole[] | undefined {
  const match = PROTECTED_ROUTES.find((route) => pathname.startsWith(route.path));
  return match?.roles;
}
