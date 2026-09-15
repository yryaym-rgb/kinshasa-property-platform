import type { ComponentType } from 'react';
import boulevard from '@/assets/landing/kinshasa-boulevard.webp';
import boulevardSm from '@/assets/landing/kinshasa-boulevard-560.webp';
import { SectionLabel } from './primitives/SectionLabel';
import { Reveal, Stagger, StaggerItem } from './primitives/Reveal';
import { FlagBar } from './primitives/FlagBar';
import {
  FingerprintIcon,
  HeadsetIcon,
  PhoneBasicIcon,
  QrReceiptIcon,
  ShieldIcon,
  StampIcon,
  type IconProps,
} from './icons';

interface Benefit {
  title: string;
  description: string;
  Icon: ComponentType<IconProps>;
  tone: string;
}

const BENEFITS: Benefit[] = [
  {
    title: 'Sécurité',
    description: 'Chiffrement de bout en bout, conforme aux standards internationaux.',
    Icon: ShieldIcon,
    tone: 'bg-drc-blue/10 text-drc-blue',
  },
  {
    title: 'Traçabilité',
    description: 'Chaque transaction est horodatée et infalsifiable.',
    Icon: FingerprintIcon,
    tone: 'bg-drc-yellow/20 text-[#B89A00]',
  },
  {
    title: 'Accessibilité',
    description: 'Fonctionne sur tous les téléphones, même basiques.',
    Icon: PhoneBasicIcon,
    tone: 'bg-drc-red/10 text-drc-red',
  },
  {
    title: 'Conformité fiscale',
    description: 'Aligné avec la DGI et la législation congolaise.',
    Icon: StampIcon,
    tone: 'bg-drc-gold/12 text-drc-gold-ink',
  },
  {
    title: 'Support local',
    description: 'Équipe basée à Kinshasa, disponible en français, lingala et swahili.',
    Icon: HeadsetIcon,
    tone: 'bg-drc-navy/8 text-drc-navy',
  },
];

export function BenefitsSection() {
  return (
    <section id="a-propos" className="lp-section-anchor relative overflow-hidden bg-white py-24 lg:py-[120px]" aria-labelledby="benefits-title">
      <div className="lp-container">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          {/* ── Photography ────────────────────────────────── */}
          <Reveal direction="right" className="relative">
            <figure className="lp-photo-frame aspect-[4/5] max-h-[680px] w-full">
              <img
                src={boulevard}
                srcSet={`${boulevardSm} 560w, ${boulevard} 800w`}
                sizes="(min-width: 1024px) 40vw, 100vw"
                alt="Le boulevard du 30 Juin et les immeubles de la Gombe, à Kinshasa, en fin de journée"
                width={800}
                height={920}
                loading="lazy"
                decoding="async"
              />
              <figcaption className="absolute bottom-7 left-7 z-10 text-white">
                <span className="lp-mono text-[11px] uppercase tracking-[2px] text-white/70">Gombe · Kinshasa</span>
                <span className="mt-1 block font-heading text-[20px] font-bold">Boulevard du 30 Juin</span>
              </figcaption>
            </figure>

            {/* Floating verified-receipt card */}
            <Reveal delay={0.35} direction="up" className="absolute -right-3 top-10 z-10 sm:right-6 lg:-right-8">
              <div className="w-[236px] rounded-2xl border border-drc-gray-200 bg-white/95 p-4 shadow-[0_24px_60px_rgba(10,22,40,0.18)] backdrop-blur">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <QrReceiptIcon size={20} />
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-drc-navy">Reçu vérifié</p>
                    <p className="lp-mono text-[10px] text-drc-gray-500">REC-KIN-2025-018472</p>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between border-t border-drc-gray-200 pt-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[1px] text-drc-gray-500">Loyer · Septembre</p>
                    <p className="lp-tabular mt-0.5 font-heading text-[16px] font-extrabold text-drc-navy">650 000 FC</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Payé</span>
                </div>
              </div>
            </Reveal>

            <FlagBar className="absolute -bottom-4 left-10 hidden !w-28 rounded-full lg:block" />
          </Reveal>

          {/* ── Content ────────────────────────────────────── */}
          <div>
            <Reveal>
              <SectionLabel number="03" tone="gold">
                Nos engagements
              </SectionLabel>
              <h2 id="benefits-title" className="lp-display mt-5 text-[30px] text-drc-navy sm:text-[40px] lg:text-[48px]">
                Conçu pour Kinshasa.
                <br className="hidden sm:block" />
                Construit pour durer.
              </h2>
              <p className="mt-6 max-w-[540px] text-[17px] leading-[1.65] text-drc-gray-600">
                eLoyer Kinshasa a été pensé avec les bailleurs, les locataires et les agents de l&apos;administration
                fiscale. Une infrastructure publique, souveraine et transparente, au service de tous les Kinois.
              </p>
            </Reveal>

            <Stagger as="ul" className="mt-10 flex flex-col divide-y divide-drc-gray-200" stagger={0.09}>
              {BENEFITS.map((benefit) => (
                <StaggerItem key={benefit.title} as="li" distance={18}>
                  <div className="group flex gap-5 py-5 first:pt-0">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1 group-hover:scale-105 ${benefit.tone}`}
                    >
                      <benefit.Icon size={22} />
                    </span>
                    <div>
                      <h3 className="font-heading text-[17px] font-bold text-drc-navy">{benefit.title}</h3>
                      <p className="mt-1 text-[15px] leading-[1.6] text-drc-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </div>
    </section>
  );
}
