import { useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { useActiveSection } from '@/hooks/useActiveSection';
import { KinshasaLogo, KinshasaSeal } from './primitives/KinshasaLogo';
import { FlagBar } from './primitives/FlagBar';
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, CloseIcon, DRCFlag, MenuIcon } from './icons';

export const NAV_LINKS = [
  { label: 'Accueil', id: 'accueil' },
  { label: 'Services', id: 'services' },
  { label: 'Fonctionnalités', id: 'fonctionnalites' },
  { label: 'À propos', id: 'a-propos' },
  { label: 'Actualités', id: 'actualites' },
  { label: 'Contact', id: 'contact' },
] as const;

const SECTION_IDS = NAV_LINKS.map((l) => l.id);

const LANGUAGES = [
  { code: 'fr', short: 'FR', label: 'Français' },
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'ln', short: 'LN', label: 'Lingala' },
  { code: 'sw', short: 'SW', label: 'Swahili' },
] as const;

type LanguageCode = (typeof LANGUAGES)[number]['code'];

function scrollToSection(id: string, reduce: boolean | null) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  window.history.replaceState(null, '', `#${id}`);
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>('fr');
  const reduce = useReducedMotion();
  const active = useActiveSection(SECTION_IDS);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 100);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  const handleAnchor = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMobileOpen(false);
    scrollToSection(id, reduce);
  };

  const currentLanguage = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <>
      <a href="#main-content" className="lp-skip">
        Aller au contenu principal
      </a>

      <header className={cn('lp-nav', scrolled && 'lp-nav--scrolled')}>
        <div className="lp-container flex h-[80px] items-center justify-between gap-6">
          {/* Left — identity */}
          <Link to={ROUTES.HOME} className="flex shrink-0 items-center rounded-lg" aria-label="eLoyer Kinshasa — Accueil">
            <KinshasaLogo priority className="hidden sm:flex" />
            <span className="flex items-center gap-3 sm:hidden">
              <KinshasaSeal size={40} priority />
              <span className="font-heading text-[18px] font-bold tracking-[-0.02em]">
                <span className="text-drc-blue">eLoyer</span> <span className="text-drc-navy">Kinshasa</span>
              </span>
            </span>
          </Link>

          {/* Center — primary navigation */}
          <nav aria-label="Navigation principale" className="hidden lg:block">
            <LayoutGroup id="lp-nav">
              <ul className="flex items-center gap-8">
                {NAV_LINKS.map((link) => {
                  const isActive = active === link.id;
                  return (
                    <li key={link.id} className="relative">
                      <a
                        href={`#${link.id}`}
                        onClick={(e) => handleAnchor(e, link.id)}
                        className="lp-nav-link block"
                        aria-current={isActive ? 'true' : undefined}
                      >
                        {link.label}
                      </a>
                      {isActive ? (
                        <motion.span
                          layoutId="lp-nav-indicator"
                          className="lp-nav-indicator left-0 right-0"
                          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 38 }}
                          aria-hidden="true"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </LayoutGroup>
          </nav>

          {/* Right — utilities */}
          <div className="hidden items-center gap-5 lg:flex">
            <LanguageMenu current={currentLanguage} onChange={setLanguage} />
            <span aria-hidden="true" className="h-6 w-px bg-drc-gray-200" />
            <Link
              to={ROUTES.LOGIN}
              className="rounded-md text-[15px] font-medium text-drc-charcoal transition-colors hover:text-drc-blue"
            >
              Se connecter
            </Link>
            <Link to={ROUTES.REGISTER} className="lp-btn lp-btn--blue">
              Créer un compte
            </Link>
          </div>

          {/* Mobile trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-drc-navy transition-colors hover:bg-drc-gray-100 lg:hidden"
            aria-label="Ouvrir le menu"
            aria-expanded={mobileOpen}
            aria-controls="lp-mobile-menu"
          >
            <MenuIcon size={24} />
          </button>
        </div>
        <FlagBar className="!h-[3px]" />
      </header>

      <AnimatePresence>
        {mobileOpen ? (
          <MobileMenu
            key="mobile-menu"
            onClose={() => setMobileOpen(false)}
            onAnchor={handleAnchor}
            active={active}
            language={language}
            onLanguage={setLanguage}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

/* ── Language selector ─────────────────────────────────────────── */

function LanguageMenu({
  current,
  onChange,
}: {
  current: (typeof LANGUAGES)[number];
  onChange: (code: LanguageCode) => void;
}) {
  return (
    <Menu as="div" className="relative">
      <MenuButton
        className="group flex items-center gap-2 rounded-md px-1 py-1 text-[14px] font-semibold text-drc-charcoal transition-colors hover:text-drc-blue data-[open]:text-drc-blue"
        aria-label={`Langue : ${current.label}`}
      >
        <DRCFlag width={20} title="Langue" />
        <span>{current.short}</span>
        <ChevronDownIcon size={14} className="transition-transform duration-300 group-data-[open]:rotate-180" />
      </MenuButton>
      <MenuItems
        transition
        className="absolute right-0 top-full z-50 mt-3 w-48 origin-top-right overflow-hidden rounded-xl border border-drc-gray-200 bg-white p-1.5 shadow-[0_20px_50px_rgba(10,22,40,0.14)] outline-none transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        {LANGUAGES.map((lang) => (
          <MenuItem key={lang.code}>
            <button
              type="button"
              onClick={() => onChange(lang.code)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[14px] text-drc-charcoal data-[focus]:bg-drc-gray-100 data-[focus]:text-drc-blue"
            >
              <span className="flex items-center gap-3">
                <span className="lp-mono text-[11px] font-semibold text-drc-gray-400">{lang.short}</span>
                {lang.label}
              </span>
              {lang.code === current.code ? <CheckIcon size={16} className="text-drc-blue" /> : null}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

/* ── Mobile menu ───────────────────────────────────────────────── */

function MobileMenu({
  onClose,
  onAnchor,
  active,
  language,
  onLanguage,
}: {
  onClose: () => void;
  onAnchor: (e: MouseEvent<HTMLAnchorElement>, id: string) => void;
  active: string;
  language: LanguageCode;
  onLanguage: (code: LanguageCode) => void;
}) {
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 320, damping: 34 };

  return (
    <motion.div
      id="lp-mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-[120] lg:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.25 }}
    >
      <button
        type="button"
        aria-label="Fermer le menu"
        onClick={onClose}
        className="absolute inset-0 bg-drc-navy/60 backdrop-blur-sm"
      />
      <motion.div
        className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col bg-white shadow-2xl"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={spring}
      >
        <FlagBar />
        <div className="flex h-[76px] items-center justify-between px-6">
          <KinshasaLogo />
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-drc-navy transition-colors hover:bg-drc-gray-100"
            aria-label="Fermer le menu"
            autoFocus
          >
            <CloseIcon size={22} />
          </button>
        </div>

        <nav aria-label="Navigation mobile" className="flex-1 overflow-y-auto px-6 pt-4">
          <ul className="flex flex-col">
            {NAV_LINKS.map((link, i) => (
              <motion.li
                key={link.id}
                initial={reduce ? false : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <a
                  href={`#${link.id}`}
                  onClick={(e) => onAnchor(e, link.id)}
                  aria-current={active === link.id ? 'true' : undefined}
                  className={cn(
                    'flex items-center justify-between border-b border-drc-gray-200 py-4 font-heading text-[22px] font-bold text-drc-navy transition-colors hover:text-drc-blue',
                    active === link.id && 'text-drc-blue',
                  )}
                >
                  {link.label}
                  <span className="lp-mono text-[11px] font-medium text-drc-gray-400">0{i + 1}</span>
                </a>
              </motion.li>
            ))}
          </ul>

          <div className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-[2px] text-drc-gray-400">Langue</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => onLanguage(lang.code)}
                  aria-pressed={language === lang.code}
                  className={cn(
                    'rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors',
                    language === lang.code
                      ? 'border-drc-blue bg-drc-blue text-white'
                      : 'border-drc-gray-200 text-drc-gray-600 hover:border-drc-blue hover:text-drc-blue',
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="flex flex-col gap-3 border-t border-drc-gray-200 p-6">
          <Link to={ROUTES.REGISTER} className="lp-btn lp-btn--blue !rounded-xl !py-4 !text-[15px]">
            Créer un compte
            <ArrowRightIcon size={18} className="lp-btn__arrow" />
          </Link>
          <Link
            to={ROUTES.LOGIN}
            className="lp-btn !rounded-xl border border-drc-gray-200 !py-4 !text-[15px] text-drc-navy hover:border-drc-navy"
          >
            Se connecter
          </Link>
          <p className="mt-2 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[1.5px] text-drc-gray-400">
            <DRCFlag width={18} /> Ville de Kinshasa
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
