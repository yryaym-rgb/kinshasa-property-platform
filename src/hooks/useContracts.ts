import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/config/supabase';
import { useBailleurId } from '@/hooks/useProperties';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useSupabaseMutation } from '@/hooks/useSupabaseMutation';
import {
  contractService,
  getContracts,
  getContractStats,
  type ContractFilters,
  type CreateContractInput,
  type UpdateContractInput,
  type RenewalTerms,
} from '@/services/contract/contractService';
import type { PaginationParams } from '@/types';

export function useContracts(
  params?: PaginationParams,
  filters?: ContractFilters,
  enabled = true,
) {
  const bailleurId = useBailleurId();
  const queryClient = useQueryClient();

  const query = useSupabaseQuery({
    queryKey: ['contracts', bailleurId, params, filters],
    queryFn: async () => {
      if (!bailleurId) throw new Error('Profil bailleur non trouvé');
      const [contracts, stats] = await Promise.all([
        getContracts(bailleurId, params, filters),
        getContractStats(bailleurId),
      ]);
      return { contracts, stats };
    },
    enabled: enabled && !!bailleurId,
  });

  useEffect(() => {
    if (!bailleurId) return;

    const channel = supabase
      .channel(`contracts-${bailleurId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contrats',
          filter: `bailleur_id=eq.${bailleurId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['contracts', bailleurId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bailleurId, queryClient]);

  return {
    contracts: query.data?.contracts.data ?? [],
    pagination: query.data?.contracts,
    stats: query.data?.stats,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateContract() {
  const bailleurId = useBailleurId();

  return useSupabaseMutation({
    mutationFn: (data: Omit<CreateContractInput, 'bailleurId'>) => {
      if (!bailleurId) throw new Error('Profil bailleur non trouvé');
      return contractService.createContract({ ...data, bailleurId });
    },
    invalidateKeys: [['contracts'], ['properties'], ['tenants'], ['landlord-dashboard']],
    successMessage: 'Contrat créé avec succès',
  });
}

export function useUpdateContract(contractId?: string) {
  return useSupabaseMutation({
    mutationFn: (data: UpdateContractInput) => {
      if (!contractId) throw new Error('Identifiant du contrat requis');
      return contractService.updateContract(contractId, data);
    },
    invalidateKeys: [['contracts'], ['contract', contractId]],
    successMessage: 'Contrat mis à jour',
  });
}

export function useTerminateContract() {
  return useSupabaseMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      contractService.terminateContract(id, reason),
    invalidateKeys: [['contracts'], ['properties'], ['landlord-dashboard']],
    successMessage: 'Contrat résilié',
  });
}

export function useRenewContract() {
  const bailleurId = useBailleurId();

  return useSupabaseMutation({
    mutationFn: ({ id, terms }: { id: string; terms: RenewalTerms }) => {
      if (!bailleurId) throw new Error('Profil bailleur non trouvé');
      return contractService.renewContract(id, terms, bailleurId);
    },
    invalidateKeys: [['contracts'], ['properties']],
    successMessage: 'Contrat renouvelé',
  });
}

export function useSendContractInvitation() {
  return useSupabaseMutation({
    mutationFn: (contractId: string) => contractService.sendContractInvitation(contractId),
    invalidateKeys: [['contracts'], ['contract']],
    successMessage: 'Invitation envoyée au locataire',
  });
}

export function useSignContract() {
  return useSupabaseMutation({
    mutationFn: ({ contractId, party }: { contractId: string; party: 'bailleur' | 'locataire' }) =>
      contractService.signContract(contractId, party),
    invalidateKeys: [['contracts'], ['contract']],
    successMessage: 'Signature enregistrée',
  });
}

export function useGenerateContractPdf() {
  return useSupabaseMutation({
    mutationFn: (contractId: string) => contractService.generateContractPdf(contractId),
    invalidateKeys: [['contract']],
    successMessage: 'PDF généré',
  });
}
