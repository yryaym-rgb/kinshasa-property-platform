import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import logoEloyer from '@/assets/landing/logo-eloyer.svg';
import citySilhouette from '@/assets/landing/city-silhouette.svg';

const QUICK_LINKS = [
  { label: 'À propos', href: '#a-propos' },
  { label: 'Services', href: '#services' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' },
];

const LEGAL_LINKS = [
  { label: 'Mentions légales', href: '#' },
  { label: 'Politique de confidentialité', href: '#' },
  { label: 'CGU', href: '#' },
];

const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ln', label: 'Lingala', flag: '🇨🇩' },
];

function DrcFlag() {
  return (
    <svg
      viewBox="0 0 60 40"
      className="h-8 w-12 rounded-sm"
      role="img"
      aria-label="Drapeau de la RDC"
    >
      <rect width="60" height="40" fill="#007fff" />
      <polygon points="0,0 30,20 0,40" fill="#f7d618" />
      <polygon points="0,0 12,0 30,20 12,40 0,40" fill="#ce1021" />
      <polygon points="8,16 10,22 16,22 11,26 13,32 8,28 3,32 5,26 0,22 6,22" fill="#f7d618" />
    </svg>
  );
}

export function Footer() {
  const [langOpen, setLangOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(LANGUAGES[0]!);

  const handleLinkClick = (href: string) => {
    if (href.startsWith('#')) {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-[var(--navy-900)] text-white" aria-label="Pied de page">
      <div className="mx-auto max-w-[1280px] px-6 py-12 md:px-10 lg:px-20 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Column 1 - Logo */}
          <div>
            <div className="flex items-center gap-3">
              <img src={logoEloyer} alt="Logo eLoyer" className="h-12 w-12" width={48} height={48} />
              <div>
                <p className="font-heading text-lg font-bold">
                  <span className="text-[var(--brand-gold)]">eLoyer</span> Kinshasa
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-[#94a3b8]">Ensemble pour une ville plus forte</p>
          </div>

          {/* Column 2 - Ville de Kinshasa */}
          <div>
            <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide">
              Ville de Kinshasa
            </h3>
            <img
              src={citySilhouette}
              alt=""
              className="h-10 w-full max-w-[200px] opacity-60"
              aria-hidden="true"
            />
          </div>

          {/* Column 3 - Quick links */}
          <div>
            <h3 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wide">
              Liens rapides
            </h3>
            <ul className="space-y-2">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <button
                    type="button"
                    onClick={() => handleLinkClick(link.href)}
                    className="text-sm text-[#94a3b8] transition-colors hover:text-[var(--brand-gold)]"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 - Tagline + flag */}
          <div>
            <p className="text-sm leading-relaxed text-[#94a3b8]">
              Digitaliser la location aujourd&apos;hui, financer le développement de demain.
            </p>
            <div className="mt-4">
              <DrcFlag />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#334155] pt-8 md:flex-row">
          <p className="text-sm text-[#94a3b8]">
            © 2025 eLoyer Kinshasa. Tous droits réservés.
          </p>

          <ul className="flex flex-wrap justify-center gap-4">
            {LEGAL_LINKS.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="text-sm text-[#94a3b8] hover:text-white">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Language selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-[#334155] px-3 py-1.5 text-sm text-[#94a3b8] hover:border-[#475569]"
              aria-expanded={langOpen}
              aria-haspopup="listbox"
              aria-label="Choisir la langue"
            >
              <span aria-hidden="true">{currentLang.flag}</span>
              <span>{currentLang.label}</span>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {langOpen && (
              <ul
                role="listbox"
                className="absolute bottom-full right-0 mb-1 w-40 rounded-lg border border-[#334155] bg-[var(--navy-800)] py-1 shadow-lg"
              >
                {LANGUAGES.map((lang) => (
                  <li key={lang.code} role="option" aria-selected={lang.code === currentLang.code}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--navy-700)]"
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
        </div>
      </div>
    </footer>
  );
}
