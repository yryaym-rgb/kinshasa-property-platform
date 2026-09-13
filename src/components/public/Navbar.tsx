import { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Menu, X, ChevronDown } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import logoDrc from '@/assets/landing/logo-drc.svg';
import logoEloyer from '@/assets/landing/logo-eloyer.svg';

const NAV_LINKS = [
  { label: 'Accueil', href: '#accueil', active: true },
  { label: 'À propos', href: '#a-propos' },
  { label: 'Services', href: '#services' },
  { label: 'Actualités', href: '#actualites' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' },
];

const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ln', label: 'Lingala', flag: '🇨🇩' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(LANGUAGES[0]!);

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <a href="#main-content" className="skip-to-content">
        Aller au contenu principal
      </a>

      <nav
        className="mx-auto flex h-[88px] max-w-[1280px] items-center justify-between px-6 md:px-10 lg:px-20"
        aria-label="Navigation principale"
      >
        {/* Logo */}
        <Link to={ROUTES.HOME} className="flex shrink-0 items-center gap-3">
          <img src={logoDrc} alt="Armoiries de la RDC" className="h-14 w-14" width={56} height={56} />
          <img src={logoEloyer} alt="Logo eLoyer" className="h-14 w-14" width={56} height={56} />
          <div className="hidden sm:block">
            <p className="font-heading text-2xl font-bold leading-tight">
              <span className="text-[var(--brand-gold)]">eLoyer</span>{' '}
              <span className="text-[var(--navy-900)]">Kinshasa</span>
            </p>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              RÉPUBLIQUE DÉMOCRATIQUE DU CONGO
            </p>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              VILLE DE KINSHASA
            </p>
          </div>
        </Link>

        {/* Desktop nav links */}
        <ul className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <button
                type="button"
                onClick={() => handleNavClick(link.href)}
                className={cn(
                  'nav-link-underline text-[15px] font-medium text-[var(--navy-700)] transition-colors hover:text-[var(--brand-gold)]',
                  link.active && 'active text-[var(--navy-900)]',
                )}
              >
                {link.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Right actions */}
        <div className="hidden items-center gap-4 lg:flex">
          {/* Language dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-[var(--navy-700)] hover:bg-gray-50"
              aria-expanded={langOpen}
              aria-haspopup="listbox"
              aria-label="Choisir la langue"
            >
              <span aria-hidden="true">{currentLang.flag}</span>
              <span>{currentLang.label}</span>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
            {langOpen && (
              <ul
                role="listbox"
                className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg"
              >
                {LANGUAGES.map((lang) => (
                  <li key={lang.code} role="option" aria-selected={lang.code === currentLang.code}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        setCurrentLang(lang);
                        setLangOpen(false);
                      }}
                    >
                      <span aria-hidden="true">{lang.flag}</span>
                      {lang.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            to={ROUTES.LOGIN}
            className="flex items-center gap-2 rounded-lg border-2 border-[var(--navy-900)] px-4 py-2 text-sm font-medium text-[var(--navy-900)] transition-colors hover:bg-gray-50"
          >
            <User className="h-4 w-4" aria-hidden="true" />
            Se connecter
          </Link>

          <Link
            to={ROUTES.REGISTER}
            className="landing-btn-gold rounded-lg bg-[var(--brand-gold)] px-5 py-2.5 text-sm font-bold text-[var(--navy-900)]"
          >
            Créer un compte
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="rounded-lg p-2 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-[var(--border)] bg-white px-6 py-4 lg:hidden">
          <ul className="space-y-3">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <button
                  type="button"
                  onClick={() => handleNavClick(link.href)}
                  className="block w-full text-left text-[15px] font-medium text-[var(--navy-700)]"
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4">
            <Link
              to={ROUTES.LOGIN}
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-[var(--navy-900)] px-4 py-2.5 text-sm font-medium"
            >
              <User className="h-4 w-4" aria-hidden="true" />
              Se connecter
            </Link>
            <Link
              to={ROUTES.REGISTER}
              className="rounded-lg bg-[var(--brand-gold)] px-4 py-2.5 text-center text-sm font-bold text-[var(--navy-900)]"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
