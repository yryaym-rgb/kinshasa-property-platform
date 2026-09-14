import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Home, User, FileText, BarChart3 } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { FeaturePill } from '@/components/public/ui/FeaturePill';
import { Modal } from '@/components/ui/Modal';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1920&q=80';

const FEATURE_PILLS = [
  { icon: Home, label: 'Gestion des logements' },
  { icon: User, label: 'Paiement des loyers' },
  { icon: FileText, label: 'Reçus sécurisés avec QR Code' },
  { icon: BarChart3, label: 'Suivi fiscal et rapports' },
];

export function HeroSection() {
  const [videoOpen, setVideoOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      if (rect.bottom > 0) {
        setScrollY(window.scrollY);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const parallaxOffset = scrollY * 0.3;

  return (
    <section
      id="accueil"
      ref={heroRef}
      className="relative flex min-h-[620px] items-center overflow-hidden"
      aria-label="Section principale"
    >
      {/* Background image with parallax */}
      <div
        className="hero-parallax absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${HERO_IMAGE}), linear-gradient(135deg, var(--navy-900) 0%, var(--brand-gold-dark) 100%)`,
          transform: `translateY(${parallaxOffset}px)`,
        }}
        role="img"
        aria-label="Vue aérienne de Kinshasa au coucher du soleil"
      />

      {/* Navy overlay */}
      <div className="absolute inset-0 bg-[rgba(15,23,42,0.65)]" />

      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-6 py-20 md:px-10 lg:px-20">
        <div className="relative max-w-3xl">
          <p className="mb-4 text-[13px] font-semibold uppercase tracking-[2px] text-[var(--brand-gold)]">
            UNE VILLE PLUS ORGANISÉE, DES RECETTES MIEUX MOBILISÉES
          </p>

          <h1 className="font-heading text-[40px] font-bold leading-tight text-white md:text-[56px] lg:text-[72px]">
            <span className="text-white">eLoyer </span>
            <span className="text-[var(--brand-gold)]">Kinshasa</span>
          </h1>

          <p className="mt-6 max-w-[600px] text-lg leading-relaxed text-[#cbd5e1] md:text-2xl">
            La plateforme numérique intégrée pour une gestion locative, un paiement sécurisé et une
            fiscalité maîtrisée.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {FEATURE_PILLS.map((pill) => (
              <FeaturePill key={pill.label} icon={pill.icon} label={pill.label} />
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              to={ROUTES.REGISTER}
              className="landing-btn-gold inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-gold)] px-8 py-4 text-base font-bold text-[var(--navy-900)]"
            >
              Commencer maintenant
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="landing-btn-outline-white inline-flex items-center justify-center gap-3 rounded-lg border-2 border-white px-8 py-4 text-base font-medium text-white transition-all"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white">
                <Play className="h-4 w-4 fill-white text-white" aria-hidden="true" />
              </span>
              Voir la vidéo de présentation
            </button>
          </div>
        </div>

        {/* Handwriting accent */}
        <p
          className="font-handwriting pointer-events-none absolute -bottom-4 right-4 hidden rotate-[-6deg] text-[42px] font-bold text-[var(--brand-gold)] lg:block"
          aria-hidden="true"
        >
          Kinshasa avance, ensemble.
        </p>
      </div>

      <Modal
        open={videoOpen}
        onOpenChange={setVideoOpen}
        title="Présentation eLoyer Kinshasa"
        size="xl"
        className="p-0"
      >
        <div className="aspect-video overflow-hidden rounded-lg">
          <iframe
            src="https://www.youtube.com/embed/placeholder"
            title="eLoyer Kinshasa — Présentation"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </Modal>
    </section>
  );
}
