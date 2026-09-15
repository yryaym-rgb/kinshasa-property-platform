import type { ComponentType, CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { SectionHeading } from './primitives/SectionHeading';
import { Reveal, Stagger, StaggerItem } from './primitives/Reveal';
import { CreditCardIcon, FileCheckIcon, FileTextIcon, UserPlusIcon, type IconProps } from './icons';

interface Step {
  title: string;
  description: string;
  Icon: ComponentType<IconProps>;
  color: string;
  iconClass: string;
}

const STEPS: Step[] = [
  {
    title: 'Créez votre compte',
    description: 'Inscrivez-vous avec votre numéro de téléphone en moins de 2 minutes.',
    Icon: UserPlusIcon,
    color: '#009FE3',
    iconClass: 'text-drc-blue bg-drc-blue/10',
  },
  {
    title: 'Enregistrez votre logement ou contrat',
    description: 'Ajoutez vos biens ou signez vos contrats de bail numériquement.',
    Icon: FileTextIcon,
    color: '#FFDD00',
    iconClass: 'text-[#B89A00] bg-drc-yellow/20',
  },
  {
    title: 'Payez ou recevez vos loyers',
    description: 'Utilisez Orange Money, M-Pesa, Airtel Money ou votre banque.',
    Icon: CreditCardIcon,
    color: '#EF3E42',
    iconClass: 'text-drc-red bg-drc-red/10',
  },
  {
    title: 'Recevez vos reçus et suivez votre fiscalité',
    description: 'Chaque paiement génère un reçu QR sécurisé et met à jour votre situation fiscale.',
    Icon: FileCheckIcon,
    color: '#C9A227',
    iconClass: 'text-drc-gold bg-drc-gold/12',
  },
];

export function ProcessTimeline() {
  const { ref, isVisible } = useScrollReveal<HTMLOListElement>({ threshold: 0.2 });

  return (
    <section
      id="fonctionnalites"
      className="lp-section-anchor relative bg-drc-gray-100 py-24 lg:py-[120px]"
      aria-labelledby="process-title"
    >
      <div className="lp-container">
        <Reveal>
          <SectionHeading
            id="process-title"
            number="02"
            label="Comment ça marche"
            labelTone="red"
            title="De l'inscription au paiement, en 4 étapes."
            subtitle="Un parcours pensé pour être simple, rapide et accessible à tous — du smartphone au téléphone basique."
          />
        </Reveal>

        <Stagger
          as="div"
          className={cn('mt-16 lg:mt-24', isVisible && 'is-visible')}
          stagger={0.15}
        >
          <ol ref={ref} className="relative grid gap-12 lg:grid-cols-4 lg:gap-8">
            {/* Desktop connector */}
            <span aria-hidden="true" className="lp-timeline-line lp-timeline-line--dashed hidden lg:block" />
            <span aria-hidden="true" className="lp-timeline-line hidden lg:block" />
            {/* Mobile connector */}
            <span aria-hidden="true" className="lp-timeline-line-v lg:hidden" />

            {STEPS.map((step, index) => (
              <StaggerItem key={step.title} as="li" className="lp-step relative">
                <div
                  className="flex gap-6 lg:flex-col lg:items-center lg:gap-0 lg:text-center"
                  style={{ '--step-color': step.color } as CSSProperties}
                >
                  <div className="relative z-10 flex shrink-0 flex-col items-center">
                    <span className={cn('lp-step-number', step.color === '#FFDD00' && '!text-drc-navy')}>
                      {index + 1}
                    </span>
                    <span
                      className={cn(
                        'mt-4 flex h-11 w-11 items-center justify-center rounded-full ring-4 ring-drc-gray-100',
                        step.iconClass,
                      )}
                    >
                      <step.Icon size={20} />
                    </span>
                  </div>

                  <div className="pt-3 lg:pt-6">
                    <p className="lp-mono mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-drc-gray-400">
                      Étape 0{index + 1}
                    </p>
                    <h3 className="font-heading text-[18px] font-bold leading-snug text-drc-navy">{step.title}</h3>
                    <p className="mt-2 max-w-[280px] text-[14px] leading-[1.65] text-drc-gray-600 lg:mx-auto">
                      {step.description}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </ol>
        </Stagger>
      </div>
    </section>
  );
}
