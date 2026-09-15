import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardPathForRole } from '@/config/routes';
import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { StatsBar } from '@/components/landing/StatsBar';

const SolutionsGrid = lazy(() =>
  import('@/components/landing/SolutionsGrid').then((m) => ({ default: m.SolutionsGrid })),
);
const ProcessTimeline = lazy(() =>
  import('@/components/landing/ProcessTimeline').then((m) => ({ default: m.ProcessTimeline })),
);
const BenefitsSection = lazy(() =>
  import('@/components/landing/BenefitsSection').then((m) => ({ default: m.BenefitsSection })),
);
const TestimonialsSection = lazy(() =>
  import('@/components/landing/TestimonialsSection').then((m) => ({ default: m.TestimonialsSection })),
);
const CTASection = lazy(() => import('@/components/landing/CTASection').then((m) => ({ default: m.CTASection })));
const Footer = lazy(() => import('@/components/landing/Footer').then((m) => ({ default: m.Footer })));

/** Reserves vertical space while a below-the-fold section streams in, keeping CLS near zero. */
function SectionFallback({ height, dark = false }: { height: number; dark?: boolean }) {
  return <div aria-hidden="true" style={{ minHeight: height }} className={dark ? 'bg-drc-navy' : 'bg-white'} />;
}

export function LandingPage() {
  const { isAuthenticated, user } = useAuth();

  // The public page paints immediately; we never block first paint on the
  // session check. Signed-in visitors are redirected as soon as it resolves.
  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  return (
    <>
      <Helmet>
        <html lang="fr" />
        <title>eLoyer Kinshasa — La plateforme officielle de gestion locative</title>
        <meta
          name="description"
          content="eLoyer Kinshasa connecte bailleurs, locataires, agences et administration fiscale. Payez votre loyer, gérez vos biens, mobilisez les recettes fiscales."
        />
        <meta property="og:title" content="eLoyer Kinshasa" />
        <meta
          property="og:description"
          content="La plateforme officielle de gestion locative et fiscale de la Ville de Kinshasa."
        />
        <meta property="og:image" content="https://eloyer-kinshasa.cd/og-image.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#0A1628" />
        <link rel="canonical" href="https://eloyer-kinshasa.cd" />
      </Helmet>

      <div className="lp">
        <Navbar />
        <main id="main-content" tabIndex={-1}>
          <Hero />
          <StatsBar />
          <Suspense fallback={<SectionFallback height={900} />}>
            <SolutionsGrid />
          </Suspense>
          <Suspense fallback={<SectionFallback height={700} />}>
            <ProcessTimeline />
          </Suspense>
          <Suspense fallback={<SectionFallback height={800} />}>
            <BenefitsSection />
          </Suspense>
          <Suspense fallback={<SectionFallback height={640} dark />}>
            <TestimonialsSection />
          </Suspense>
          <Suspense fallback={<SectionFallback height={480} />}>
            <CTASection />
          </Suspense>
        </main>
        <Suspense fallback={<SectionFallback height={520} dark />}>
          <Footer />
        </Suspense>
      </div>
    </>
  );
}
