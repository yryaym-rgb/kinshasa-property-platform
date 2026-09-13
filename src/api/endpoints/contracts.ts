import { supabase } from '@/config/supabase';
import type { PaginatedResponse, PaginationParams, ContractFormData } from '@/types';
import type { Contrat, InsertTables, UpdateTables } from '@/types/database.types';

export async function getContracts(
  filters?: { bailleurId?: string; locataireId?: string },
  params?: PaginationParams,
): Promise<PaginatedResponse<Contrat>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('contrats').select('*', { count: 'exact' });
  if (filters?.bailleurId) query = query.eq('bailleur_id', filters.bailleurId);
  if (filters?.locataireId) query = query.eq('locataire_id', filters.locataireId);

  const { data, error, count } = await query
    .order(params?.sortBy ?? 'created_at', { ascending: params?.sortOrder === 'asc' })
    .range(from, to);

  if (error) throw new Error(error.message);

  return {
    data: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getContractById(id: string): Promise<Contrat> {
  const { data, error } = await supabase.from('contrats').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createContract(
  bailleurId: string,
  form: ContractFormData,
): Promise<Contrat> {
  const insert: InsertTables<'contrats'> = {
    logement_id: form.logementId,
    bailleur_id: bailleurId,
    locataire_id: form.locataireId,
    date_debut: form.dateDebut,
    date_fin: form.dateFin,
    loyer_mensuel: form.loyerMensuel,
    depot_garantie: form.depotGarantie,
    currency: form.currency,
    payment_day: form.paymentDay,
    status: 'brouillon',
  };

  const { data, error } = await supabase.from('contrats').insert(insert).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateContract(id: string, updates: UpdateTables<'contrats'>): Promise<Contrat> {
  const { data, error } = await supabase.from('contrats').update(updates).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function terminateContract(id: string): Promise<Contrat> {
  return updateContract(id, {
    status: 'resilie',
    terminated_at: new Date().toISOString(),
  });
}
