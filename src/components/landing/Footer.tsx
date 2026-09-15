import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { BREAKPOINTS, useMediaQuery } from '@/hooks/useMediaQuery';
import { FlagBar } from './primitives/FlagBar';
import { KinshasaSeal, EloyerWordmark } from './primitives/KinshasaLogo';
import {
  ChevronDownIcon,
  DRCFlag,
  FacebookIcon,
  LinkedInIcon,
  XIcon,
  YouTubeIcon,
  type IconProps,
} from './icons';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  {
    title: 'Plateforme',
    links: [
      { label: 'Fonctionnalités', href: '#fonctionnalites' },
      { label: 'Tarifs', href: '#services' },
      { label: 'Sécurité', href: '#a-propos' },
      { label: 'API développeurs', href: '#contact' },
    ],
  },
  {
    title: 'À propos',
    links: [
      { label: 'Notre mission', href: '#a-propos' },
      { label: 'Équipe', href: '#a-propos' },
      { label: 'Partenaires', href: '#accueil' },
      { label: 'Carrières', href: '#contact' },
    ],
  },
  {
    title: 'Ressources',
    links: [
      { label: "Centre d'aide", href: '#contact' },
      { label: 'Guide utilisateur', href: '#fonctionnalites' },
      { label: 'FAQ', href: '#fonctionnalites' },
      { label: 'Contact', href: '#contact' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { label: 'Mentions légales', href: '#contact' },
      { label: 'Politique de confidentialité', href: '#contact' },
      { label: 'CGU', href: '#contact' },
      { label: 'Conformité fiscale', href: '#a-propos' },
    ],
  },
];

const SOCIALS: { label: string; href: string; Icon: ComponentType<IconProps> }[] = [
  { label: 'Facebook', href: 'https://facebook.com', Icon: FacebookIcon },
  { label: 'X (Twitter)', href: 'https://x.com', Icon: XIcon },
  { label: 'LinkedIn', href: 'https://linkedin.com', Icon: LinkedInIcon },
  { label: 'YouTube', href: 'https://youtube.com', Icon: YouTubeIcon },
];

export function Footer() {
  const isDesktop = useMediaQuery(BREAKPOINTS.lg);
  const year = new Date().getFullYear();

  return (
    <footer className="lp-dark relative bg-drc-navy text-white" aria-labelledby="footer-title">
      <FlagBar />
      <h2 id="footer-title" className="sr-only">
        Pied de page
      </h2>

      <div className="lp-container pt-16 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.6fr_repeat(4,1fr)] lg:gap-10">
          {/* ── Brand column ─────────────────────────────────── */}
          <div className="max-w-[340px]">
            <Link to={ROUTES.HOME} className="inline-flex items-center gap-4 rounded-lg" aria-label="eLoyer Kinshasa — Accueil">
              <KinshasaSeal size={52} onDark />
              <EloyerWordmark tone="dark" />
            </Link>
            <p className="lp-hand mt-6 text-[26px] leading-none text-drc-gold">Ensemble pour une ville plus forte.</p>
            <p className="mt-5 text-[14px] leading-[1.65] text-drc-gray-400">
              Plateforme officielle de gestion locative et de mobilisation des recettes fiscales de la Ville de
              Kinshasa.
            </p>
            <ul className="mt-7 flex items-center gap-2" aria-label="Réseaux sociaux">
              {SOCIALS.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-drc-blue hover:bg-drc-blue hover:text-white"
                  >
                    <Icon size={18} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Link columns ─────────────────────────────────── */}
          {COLUMNS.map((column) =>
            isDesktop ? (
              <nav key={column.title} aria-label={column.title}>
                <p className="text-[12px] font-bold uppercase tracking-[2px] text-white">{column.title}</p>
                <ul className="mt-6 flex flex-col gap-3.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} className="lp-footer-link">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : (
              <details key={column.title} className="group border-b border-white/10 pb-4">
                <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-[13px] font-bold uppercase tracking-[2px] text-white [&::-webkit-details-marker]:hidden">
                  {column.title}
                  <ChevronDownIcon size={18} className="text-white/50 transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <ul className="mt-4 flex flex-col gap-3.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} className="lp-footer-link">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            ),
          )}
        </div>

        {/* ── Bottom bar ───────────────────────────────────── */}
        <div className="mt-16 flex flex-col gap-4 border-t border-white/10 py-[30px] text-[13px] text-drc-gray-400 lg:flex-row lg:items-center lg:justify-between">
          <p>© {year} eLoyer Kinshasa. Tous droits réservés.</p>
          <p className="flex items-center gap-2.5">
            <DRCFlag width={20} />
            Fièrement conçu en République Démocratique du Congo
          </p>
          <p>
            Powered by <span className="font-semibold text-white/80">Ville de Kinshasa</span>
          </p>
        </div>
        <p className="pb-6 text-[11px] text-white/30">
          Photographies : MONUSCO (CC BY-SA 2.0), via Wikimedia Commons.
        </p>
      </div>
    </footer>
  );
}
