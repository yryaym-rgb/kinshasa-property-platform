import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { cn } from '@/lib/utils';

export function CTASection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      id="contact"
      ref={ref}
      className={cn(
        'bg-[var(--navy-900)] py-16 md:py-20 landing-reveal',
        isVisible && 'is-visible',
      )}
      aria-labelledby="cta-heading"
    >
      <div className="mx-auto max-w-[800px] px-6 text-center md:px-10">
        <h2
          id="cta-heading"
          className="font-heading text-2xl font-bold text-white md:text-4xl"
        >
          Rejoignez la révolution numérique du secteur locatif
        </h2>
        <p className="mt-4 text-lg text-[#cbd5e1]">
          Inscrivez-vous en 2 minutes et commencez à gérer vos biens ou votre location en toute
          simplicité.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to={ROUTES.REGISTER}
            className="landing-btn-gold inline-flex items-center justify-center rounded-lg bg-[var(--brand-gold)] px-8 py-4 text-base font-bold text-[var(--navy-900)]"
          >
            Créer un compte
          </Link>
          <a
            href="mailto:contact@eloyer-kinshasa.cd"
            className="inline-flex items-center justify-center rounded-lg border-2 border-white px-8 py-4 text-base font-medium text-white transition-colors hover:bg-white/10"
          >
            Contacter l&apos;équipe
          </a>
        </div>
      </div>
    </section>
  );
}
