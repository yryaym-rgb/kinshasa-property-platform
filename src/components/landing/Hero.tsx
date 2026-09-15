import { Link } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ROUTES } from '@/config/routes';
import { BREAKPOINTS, useMediaQuery } from '@/hooks/useMediaQuery';
import { FloatingDashboard } from './primitives/FloatingDashboard';
import { KinshasaSeal } from './primitives/KinshasaLogo';
import { LP_EASE } from './primitives/motion';
import {
  ArrowRightIcon,
  ChartIcon,
  ChevronDownIcon,
  DRCFlag,
  HomeIcon,
  MobileMoneyIcon,
  PlayIcon,
  QrReceiptIcon,
} from './icons';

// Served from /public with stable URLs so index.html can preload the LCP image
// before any JavaScript executes (see the inline script in index.html).
const HERO_IMAGE = {
  webp: '/landing/hero-kinshasa.webp',
  webpMd: '/landing/hero-kinshasa-1024.webp',
  webpSm: '/landing/hero-kinshasa-750.webp',
  jpg: '/landing/hero-kinshasa.jpg',
} as const;

const FEATURES = [
  { Icon: HomeIcon, label: 'Gestion des logements' },
  { Icon: MobileMoneyIcon, label: 'Paiement Mobile Money' },
  { Icon: QrReceiptIcon, label: 'Reçus QR sécurisés' },
  { Icon: ChartIcon, label: 'Fiscalité automatisée' },
];

export function Hero() {
  const reduce = useReducedMotion();
  const isDesktop = useMediaQuery(BREAKPOINTS.lg);

  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduce ? 0 : 0.1, delayChildren: reduce ? 0 : 0.15 } },
  };
  const item: Variants = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 26 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [...LP_EASE] } },
  };

  return (
    <section id="accueil" className="lp-hero lp-section-anchor" aria-labelledby="hero-title">
      <div className="lp-hero__bg" aria-hidden="true">
        <picture>
          <source
            srcSet={`${HERO_IMAGE.webpSm} 750w, ${HERO_IMAGE.webpMd} 1024w, ${HERO_IMAGE.webp} 1600w`}
            sizes="100vw"
            type="image/webp"
          />
          <img src={HERO_IMAGE.jpg} alt="" width={1600} height={1067} fetchPriority="high" decoding="async" />
        </picture>
      </div>
      <div className="lp-hero__overlay" aria-hidden="true" />
      <div className="lp-hero__glow" aria-hidden="true" />

      <div className="lp-container relative flex min-h-[inherit] flex-col pb-[88px] pt-[48px] lg:pt-[56px]">
        <div className="grid flex-1 items-center gap-14 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] lg:gap-10">
          {/* ── Copy ─────────────────────────────────────────── */}
          <motion.div variants={container} initial="hidden" animate="visible" className="max-w-[680px]">
            <motion.div variants={item}>
              <span className="lp-hero__badge">
                <DRCFlag width={18} />
                <span className="sm:hidden">RDC — Ville de Kinshasa</span>
                <span className="hidden sm:inline">République Démocratique du Congo — Ville de Kinshasa</span>
              </span>
            </motion.div>

            <motion.h1 id="hero-title" variants={item} className="lp-hero__title mt-8">
              <span className="text-white">Chaque logement.</span>
              <span className="text-drc-yellow">Chaque loyer.</span>
              <span className="text-drc-blue">Chaque recette.</span>
            </motion.h1>

            <motion.p variants={item} className="mt-6 max-w-[580px] text-[18px] leading-[1.6] text-white/85 sm:text-[20px]">
              La plateforme numérique intégrée qui transforme la gestion locative à Kinshasa.
            </motion.p>

            <motion.ul variants={item} className="mt-9 grid max-w-[560px] grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2" aria-label="Fonctionnalités clés">
              {FEATURES.map(({ Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5 text-[14px] font-medium text-white">
                  <Icon size={24} className="shrink-0 text-drc-yellow" />
                  {label}
                </li>
              ))}
            </motion.ul>

            <motion.div variants={item} className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link to={ROUTES.REGISTER} className="lp-btn lp-btn--yellow">
                Commencer maintenant
                <ArrowRightIcon size={18} className="lp-btn__arrow" />
              </Link>
              <a href="#fonctionnalites" className="lp-btn lp-btn--ghost">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/12">
                  <PlayIcon size={14} className="ml-0.5" />
                </span>
                Voir la démo (2 min)
              </a>
            </motion.div>
          </motion.div>

          {/* ── Dashboard preview ────────────────────────────── */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.45, ease: [...LP_EASE] }}
            className="relative lg:w-[110%] lg:max-w-none lg:justify-self-start xl:w-[118%]"
          >
            <FloatingDashboard flat={!isDesktop} />
          </motion.div>
        </div>

        {/* ── Trust bar ──────────────────────────────────────── */}
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-12 flex flex-col gap-5 border-t border-white/10 pt-7 sm:flex-row sm:items-center sm:gap-10"
        >
          <p className="shrink-0 whitespace-nowrap text-[12px] uppercase tracking-[1.5px] text-white/60">En partenariat avec</p>
          <ul className="flex flex-wrap items-center gap-x-10 gap-y-4" aria-label="Partenaires institutionnels">
            <li className="lp-trust-logo flex items-center gap-3 text-white">
              <KinshasaSeal size={28} onDark />
              <span className="font-heading text-[14px] font-bold tracking-[-0.01em]">Ville de Kinshasa</span>
            </li>
            <li className="lp-trust-logo flex items-center gap-3 text-white">
              <span className="flex h-8 items-center rounded-md border border-white/70 px-2 font-heading text-[14px] font-extrabold tracking-[2px]">
                DGI
              </span>
              <span className="hidden text-[12px] leading-tight text-white/80 md:block">
                Direction Générale
                <br />
                des Impôts
              </span>
            </li>
            <li className="lp-trust-logo flex items-center gap-3 text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 font-heading text-[12px] font-extrabold">
                MF
              </span>
              <span className="text-[12px] leading-tight text-white/80">
                Ministère
                <br />
                des Finances
              </span>
            </li>
          </ul>
        </motion.div>
      </div>

      <motion.p
        aria-hidden="true"
        className="lp-hero__hand hidden xl:block"
        initial={reduce ? false : { opacity: 0, rotate: -6 }}
        animate={{ opacity: 1, rotate: -3 }}
        transition={{ duration: 1.2, delay: 1.4, ease: [...LP_EASE] }}
      >
        Kinshasa avance, ensemble.
      </motion.p>

      <a href="#chiffres" className="lp-scroll-cue" aria-label="Défiler pour découvrir">
        <span>Défiler pour découvrir</span>
        <ChevronDownIcon size={18} />
      </a>
    </section>
  );
}
