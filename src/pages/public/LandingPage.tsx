import { Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardPathForRole } from '@/config/routes';
import { FullPageLoading } from '@/components/ui/LoadingSpinner';
import { Navbar } from '@/components/public/Navbar';
import { HeroSection } from '@/components/public/HeroSection';
import { SolutionsSection } from '@/components/public/SolutionsSection';
import { StatsSection } from '@/components/public/StatsSection';
import { TrustSection } from '@/components/public/TrustSection';
import { FeaturesSection } from '@/components/public/FeaturesSection';
import { CTASection } from '@/components/public/CTASection';
import { Footer } from '@/components/public/Footer';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1920&q=80';

export function LandingPage() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <FullPageLoading />;
  }

  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  return (
    <>
      <Helmet>
        <title>
          eLoyer Kinshasa — La plateforme numérique intégrée pour la gestion locative
        </title>
        <meta
          name="description"
          content="eLoyer Kinshasa connecte bailleurs, locataires, agences et administration fiscale dans un écosystème unique. Payez votre loyer, gérez vos biens, suivez vos recettes fiscales."
        />
        <meta property="og:title" content="eLoyer Kinshasa" />
        <meta
          property="og:description"
          content="La plateforme numérique intégrée pour une gestion locative, un paiement sécurisé et une fiscalité maîtrisée."
        />
        <meta property="og:image" content="/og-image.jpg" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href="https://eloyer-kinshasa.cd" />
        <html lang="fr" />
        <link rel="preload" as="image" href={HERO_IMAGE} />
      </Helmet>

      <div className="min-h-screen bg-white">
        <Navbar />
        <main id="main-content">
          <HeroSection />
          <SolutionsSection />
          <StatsSection />
          <TrustSection />
          <FeaturesSection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </>
  );
}
