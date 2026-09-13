import { useBailleurId } from '@/hooks/useProperties';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { getContractById } from '@/services/contract/contractService';

export function useContract(contractId?: string) {
  const bailleurId = useBailleurId();

  const query = useSupabaseQuery({
    queryKey: ['contract', bailleurId, contractId],
    queryFn: () => {
      if (!contractId) throw new Error('Identifiant du contrat requis');
      return getContractById(contractId);
    },
    enabled: !!bailleurId && !!contractId,
  });

  return {
    contract: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
