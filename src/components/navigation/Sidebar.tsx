import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  CreditCard,
  Receipt,
  Calculator,
  BarChart3,
  User,
  Home,
  Bell,
  Settings,
  Shield,
  FileCheck,
  Wallet,
  GitCompare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/config/routes';
import type { UserRole } from '@/types';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  bailleur: [
    { label: 'Tableau de bord', href: ROUTES.BAILLEUR.DASHBOARD, icon: LayoutDashboard },
    { label: 'Mes biens', href: ROUTES.BAILLEUR.PROPERTIES, icon: Building2 },
    { label: 'Locataires', href: ROUTES.BAILLEUR.TENANTS, icon: Users },
    { label: 'Contrats', href: ROUTES.BAILLEUR.CONTRACTS, icon: FileText },
    { label: 'Paiements', href: ROUTES.BAILLEUR.PAYMENTS, icon: CreditCard },
    { label: 'Reçus', href: ROUTES.BAILLEUR.RECEIPTS, icon: Receipt },
    { label: 'Fiscalité', href: ROUTES.BAILLEUR.TAXES, icon: Calculator },
    { label: 'Rapports', href: ROUTES.BAILLEUR.REPORTS, icon: BarChart3 },
    { label: 'Profil', href: ROUTES.BAILLEUR.PROFILE, icon: User },
  ],
  gestionnaire: [
    { label: 'Tableau de bord', href: ROUTES.BAILLEUR.DASHBOARD, icon: LayoutDashboard },
    { label: 'Mes biens', href: ROUTES.BAILLEUR.PROPERTIES, icon: Building2 },
    { label: 'Contrats', href: ROUTES.BAILLEUR.CONTRACTS, icon: FileText },
    { label: 'Paiements', href: ROUTES.BAILLEUR.PAYMENTS, icon: CreditCard },
    { label: 'Profil', href: ROUTES.BAILLEUR.PROFILE, icon: User },
  ],
  locataire: [
    { label: 'Accueil', href: ROUTES.LOCATAIRE.HOME, icon: Home },
    { label: 'Paiements', href: ROUTES.LOCATAIRE.PAYMENTS, icon: CreditCard },
    { label: 'Reçus', href: ROUTES.LOCATAIRE.RECEIPTS, icon: Receipt },
    { label: 'Notifications', href: ROUTES.LOCATAIRE.NOTIFICATIONS, icon: Bell },
    { label: 'Profil', href: ROUTES.LOCATAIRE.PROFILE, icon: User },
  ],
  admin: [
    { label: 'Tableau de bord', href: ROUTES.ADMIN.DASHBOARD, icon: LayoutDashboard },
    { label: 'Contribuables', href: ROUTES.ADMIN.TAXPAYERS, icon: Users },
    { label: 'Déclarations', href: ROUTES.ADMIN.DECLARATIONS, icon: FileCheck },
    { label: 'Recettes', href: ROUTES.ADMIN.REVENUE, icon: Wallet },
    { label: 'Contrôles', href: ROUTES.ADMIN.CONTROLS, icon: Shield },
    { label: 'Rapports', href: ROUTES.ADMIN.REPORTS, icon: BarChart3 },
    { label: 'Paramètres', href: ROUTES.ADMIN.SETTINGS, icon: Settings },
  ],
  agent_fiscal: [
    { label: 'Tableau de bord', href: ROUTES.FISCAL.DASHBOARD, icon: LayoutDashboard },
    { label: 'Déclarations', href: ROUTES.FISCAL.DECLARATIONS, icon: FileCheck },
    { label: 'Recettes', href: ROUTES.FISCAL.REVENUE, icon: Wallet },
    { label: 'Rapprochements', href: ROUTES.FISCAL.RECONCILIATION, icon: GitCompare },
    { label: 'Contrôles', href: ROUTES.FISCAL.CONTROLS, icon: Shield },
  ],
  agence: [
    { label: 'Tableau de bord', href: ROUTES.BAILLEUR.DASHBOARD, icon: LayoutDashboard },
    { label: 'Mes biens', href: ROUTES.BAILLEUR.PROPERTIES, icon: Building2 },
    { label: 'Contrats', href: ROUTES.BAILLEUR.CONTRACTS, icon: FileText },
    { label: 'Profil', href: ROUTES.BAILLEUR.PROFILE, icon: User },
  ],
};

interface SidebarProps {
  role: UserRole;
  collapsed?: boolean;
}

export function Sidebar({ role, collapsed }: SidebarProps) {
  const location = useLocation();
  const items = NAV_ITEMS[role] ?? [];

  return (
    <aside
      className={cn(
        'hidden flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] md:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className={cn('flex h-16 items-center border-b border-[var(--color-border)] px-4', collapsed && 'justify-center')}>
        {!collapsed && (
          <span className="font-heading text-lg font-bold text-[var(--color-kinshasa-blue)]">
            eLoyer
          </span>
        )}
        {collapsed && (
          <span className="font-heading text-sm font-bold text-[var(--color-kinshasa-blue)]">eL</span>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Navigation principale">
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[var(--color-accent)] text-[var(--color-primary)]'
                      : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]',
                    collapsed && 'justify-center px-2',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto rounded-full bg-[var(--color-destructive)] px-2 py-0.5 text-xs text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export function getNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS[role] ?? [];
}
