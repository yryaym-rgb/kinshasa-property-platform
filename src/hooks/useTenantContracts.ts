import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/config/supabase';
import type { TenantContractWithRelations } from './useTenantDashboard';

export function useTenantContracts() {
  const { user } = useAuth();

  return useSupabaseQuery<TenantContractWithRelations[]>({
    queryKey: ['tenant-contracts', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      const { data, error } = await supabase
        .from('contrats')
        .select(`
          *,
          logement:logements(id, code, address, commune, type, rooms, loyer_mensuel),
          bailleur:bailleurs(id, business_name, user:users!bailleurs_user_id_fkey(full_name, phone, email))
        `)
        .eq('locataire_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []) as TenantContractWithRelations[];
    },
    enabled: !!user?.id,
  });
}

export function useTenantContractDetail(contractId?: string) {
  const { user } = useAuth();

  return useSupabaseQuery({
    queryKey: ['tenant-contract', contractId, user?.id],
    queryFn: async () => {
      if (!user?.id || !contractId) throw new Error('Contrat introuvable');
      const { data: contract, error } = await supabase
        .from('contrats')
        .select(`
          *,
          logement:logements(*),
          bailleur:bailleurs(id, business_name, tax_id, user:users!bailleurs_user_id_fkey(full_name, phone, email))
        `)
        .eq('id', contractId)
        .eq('locataire_id', user.id)
        .single();

      if (error) throw new Error(error.message);

      const { data: payments } = await supabase
        .from('paiements')
        .select('*, recu:recus(code, id)')
        .eq('contrat_id', contractId)
        .order('created_at', { ascending: false });

      return { contract: contract as TenantContractWithRelations, payments: payments ?? [] };
    },
    enabled: !!user?.id && !!contractId,
  });
}
