import { User, Home, Building2, Landmark } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { SolutionCard } from '@/components/public/ui/SolutionCard';
import { cn } from '@/lib/utils';

const SOLUTIONS = [
  {
    icon: User,
    title: 'Pour les locataires',
    description:
      'Payer votre loyer, consulter vos contrats et recevoir vos reçus en toute simplicité.',
  },
  {
    icon: Home,
    title: 'Pour les bailleurs',
    description: 'Gérer vos biens, suivre vos loyers et vos revenus fiscaux.',
  },
  {
    icon: Building2,
    title: 'Pour les agences',
    description: 'Gérer les locations, les contrats et les paiements de vos clients.',
  },
  {
    icon: Landmark,
    title: "Pour l'administration",
    description: 'Suivre les recettes, contrôler la conformité et générer des rapports.',
  },
];

export function SolutionsSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      id="services"
      ref={ref}
      className={cn('bg-white py-16 md:py-20 landing-reveal', isVisible && 'is-visible')}
      aria-labelledby="solutions-heading"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 lg:px-20">
        <div className="grid gap-12 lg:grid-cols-[35%_65%] lg:gap-16">
          {/* Left column */}
          <div>
            <div className="mb-4 h-1 w-[60px] rounded bg-[var(--brand-gold)]" aria-hidden="true" />
            <h2
              id="solutions-heading"
              className="font-heading text-3xl font-bold text-[var(--navy-900)] md:text-4xl lg:text-5xl"
            >
              Une solution complète pour tous
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-[var(--text-secondary)]">
              eLoyer Kinshasa connecte les bailleurs, locataires, agences, gestionnaires et
              l&apos;administration fiscale dans un écosystème unique et sécurisé.
            </p>
          </div>

          {/* Right column - cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUTIONS.map((solution) => (
              <SolutionCard
                key={solution.title}
                icon={solution.icon}
                title={solution.title}
                description={solution.description}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
