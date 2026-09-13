import { useScrollReveal } from '@/hooks/useScrollReveal';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';

interface StatItemProps {
  end: number;
  suffix: string;
  label: string;
  isActive: boolean;
  decimals?: number;
}

function StatItem({ end, suffix, label, isActive, decimals = 0 }: StatItemProps) {
  const value = useCountUp({ end, suffix, isActive, decimals });

  return (
    <div className="text-center">
      <p className="stat-number-animate font-heading text-4xl font-bold text-[var(--brand-gold)] md:text-5xl">
        {value}
      </p>
      <p className="mt-2 text-sm font-medium text-white md:text-base">{label}</p>
    </div>
  );
}

const STATS = [
  { end: 500000, suffix: '+', label: 'Locataires' },
  { end: 250000, suffix: '+', label: 'Bailleurs' },
  { end: 24, suffix: '', label: 'Communes couvertes' },
  { end: 100, suffix: '%', label: 'Transactions sécurisées' },
];

export function StatsSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      ref={ref}
      className={cn('bg-[var(--navy-900)] py-16 md:py-20 landing-reveal', isVisible && 'is-visible')}
      aria-label="Statistiques de la plateforme"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 lg:px-20">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12">
          {STATS.map((stat) => (
            <StatItem
              key={stat.label}
              end={stat.end}
              suffix={stat.suffix}
              label={stat.label}
              isActive={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
