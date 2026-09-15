import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { Reveal } from './primitives/Reveal';
import { FlagBar } from './primitives/FlagBar';
import { ArrowRightIcon, HeadsetIcon } from './icons';

export function CTASection() {
  return (
    <section
      id="contact"
      className="lp-section-anchor lp-dark relative overflow-hidden bg-drc-blue-ink py-24 lg:py-[100px]"
      aria-labelledby="cta-title"
    >
      {/* Layered colour blocks — flag colours as architecture, not decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[14%] -top-[40%] h-[160%] w-[34%] rotate-[18deg] bg-drc-blue"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[60%] -left-[16%] h-[120%] w-[28%] rotate-[18deg] bg-drc-blue/60"
      />
      <FlagBar orientation="vertical" className="absolute right-0 top-0 hidden !w-2 lg:block" />

      <div className="lp-container relative">
        <Reveal className="mx-auto flex max-w-[860px] flex-col items-center text-center">
          <p className="lp-mono text-[12px] font-semibold uppercase tracking-[3px] text-white/70">05 / Rejoignez-nous</p>
          <h2 id="cta-title" className="lp-display mt-5 text-[30px] text-white sm:text-[42px] lg:text-[48px]">
            Rejoignez la révolution numérique du secteur locatif.
          </h2>
          <p className="mt-6 max-w-[620px] text-[17px] leading-[1.65] text-white/85 sm:text-[18px]">
            Inscription gratuite, en moins de deux minutes. Accessible depuis n&apos;importe quel téléphone, partout à
            Kinshasa.
          </p>
          <div className="mt-10 flex w-full flex-col items-stretch justify-center gap-4 sm:w-auto sm:flex-row sm:items-center">
            <Link to={ROUTES.REGISTER} className="lp-btn lp-btn--white">
              Créer un compte gratuit
              <ArrowRightIcon size={18} className="lp-btn__arrow" />
            </Link>
            <a href="mailto:contact@eloyer-kinshasa.cd" className="lp-btn lp-btn--outline-white">
              <HeadsetIcon size={18} />
              Parler à un conseiller
            </a>
          </div>
          <p className="mt-8 text-[13px] text-white/60">
            Support disponible en français, lingala et swahili · Lun–Sam, 8h–18h
          </p>
        </Reveal>
      </div>
    </section>
  );
}
