import type { ComponentType } from 'react';
import { AnimatedNumber } from './primitives/AnimatedNumber';
import { Reveal } from './primitives/Reveal';
import { BuildingIcon, ChartIcon, FingerprintIcon, SparkIcon, type IconProps } from './icons';
import { cn } from '@/lib/utils';

interface Stat {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  color: string;
  Icon: ComponentType<IconProps>;
  ariaLabel: string;
}

const STATS: Stat[] = [
  {
    value: 500000,
    suffix: '+',
    label: 'Logements enregistrés',
    color: 'text-drc-yellow',
    Icon: BuildingIcon,
    ariaLabel: 'Plus de 500 000 logements enregistrés',
  },
  {
    value: 24,
    label: 'Communes couvertes',
    color: 'text-drc-blue',
    Icon: ChartIcon,
    ariaLabel: '24 communes couvertes',
  },
  {
    value: 100,
    suffix: '%',
    label: 'Paiements tracés',
    color: 'text-white',
    Icon: FingerprintIcon,
    ariaLabel: '100 % des paiements tracés',
  },
  {
    value: 60,
    prefix: '< ',
    suffix: 's',
    label: 'Par transaction',
    color: 'text-drc-yellow',
    Icon: SparkIcon,
    ariaLabel: 'Moins de 60 secondes par transaction',
  },
];

export function StatsBar() {
  return (
    <section id="chiffres" className="lp-dark relative bg-drc-navy py-16 lg:py-20" aria-label="Chiffres clés">
      <div className="lp-grid-bg--dark absolute inset-0" aria-hidden="true" />
      <div className="lp-container relative">
        <Reveal>
          <dl className="grid grid-cols-2 gap-y-12 lg:grid-cols-4 lg:gap-y-0">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={cn(
                  'flex flex-col items-center px-4 text-center',
                  'lg:border-l lg:border-white/10 lg:first:border-l-0',
                  i % 2 === 1 && 'border-l border-white/10 lg:border-l',
                )}
              >
                <stat.Icon size={20} className="mb-5 text-white/30" />
                <dd
                  className={cn(
                    'order-1 font-heading text-[40px] font-extrabold leading-none tracking-[-0.03em] sm:text-[48px] lg:text-[56px]',
                    stat.color,
                  )}
                >
                  <AnimatedNumber
                    value={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    delay={i * 120}
                    label={stat.ariaLabel}
                  />
                </dd>
                <dt className="order-2 mt-4 text-[12px] font-semibold uppercase tracking-[2px] text-drc-gray-400 sm:text-[14px]">
                  {stat.label}
                </dt>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
