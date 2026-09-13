import { MainLayout } from './MainLayout';
import type { UserRole } from '@/types';

interface DashboardLayoutProps {
  role: UserRole;
}

/** Role-specific dashboard layout wrapper */
export function DashboardLayout({ role }: DashboardLayoutProps) {
  return <MainLayout role={role} />;
}

export function BailleurLayout() {
  return <DashboardLayout role="bailleur" />;
}

export function LocataireLayout() {
  return <DashboardLayout role="locataire" />;
}

export function AdminLayout() {
  return <DashboardLayout role="admin" />;
}

export function FiscalLayout() {
  return <DashboardLayout role="agent_fiscal" />;
}
