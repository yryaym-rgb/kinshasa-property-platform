import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getNavItems } from './Sidebar';
import type { UserRole } from '@/types';

interface BottomNavProps {
  role: UserRole;
}

export function BottomNav({ role }: BottomNavProps) {
  const location = useLocation();
  const items = getNavItems(role).slice(0, 5);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-card)] md:hidden"
      aria-label="Navigation mobile"
    >
      <ul className="flex items-center justify-around">
        {items.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                to={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                  isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]',
                )}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--color-destructive)] text-[8px] text-white">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className="truncate max-w-[64px]">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
