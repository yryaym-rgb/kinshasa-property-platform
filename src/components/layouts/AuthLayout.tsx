import { Outlet, Link } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { APP_CONFIG } from '@/config/app.config';
import { useUIStore } from '@/stores/ui.store';

export function AuthLayout() {
  const { language, setLanguage } = useUIStore();

  return (
    <div className="flex min-h-screen">
      {/* Left panel - Kinshasa skyline */}
      <div className="relative hidden w-1/2 lg:block">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(30, 64, 175, 0.7), rgba(30, 58, 138, 0.9)), url('https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1200&q=80')`,
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-kinshasa-gold)]">
                <span className="font-heading text-lg font-bold text-[var(--color-kinshasa-blue-dark)]">VK</span>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-100">République Démocratique du Congo</p>
                <p className="font-heading text-xl font-bold">Ville de Kinshasa</p>
              </div>
            </div>
          </div>
          <div>
            <h2 className="font-heading text-3xl font-bold leading-tight">
              {APP_CONFIG.name}
            </h2>
            <p className="mt-3 text-lg text-blue-100">{APP_CONFIG.tagline}</p>
          </div>
          <p className="text-sm text-blue-200">
            © {new Date().getFullYear()} Ville de Kinshasa — Tous droits réservés
          </p>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex w-full flex-col lg:w-1/2">
        <div className="flex items-center justify-between p-4 lg:p-6">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-kinshasa-blue)]">
              <span className="text-sm font-bold text-white">VK</span>
            </div>
            <span className="font-heading font-bold text-[var(--color-kinshasa-blue)]">{APP_CONFIG.name}</span>
          </div>
          <button
            type="button"
            onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
            className="ml-auto flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            <Globe className="h-4 w-4" />
            {language === 'fr' ? 'FR' : 'EN'}
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-8">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>

        <footer className="border-t border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted-foreground)]">
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="#" className="hover:text-[var(--color-primary)]">Conditions d&apos;utilisation</Link>
            <Link to="#" className="hover:text-[var(--color-primary)]">Politique de confidentialité</Link>
            <Link to="#" className="hover:text-[var(--color-primary)]">Aide</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
