import { PropertyCard } from '@/components/properties/PropertyCard';
import { PropertyGridSkeleton } from '@/components/common/SkeletonLoaders';
import { EmptyState } from '@/components/ui/EmptyState';
import { Building2 } from 'lucide-react';
import type { Logement } from '@/types/database.types';

interface PropertyGridProps {
  properties: Logement[];
  loading?: boolean;
  onEdit?: (property: Logement) => void;
  onCreateContract?: (property: Logement) => void;
  onArchive?: (property: Logement) => void;
}

export function PropertyGrid({
  properties,
  loading,
  onEdit,
  onCreateContract,
  onArchive,
}: PropertyGridProps) {
  if (loading) return <PropertyGridSkeleton />;

  if (properties.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="h-12 w-12" />}
        title="Ajoutez votre premier logement"
        description="Commencez par enregistrer vos biens immobiliers pour gérer vos locataires et loyers."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <PropertyCard
          key={property.id}
          property={property}
          onEdit={() => onEdit?.(property)}
          onCreateContract={() => onCreateContract?.(property)}
          onArchive={() => onArchive?.(property)}
        />
      ))}
    </div>
  );
}
