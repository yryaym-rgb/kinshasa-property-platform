import { Link } from 'react-router-dom';
import { Building2, MoreVertical } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PropertyStatusBadge } from '@/components/properties/PropertyStatusBadge';
import { formatCDF } from '@/lib/utils';
import { formatPropertyAddress, formatPropertyTypeLabel } from '@/utils/propertyUtils';
import { ROUTES } from '@/config/routes';
import type { Logement } from '@/types/database.types';

interface PropertyCardProps {
  property: Logement;
  onEdit?: () => void;
  onCreateContract?: () => void;
  onArchive?: () => void;
}

export function PropertyCard({ property, onEdit, onCreateContract, onArchive }: PropertyCardProps) {
  const photo = property.photos?.[0];
  const detailUrl = ROUTES.BAILLEUR.PROPERTY_DETAIL.replace(':id', property.id);

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-lg">
      <Link to={detailUrl} className="block">
        <div className="relative aspect-[16/10] bg-[var(--color-muted)]">
          {photo ? (
            <img
              src={photo}
              alt={property.code}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Building2 className="h-12 w-12 text-[var(--color-muted-foreground)]" />
            </div>
          )}
          <div className="absolute right-2 top-2">
            <PropertyStatusBadge status={property.status} />
          </div>
        </div>
      </Link>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-mono text-[var(--color-muted-foreground)]">
              {property.code}
            </p>
            <Link to={detailUrl} className="hover:underline">
              <h3 className="mt-1 font-medium leading-snug">{formatPropertyAddress(property)}</h3>
            </Link>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {formatPropertyTypeLabel(property.type, property.rooms)}
            </p>
            <p className="mt-2 text-lg font-bold text-[var(--color-kinshasa-gold)]">
              {formatCDF(Number(property.loyer_mensuel))}
            </p>
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[180px] rounded-lg border border-[var(--color-border)] bg-white p-1 shadow-lg"
                sideOffset={4}
              >
                <DropdownMenu.Item
                  className="cursor-pointer rounded px-3 py-2 text-sm outline-none hover:bg-[var(--color-muted)]"
                  onSelect={onEdit}
                >
                  Modifier
                </DropdownMenu.Item>
                <DropdownMenu.Item className="cursor-pointer rounded px-3 py-2 text-sm outline-none hover:bg-[var(--color-muted)]" asChild>
                  <Link to={detailUrl}>Voir détails</Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cursor-pointer rounded px-3 py-2 text-sm outline-none hover:bg-[var(--color-muted)]"
                  onSelect={onCreateContract}
                >
                  Créer un contrat
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cursor-pointer rounded px-3 py-2 text-sm outline-none hover:bg-[var(--color-muted)]"
                  onSelect={onArchive}
                >
                  Archiver
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </CardContent>
    </Card>
  );
}
