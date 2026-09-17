import { supabase } from '@/config/supabase';
import type { PaginatedResponse, PaginationParams } from '@/types';
import type { Impot, RegleFiscale } from '@/types/database.types';

export async function getTaxes(
  filters?: { contratId?: string; status?: string },
  params?: PaginationParams,
): Promise<PaginatedResponse<Impot>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('impots').select('*', { count: 'exact' });
  if (filters?.contratId) query = query.eq('contrat_id', filters.contratId);
  if (filters?.status) query = query.eq('status', filters.status as Impot['status']);

  const { data, error, count } = await query
    .order(params?.sortBy ?? 'calculated_at', { ascending: params?.sortOrder === 'asc' })
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

export async function getTaxRules(): Promise<RegleFiscale[]> {
  const { data, error } = await supabase
    .from('regles_fiscales')
    .select('*')
    .eq('is_active', true)
    .order('priorite', { ascending: true })
    .order('date_debut', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function calculateTaxForPayment(paymentId: string): Promise<number> {
  const { data, error } = await supabase.rpc('calculate_tax_for_payment', {
    payment_id: paymentId,
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

export async function getComplianceScore(bailleurId: string): Promise<number> {
  const { data, error } = await supabase.rpc('check_compliance_score', {
    bailleur_id: bailleurId,
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}
