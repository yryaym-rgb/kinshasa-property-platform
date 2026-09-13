import { supabase } from '@/config/supabase';
import type { PaginatedResponse, PaginationParams, PropertyFormData } from '@/types';
import type { Logement, InsertTables, UpdateTables } from '@/types/database.types';

export async function getProperties(
  bailleurId?: string,
  params?: PaginationParams,
): Promise<PaginatedResponse<Logement>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('logements').select('*', { count: 'exact' });

  if (bailleurId) query = query.eq('bailleur_id', bailleurId);

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

export async function getPropertyById(id: string): Promise<Logement> {
  const { data, error } = await supabase.from('logements').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createProperty(
  bailleurId: string,
  form: PropertyFormData,
): Promise<Logement> {
  const insert: InsertTables<'logements'> = {
    bailleur_id: bailleurId,
    type: form.type,
    commune: form.commune,
    address: form.address,
    quartier: form.quartier,
    avenue: form.avenue,
    parcelle: form.parcelle,
    loyer_mensuel: form.loyerMensuel,
    currency: form.currency,
    rooms: form.rooms,
    surface_m2: form.surfaceM2,
    description: form.description,
    status: 'disponible',
  };

  const { data, error } = await supabase.from('logements').insert(insert).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProperty(id: string, updates: UpdateTables<'logements'>): Promise<Logement> {
  const { data, error } = await supabase.from('logements').update(updates).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteProperty(id: string): Promise<void> {
  const { error } = await supabase.from('logements').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
