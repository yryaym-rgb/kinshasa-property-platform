import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { CheckBullet } from '@/components/public/ui/CheckBullet';
import { PhoneMockup } from '@/components/public/ui/PhoneMockup';
import { LaptopMockup } from '@/components/public/ui/LaptopMockup';
import { cn } from '@/lib/utils';

const CHECK_ITEMS = [
  'Interface moderne et intuitive',
  'Disponible sur mobile et web',
  'Paiement via Mobile Money, banque et autres moyens autorisés',
  'Sécurité et confidentialité des données',
  'Conforme à la législation fiscale',
];

export function FeaturesSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      id="a-propos"
      ref={ref}
      className={cn(
        'bg-gradient-to-b from-[#f0f4f8] to-[#e2e8f0] py-20 md:py-24 landing-reveal',
        isVisible && 'is-visible',
      )}
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 lg:px-20">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          {/* Left */}
          <div className="lg:col-span-3">
            <div className="mb-4 h-1 w-[60px] rounded bg-[var(--brand-gold)]" aria-hidden="true" />
            <h2
              id="features-heading"
              className="font-heading text-2xl font-bold text-[var(--navy-900)] md:text-3xl lg:text-[42px] lg:leading-tight"
            >
              Une gestion locative simplifiée et 100% numérique
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-[var(--text-secondary)]">
              De la signature du contrat au paiement du loyer, en passant par le calcul et la
              transmission des obligations fiscales, tout est centralisé sur une seule plateforme.
            </p>
            <Link
              to="/register"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[var(--navy-900)] px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-[var(--navy-800)]"
            >
              Découvrir toutes les fonctionnalités
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>

          {/* Center - mockups */}
          <div className="relative flex min-h-[400px] items-center justify-center lg:col-span-5">
            <LaptopMockup />
            <PhoneMockup />
          </div>

          {/* Right - checkmarks */}
          <div className="lg:col-span-4">
            <ul className="space-y-5">
              {CHECK_ITEMS.map((item) => (
                <CheckBullet key={item}>{item}</CheckBullet>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
