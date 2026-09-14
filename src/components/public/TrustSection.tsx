import { useScrollReveal } from '@/hooks/useScrollReveal';
import { cn } from '@/lib/utils';
import logoDrc from '@/assets/landing/logo-drc.svg';

export function TrustSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      ref={ref}
      className={cn('bg-white py-16 md:py-20 landing-reveal', isVisible && 'is-visible')}
      aria-labelledby="trust-heading"
    >
      <div className="mx-auto max-w-[800px] px-6 text-center md:px-10">
        <p
          id="trust-heading"
          className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--brand-gold)]"
        >
          Une initiative officielle
        </p>

        <img
          src={logoDrc}
          alt="Armoiries de la République Démocratique du Congo"
          className="mx-auto mb-8 h-24 w-24"
          width={96}
          height={96}
        />

        <p className="text-lg leading-relaxed text-[var(--text-secondary)]">
          eLoyer Kinshasa est une initiative de la Ville de Kinshasa en partenariat avec la
          Direction Générale des Impôts (DGI) pour moderniser la gestion locative et mobiliser les
          recettes fiscales.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-8">
          <div className="flex h-16 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-light)] px-8">
            <span className="font-heading text-sm font-bold tracking-wide text-[var(--navy-900)]">
              VILLE DE KINSHASA
            </span>
          </div>
          <div className="flex h-16 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-light)] px-8">
            <span className="font-heading text-sm font-bold tracking-wide text-[var(--navy-900)]">
              DGI
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
