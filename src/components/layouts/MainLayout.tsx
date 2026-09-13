import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/navigation/Sidebar';
import { TopBar } from '@/components/navigation/TopBar';
import { BottomNav } from '@/components/navigation/BottomNav';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/ui.store';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

interface MainLayoutProps {
  role?: UserRole;
}

export function MainLayout({ role: roleProp }: MainLayoutProps) {
  const { user } = useAuth();
  const { sidebarCollapsed } = useUIStore();
  const role = roleProp ?? user?.role ?? 'locataire';

  return (
    <div className="flex min-h-screen bg-[var(--color-background)]">
      <Sidebar role={role} collapsed={sidebarCollapsed} />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className={cn('flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6')}>
          <Breadcrumbs />
          <Outlet />
        </main>
        <BottomNav role={role} />
      </div>
    </div>
  );
}
