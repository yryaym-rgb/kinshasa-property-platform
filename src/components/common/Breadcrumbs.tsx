import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

const ROUTE_LABELS: Record<string, string> = {
  bailleur: 'Bailleur',
  locataire: 'Locataire',
  admin: 'Administration',
  fiscal: 'Fiscalité',
  'tableau-de-bord': 'Tableau de bord',
  biens: 'Mes biens',
  locataires: 'Locataires',
  contrats: 'Contrats',
  paiements: 'Paiements',
  recus: 'Reçus',
  fiscalite: 'Fiscalité',
  rapports: 'Rapports',
  profil: 'Profil',
  accueil: 'Accueil',
  notifications: 'Notifications',
  contribuables: 'Contribuables',
  declarations: 'Déclarations',
  recettes: 'Recettes',
  controles: 'Contrôles',
  parametres: 'Paramètres',
  rapprochements: 'Rapprochements',
};

export function Breadcrumbs({ items }: { items?: BreadcrumbItem[] }) {
  const location = useLocation();

  const breadcrumbs: BreadcrumbItem[] = items ?? (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => ({
      label: ROUTE_LABELS[segment] ?? segment,
      href: index < segments.length - 1 ? `/${segments.slice(0, index + 1).join('/')}` : undefined,
    }));
  })();

  return (
    <nav aria-label="Fil d'Ariane" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-[var(--color-muted-foreground)]">
        <li>
          <Link to="/" className="flex items-center hover:text-[var(--color-primary)]">
            <Home className="h-4 w-4" />
          </Link>
        </li>
        {breadcrumbs.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4" />
            {item.href ? (
              <Link to={item.href} className="hover:text-[var(--color-primary)]">
                {item.label}
              </Link>
            ) : (
              <span className={cn('font-medium text-[var(--color-foreground)]')}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
