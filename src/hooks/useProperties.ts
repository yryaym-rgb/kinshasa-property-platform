import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useSupabaseMutation } from '@/hooks/useSupabaseMutation';
import {
  archiveProperty,
  createProperty,
  getProperties,
  type PropertyFilters,
  type PropertyFormPayload,
  updateProperty,
} from '@/services/property/propertyService';
import type { PaginationParams } from '@/types';

export function useBailleurId(): string | undefined {
  const { user } = useAuth();
  return user?.bailleur?.id;
}

export function useProperties(
  params?: PaginationParams,
  filters?: PropertyFilters,
  enabled = true,
) {
  const bailleurId = useBailleurId();

  return useSupabaseQuery({
    queryKey: ['properties', bailleurId, params, filters],
    queryFn: () => {
      if (!bailleurId) throw new Error('Profil bailleur non trouvé');
      return getProperties(bailleurId, params, filters);
    },
    enabled: enabled && !!bailleurId,
  });
}

export function useCreateProperty() {
  const bailleurId = useBailleurId();

  return useSupabaseMutation({
    mutationFn: (form: PropertyFormPayload) => {
      if (!bailleurId) throw new Error('Profil bailleur non trouvé');
      return createProperty(bailleurId, form);
    },
    invalidateKeys: [['properties'], ['landlord-dashboard']],
    successMessage: 'Logement créé avec succès',
  });
}

export function useUpdateProperty(propertyId?: string) {
  return useSupabaseMutation({
    mutationFn: (form: Partial<PropertyFormPayload>) => {
      if (!propertyId) throw new Error('Identifiant du logement requis');
      return updateProperty(propertyId, form);
    },
    invalidateKeys: [['properties'], ['property', propertyId], ['landlord-dashboard']],
    successMessage: 'Logement mis à jour avec succès',
  });
}

export function useArchiveProperty() {
  return useSupabaseMutation({
    mutationFn: (id: string) => archiveProperty(id),
    invalidateKeys: [['properties'], ['landlord-dashboard']],
    successMessage: 'Logement archivé',
  });
}
