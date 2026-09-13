import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useBailleurId } from '@/hooks/useProperties';
import { supabase } from '@/config/supabase';

export interface TenantWithContract {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  commune: string | null;
  contract_id: string;
  contract_status: string;
  contract_code: string;
  logement_id: string;
  logement_code: string;
  logement_address: string;
  logement_commune: string;
  loyer_mensuel: number;
  payment_status: 'a_jour' | 'en_retard';
}

export interface TenantFilters {
  commune?: string;
  status?: 'all' | 'a_jour' | 'en_retard';
  propertyId?: string;
  search?: string;
}

async function fetchTenants(bailleurId: string, filters?: TenantFilters): Promise<TenantWithContract[]> {
  let query = supabase
    .from('contrats')
    .select(`
      id, code, status, loyer_mensuel,
      locataire:users!contrats_locataire_id_fkey(id, full_name, phone, email, avatar_url, commune),
      logement:logements!inner(id, code, address, commune, bailleur_id)
    `)
    .eq('bailleur_id', bailleurId)
    .in('status', ['actif', 'suspendu']);

  if (filters?.propertyId) {
    query = query.eq('logement_id', filters.propertyId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const tenants: TenantWithContract[] = [];
  for (const row of data ?? []) {
    const locataire = row.locataire as {
      id: string;
      full_name: string;
      phone: string;
      email: string | null;
      avatar_url: string | null;
      commune: string | null;
    };
    const logement = row.logement as {
      id: string;
      code: string;
      address: string;
      commune: string;
    };

    if (filters?.commune && filters.commune !== 'all' && logement.commune !== filters.commune) {
      continue;
    }

    if (filters?.search) {
      const term = filters.search.toLowerCase();
      const matches =
        locataire.full_name.toLowerCase().includes(term) ||
        locataire.phone.includes(term);
      if (!matches) continue;
    }

    const { data: payments } = await supabase
      .from('paiements')
      .select('status')
      .eq('contrat_id', row.id)
      .eq('periode', period)
      .eq('status', 'complete')
      .limit(1);

    const paymentStatus: 'a_jour' | 'en_retard' =
      payments && payments.length > 0 ? 'a_jour' : 'en_retard';

    if (filters?.status && filters.status !== 'all' && filters.status !== paymentStatus) {
      continue;
    }

    tenants.push({
      id: locataire.id,
      full_name: locataire.full_name,
      phone: locataire.phone,
      email: locataire.email,
      avatar_url: locataire.avatar_url,
      commune: locataire.commune,
      contract_id: row.id,
      contract_status: row.status,
      contract_code: row.code,
      logement_id: logement.id,
      logement_code: logement.code,
      logement_address: logement.address,
      logement_commune: logement.commune,
      loyer_mensuel: Number(row.loyer_mensuel),
      payment_status: paymentStatus,
    });
  }

  return tenants;
}

export function useTenants(filters?: TenantFilters) {
  const bailleurId = useBailleurId();

  return useSupabaseQuery({
    queryKey: ['tenants', bailleurId, filters],
    queryFn: () => {
      if (!bailleurId) throw new Error('Profil bailleur non trouvé');
      return fetchTenants(bailleurId, filters);
    },
    enabled: !!bailleurId,
  });
}

export async function getTenantDetail(bailleurId: string, tenantId: string) {
  const { data: contract, error } = await supabase
    .from('contrats')
    .select(`
      *,
      locataire:users!contrats_locataire_id_fkey(*),
      logement:logements(*)
    `)
    .eq('bailleur_id', bailleurId)
    .eq('locataire_id', tenantId)
    .eq('status', 'actif')
    .maybeSingle();

  if (error) throw new Error(error.message);

  const { data: payments } = await supabase
    .from('paiements')
    .select('*, recu:recus(code)')
    .eq('contrat_id', contract?.id ?? '')
    .order('created_at', { ascending: false });

  return { contract, payments: payments ?? [] };
}

export function useTenantDetail(tenantId: string | undefined) {
  const bailleurId = useBailleurId();

  return useSupabaseQuery({
    queryKey: ['tenant', bailleurId, tenantId],
    queryFn: () => {
      if (!bailleurId || !tenantId) throw new Error('Données manquantes');
      return getTenantDetail(bailleurId, tenantId);
    },
    enabled: !!bailleurId && !!tenantId,
  });
}
