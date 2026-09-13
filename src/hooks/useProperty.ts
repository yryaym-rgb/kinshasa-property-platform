import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import {
  getPropertyById,
  getPropertyContracts,
  getPropertyPayments,
} from '@/services/property/propertyService';

export function useProperty(propertyId: string | undefined) {
  return useSupabaseQuery({
    queryKey: ['property', propertyId],
    queryFn: () => {
      if (!propertyId) throw new Error('Identifiant du logement requis');
      return getPropertyById(propertyId);
    },
    enabled: !!propertyId,
  });
}

export function usePropertyContracts(propertyId: string | undefined) {
  return useSupabaseQuery({
    queryKey: ['property-contracts', propertyId],
    queryFn: () => {
      if (!propertyId) throw new Error('Identifiant du logement requis');
      return getPropertyContracts(propertyId);
    },
    enabled: !!propertyId,
  });
}

export function usePropertyPayments(propertyId: string | undefined) {
  return useSupabaseQuery({
    queryKey: ['property-payments', propertyId],
    queryFn: () => {
      if (!propertyId) throw new Error('Identifiant du logement requis');
      return getPropertyPayments(propertyId);
    },
    enabled: !!propertyId,
  });
}
