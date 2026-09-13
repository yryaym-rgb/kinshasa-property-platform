import { supabase } from '@/config/supabase';
import { generateTransactionReference } from '@/lib/utils';
import type { PaginatedResponse, PaginationParams, PaymentFormData } from '@/types';
import type { Paiement, InsertTables } from '@/types/database.types';

export async function getPayments(
  contratId?: string,
  params?: PaginationParams,
): Promise<PaginatedResponse<Paiement>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('paiements').select('*', { count: 'exact' });
  if (contratId) query = query.eq('contrat_id', contratId);

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

export async function getPaymentById(id: string): Promise<Paiement> {
  const { data, error } = await supabase.from('paiements').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createPayment(form: PaymentFormData): Promise<Paiement> {
  const insert: InsertTables<'paiements'> = {
    contrat_id: form.contratId,
    montant: form.montant,
    currency: form.currency,
    method: form.method,
    provider: form.provider,
    periode: form.periode,
    reference: generateTransactionReference(),
    status: 'en_attente',
  };

  const { data, error } = await supabase.from('paiements').insert(insert).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function confirmPayment(id: string, providerTransactionId: string): Promise<Paiement> {
  const { data, error } = await supabase
    .from('paiements')
    .update({
      status: 'complete',
      provider_transaction_id: providerTransactionId,
      paid_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
