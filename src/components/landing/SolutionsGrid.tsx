import type { ComponentType, CSSProperties, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { SectionHeading } from './primitives/SectionHeading';
import { Reveal, Stagger, StaggerItem } from './primitives/Reveal';
import { ArrowRightIcon, BuildingIcon, CheckIcon, HomeIcon, LandmarkIcon, UserIcon, type IconProps } from './icons';

interface Solution {
  title: string;
  description: string;
  bullets: string[];
  Icon: ComponentType<IconProps>;
  accent: string;
  iconClass: string;
  circleClass: string;
  to: string;
}

const SOLUTIONS: Solution[] = [
  {
    title: 'Pour les locataires',
    description:
      'Payez votre loyer en un clic, recevez vos reçus instantanément et gardez un historique complet de vos paiements.',
    bullets: ['Paiement Mobile Money', 'Reçus numériques', 'Historique permanent'],
    Icon: UserIcon,
    accent: '#009FE3',
    iconClass: 'text-drc-blue',
    circleClass: 'bg-drc-blue/10',
    to: `${ROUTES.REGISTER}?role=locataire`,
  },
  {
    title: 'Pour les bailleurs',
    description: 'Gérez tous vos biens, suivez vos loyers en temps réel et automatisez vos obligations fiscales.',
    bullets: ['Tableau de bord', 'Revenus en temps réel', 'Fiscalité automatisée'],
    Icon: HomeIcon,
    accent: '#E5C400',
    iconClass: 'text-[#B89A00]',
    circleClass: 'bg-drc-yellow/20',
    to: `${ROUTES.REGISTER}?role=bailleur`,
  },
  {
    title: 'Pour les agences',
    description:
      'Gérez le portefeuille de vos clients, créez des contrats et suivez les paiements depuis une seule interface.',
    bullets: ['Portefeuille multi-clients', 'Contrats numériques', 'Rapports'],
    Icon: BuildingIcon,
    accent: '#EF3E42',
    iconClass: 'text-drc-red',
    circleClass: 'bg-drc-red/10',
    to: `${ROUTES.REGISTER}?role=agence`,
  },
  {
    title: "Pour l'administration",
    description:
      'Suivez les recettes fiscales, contrôlez la conformité et générez des rapports statistiques en temps réel.',
    bullets: ['Tableau de bord fiscal', 'Rapprochements', "Détection d'anomalies"],
    Icon: LandmarkIcon,
    accent: '#C9A227',
    iconClass: 'text-drc-gold',
    circleClass: 'bg-drc-gold/12',
    to: ROUTES.LOGIN,
  },
];

function trackPointer(e: MouseEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
}

export function SolutionsGrid() {
  return (
    <section id="services" className="lp-section-anchor relative bg-white py-24 lg:py-[120px]" aria-labelledby="solutions-title">
      <div className="lp-grid-bg absolute inset-0" aria-hidden="true" />
      <div className="lp-container relative">
        <Reveal>
          <SectionHeading
            id="solutions-title"
            number="01"
            label="Pour qui ?"
            title="Une plateforme. Quatre expériences."
            subtitle="Chaque acteur du marché locatif dispose de son propre espace sécurisé."
          />
        </Reveal>

        <Stagger as="ul" className="mt-16 grid gap-6 md:grid-cols-2 lg:mt-20" stagger={0.12}>
          {SOLUTIONS.map((solution, index) => (
            <StaggerItem key={solution.title} as="li" className="h-full">
              <article
                className="lp-card flex h-full flex-col"
                style={{ '--card-accent': solution.accent } as CSSProperties}
                onMouseMove={trackPointer}
              >
                <solution.Icon className="lp-card__glyph" size={140} />

                <div className="flex items-start justify-between">
                  <span className={`flex h-[72px] w-[72px] items-center justify-center rounded-full ${solution.circleClass}`}>
                    <solution.Icon size={36} className={solution.iconClass} />
                  </span>
                  <span className="lp-mono text-[12px] font-semibold text-drc-gray-500">0{index + 1}</span>
                </div>

                <h3 className="mt-7 font-heading text-[22px] font-bold tracking-[-0.01em] text-drc-navy">{solution.title}</h3>
                <p className="mt-3 text-[15px] leading-[1.65] text-drc-gray-600">{solution.description}</p>

                <ul className="mt-6 flex flex-col gap-3">
                  {solution.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-3 text-[14px] font-medium text-drc-charcoal">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-drc-blue/10 text-drc-blue-ink">
                        <CheckIcon size={12} />
                      </span>
                      {bullet}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 pt-2">
                  <Link to={solution.to} className="lp-link text-[14px]">
                    En savoir plus
                    <ArrowRightIcon size={16} className="lp-link__arrow" />
                  </Link>
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
