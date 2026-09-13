import { Link } from 'react-router-dom';
import { Home, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES, getDashboardPathForRole } from '@/config/routes';

export function NotFound() {
  const { user } = useAuth();
  const dashboardPath = user ? getDashboardPathForRole(user.role) : ROUTES.HOME;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[var(--color-kinshasa-blue)] to-[var(--color-kinshasa-blue-dark)] px-4 text-white">
      <MapPin className="mb-4 h-12 w-12 text-[var(--color-kinshasa-gold)]" />
      <h1 className="font-heading text-6xl font-bold">404</h1>
      <p className="mt-2 text-xl font-medium">Page non trouvée</p>
      <p className="mt-2 max-w-md text-center text-blue-100">
        La page que vous recherchez n&apos;existe pas ou a été déplacée.
      </p>
      <Link to={dashboardPath} className="mt-8">
        <Button variant="secondary" leftIcon={<Home className="h-4 w-4" />}>
          {user ? 'Retour au tableau de bord' : 'Retour à l\'accueil'}
        </Button>
      </Link>
    </div>
  );
}
