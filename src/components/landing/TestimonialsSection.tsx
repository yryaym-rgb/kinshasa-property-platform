import { SectionHeading } from './primitives/SectionHeading';
import { Reveal, Stagger, StaggerItem } from './primitives/Reveal';
import { QuoteIcon } from './icons';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  location: string;
  initials: string;
  avatarClass: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'Grâce à eLoyer, je gère mes 12 appartements à Gombe depuis mon téléphone. Fini les cahiers et les reçus papier.',
    name: 'M. Kabongo',
    role: 'Bailleur',
    location: 'Gombe',
    initials: 'MK',
    avatarClass: 'bg-drc-blue text-white',
  },
  {
    quote: 'Je paie mon loyer en 30 secondes avec Orange Money et je reçois mon reçu immédiatement.',
    name: 'Mme Nsimba',
    role: 'Locataire',
    location: 'Lingwala',
    initials: 'JN',
    avatarClass: 'bg-drc-yellow text-drc-navy',
  },
  {
    quote: 'Nous avons une visibilité en temps réel sur les recettes fiscales locatives de la commune.',
    name: 'Agent DGI',
    role: 'Administration fiscale',
    location: 'Kinshasa',
    initials: 'DG',
    avatarClass: 'bg-drc-red text-white',
  },
];

export function TestimonialsSection() {
  return (
    <section
      id="actualites"
      className="lp-section-anchor lp-dark relative overflow-hidden bg-drc-navy py-24 lg:py-[120px]"
      aria-labelledby="testimonials-title"
    >
      <div className="lp-grid-bg--dark absolute inset-0" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-drc-blue/20 blur-[140px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 bottom-0 h-[420px] w-[420px] rounded-full bg-drc-yellow/10 blur-[140px]"
      />

      <div className="lp-container relative">
        <Reveal>
          <SectionHeading
            id="testimonials-title"
            number="04"
            label="Témoignages"
            tone="dark"
            size="md"
            title="Ils nous font confiance"
            subtitle="Bailleurs, locataires et agents publics : la même plateforme, la même confiance."
          />
        </Reveal>

        <Stagger as="ul" className="mt-16 grid gap-6 md:grid-cols-3" stagger={0.12}>
          {TESTIMONIALS.map((t) => (
            <StaggerItem key={t.name} as="li" className="h-full">
              <figure className="lp-glass flex h-full flex-col rounded-3xl p-8">
                <QuoteIcon size={40} className="text-drc-yellow" />
                <blockquote className="mt-5 flex-1">
                  <p className="text-[18px] italic leading-[1.6] text-white">« {t.quote} »</p>
                </blockquote>
                <div aria-hidden="true" className="my-6 h-px w-full bg-white/10" />
                <figcaption className="flex items-center gap-4">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-heading text-[14px] font-bold ${t.avatarClass}`}
                    aria-hidden="true"
                  >
                    {t.initials}
                  </span>
                  <div>
                    <p className="font-heading text-[15px] font-bold text-white">{t.name}</p>
                    <p className="text-[13px] text-white/55">
                      {t.role} · {t.location}
                    </p>
                  </div>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
