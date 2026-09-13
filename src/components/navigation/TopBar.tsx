import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  LogOut,
  User,
  Globe,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/ui.store';
import { useNotificationStore } from '@/stores/notification.store';
import { Button } from '@/components/ui/Button';
import { getInitials } from '@/lib/utils';
import { APP_CONFIG } from '@/config/app.config';

export function TopBar() {
  const { user, logout } = useAuth();
  const { toggleSidebar, language, setLanguage } = useUIStore();
  const { unreadCount } = useNotificationStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-card)] px-4">
      <Button
        variant="ghost"
        size="sm"
        className="md:hidden"
        onClick={toggleSidebar}
        aria-label="Menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Link to="/" className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-kinshasa-blue)]">
          <span className="text-xs font-bold text-white">VK</span>
        </div>
        <span className="hidden font-heading text-sm font-bold text-[var(--color-kinshasa-blue)] sm:inline">
          {APP_CONFIG.name}
        </span>
      </Link>

      <div className="mx-auto hidden max-w-md flex-1 md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <input
            type="search"
            placeholder="Rechercher..."
            className="h-9 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            aria-label="Recherche globale"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
          className="hidden rounded-lg p-2 hover:bg-[var(--color-muted)] sm:flex"
          aria-label="Changer de langue"
        >
          <Globe className="h-5 w-5" />
          <span className="ml-1 text-xs uppercase">{language}</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg p-2 hover:bg-[var(--color-muted)]"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-destructive)] text-[10px] text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-lg">
              <p className="text-sm font-medium">Notifications</p>
              <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
                Aucune notification récente
              </p>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-[var(--color-muted)]"
            aria-expanded={showUserMenu}
            aria-haspopup="true"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-kinshasa-gold)] text-sm font-medium text-white">
              {user ? getInitials(user.full_name) : '?'}
            </div>
            <span className="hidden text-sm font-medium sm:inline">{user?.full_name}</span>
            <ChevronDown className="hidden h-4 w-4 sm:inline" />
          </button>
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--color-muted)]"
              >
                <User className="h-4 w-4" />
                Mon profil
              </button>
              <hr className="my-1 border-[var(--color-border)]" />
              <button
                type="button"
                onClick={() => void logout()}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-destructive)] hover:bg-[var(--color-muted)]"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
