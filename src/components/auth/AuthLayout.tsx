import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ROUTES } from '@/config/routes';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { KINSHASA_LOGO_SRC } from '@/components/landing/primitives/KinshasaLogo';
import { CheckIcon } from '@/components/landing/icons';
import { LanguageSwitcher } from './LanguageSwitcher';

// Same public assets as the landing hero, so the static shell in index.html can
// preload them and the browser cache is shared between the two pages.
const PANEL_IMAGE = {
  webp: '/landing/hero-kinshasa.webp',
  webpMd: '/landing/hero-kinshasa-1024.webp',
  webpSm: '/landing/hero-kinshasa-750.webp',
  jpg: '/landing/hero-kinshasa.jpg',
} as const;

export interface AuthPanelProps {
  headline: string;
  subheadline: string;
  bullets: readonly string[];
  testimonial: { quote: string; author: string };
  /** Optional wizard progress mirrored on the left panel (1-based). */
  steps?: { labels: readonly string[]; current: number };
}

interface AuthLayoutProps {
  /** Document title. */
  title: string;
  /** `split` = photo panel + form (desktop); `centered` = single card on a tinted backdrop. */
  variant?: 'split' | 'centered';
  panel?: AuthPanelProps;
  children: ReactNode;
}

/**
 * Shared frame for every authentication page. Its geometry (grid, panel
 * padding, top bar height, body offset, card width) is mirrored by the
 * `#auth-shell` static markup in index.html — change both together.
 */
export function AuthLayout({ title, variant = 'split', panel, children }: AuthLayoutProps) {
  const t = useT();
  const split = variant === 'split' && panel;

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className={cn('auth', split ? 'auth--split' : 'auth--centered')}>
        <a href="#auth-form" className="auth-skip">
          {t('common.skipToForm')}
        </a>

        {split ? <LeftPanel {...panel} /> : null}

        <div className="auth-main">
          <span className="auth-flag" aria-hidden="true" />
          <header className="auth-topbar">
            <Link to={ROUTES.HOME} className="auth-topbar__brand" aria-label={t('common.brand')}>
              <img src={KINSHASA_LOGO_SRC} alt="" width={40} height={40} decoding="async" />
              <span className="auth-topbar__word" aria-hidden="true">
                <b>eLoyer</b> <i>Kinshasa</i>
              </span>
            </Link>
            <LanguageSwitcher />
          </header>

          <main id="auth-form" className="auth-body" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

function useDesktopPanel(): boolean {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return desktop;
}

function LeftPanel({ headline, subheadline, bullets, testimonial, steps }: AuthPanelProps) {
  const t = useT();
  const desktop = useDesktopPanel();
  if (!desktop) return null;

  return (
    <aside className="auth-panel">
      <div className="auth-panel__bg" aria-hidden="true">
        <picture>
          <source
            srcSet={`${PANEL_IMAGE.webpSm} 750w, ${PANEL_IMAGE.webpMd} 1024w, ${PANEL_IMAGE.webp} 1600w`}
            sizes="55vw"
            type="image/webp"
          />
          <img src={PANEL_IMAGE.jpg} alt="" width={1600} height={1067} fetchPriority="high" decoding="async" />
        </picture>
      </div>
      <div className="auth-panel__overlay" aria-hidden="true" />

      <div className="auth-panel__content">
        <Link to={ROUTES.HOME} className="auth-panel__logo" aria-label={t('common.brand')}>
          <span className="auth-panel__seal">
            <img src={KINSHASA_LOGO_SRC} alt="" width={56} height={56} decoding="async" />
          </span>
          <span className="flex flex-col leading-none" aria-hidden="true">
            <span className="font-heading text-[22px] font-bold tracking-[-0.02em]">
              <span className="text-drc-blue">eLoyer</span> <span className="text-white">Kinshasa</span>
            </span>
            <span className="mt-[5px] text-[9px] font-semibold uppercase tracking-[1.5px] text-white/55">
              {t('common.city')}
            </span>
          </span>
        </Link>

        <h2 className="auth-panel__headline">{headline}</h2>
        <p className="auth-panel__sub">{subheadline}</p>

        {steps ? (
          <ol className="auth-panel__steps" aria-label={t('register.stepLabel', { current: steps.current, total: steps.labels.length })}>
            {steps.labels.map((label, i) => {
              const index = i + 1;
              const state = index < steps.current ? 'done' : index === steps.current ? 'active' : 'todo';
              return (
                <li key={label} className="contents">
                  <span
                    className={cn(
                      'auth-panel__step',
                      state === 'active' && 'auth-panel__step--active',
                      state === 'done' && 'auth-panel__step--done',
                    )}
                    aria-current={state === 'active' ? 'step' : undefined}
                  >
                    <i>{state === 'done' ? <CheckIcon size={14} /> : index}</i>
                    {label}
                  </span>
                  {i < steps.labels.length - 1 ? <span className="auth-panel__step-line" aria-hidden="true" /> : null}
                </li>
              );
            })}
          </ol>
        ) : null}

        <ul className="auth-panel__bullets">
          {bullets.map((bullet) => (
            <li key={bullet}>
              <span className="auth-panel__check" aria-hidden="true">
                <CheckIcon size={16} />
              </span>
              {bullet}
            </li>
          ))}
        </ul>

        <figure className="auth-panel__quote">
          <blockquote>« {testimonial.quote} »</blockquote>
          <figcaption>— {testimonial.author}</figcaption>
        </figure>
      </div>

      <p className="auth-panel__hand" aria-hidden="true">
        {t('panel.hand')}
      </p>
    </aside>
  );
}
