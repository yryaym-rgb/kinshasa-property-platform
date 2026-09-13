import { supabase } from '@/config/supabase';
import type { PaginatedResponse, PaginationParams } from '@/types';
import type { InsertTables, Json, Logement, UpdateTables } from '@/types/database.types';
import type { KinshasaCommune, PropertyStatus, PropertyType } from '@/types';
import {
  buildPropertyDocuments,
  type PropertyDocumentFile,
  type PropertyMetadata,
} from '@/utils/propertyUtils';

export interface PropertyFilters {
  status?: PropertyStatus | 'all';
  commune?: KinshasaCommune | 'all';
  type?: PropertyType | 'all';
  search?: string;
  sortBy?: 'created_at' | 'loyer_mensuel' | 'address';
  sortOrder?: 'asc' | 'desc';
}

export interface PropertyFormPayload {
  type: PropertyType;
  commune: KinshasaCommune;
  quartier?: string;
  avenue?: string;
  parcelle?: string;
  address: string;
  loyerMensuel: number;
  currency: 'CDF' | 'USD';
  rooms?: number;
  surfaceM2?: number;
  description?: string;
  status?: PropertyStatus;
  coordinates?: { lat: number; lng: number };
  photos?: string[];
  metadata?: PropertyMetadata;
  documentUploads?: PropertyDocumentFile[];
}

export interface LandlordDashboardStats {
  propertyCount: number;
  propertiesThisMonth: number;
  tenantCount: number;
  activeTenants: number;
  monthlyRentDue: number;
  monthlyRentCollected: number;
  taxPaidPercent: number;
  taxOutstanding: number;
  taxTotal: number;
}

function applyPropertyFilters<T extends { eq: Function; or: Function; order: Function }>(
  query: T,
  filters?: PropertyFilters,
): T {
  let q = query;
  if (filters?.status && filters.status !== 'all') {
    q = q.eq('status', filters.status);
  }
  if (filters?.commune && filters.commune !== 'all') {
    q = q.eq('commune', filters.commune);
  }
  if (filters?.type && filters.type !== 'all') {
    q = q.eq('type', filters.type);
  }
  if (filters?.search) {
    const term = `%${filters.search}%`;
    q = q.or(`code.ilike.${term},address.ilike.${term},avenue.ilike.${term},quartier.ilike.${term}`);
  }
  const sortBy = filters?.sortBy ?? 'created_at';
  const ascending = filters?.sortOrder === 'asc';
  return q.order(sortBy, { ascending });
}

export async function getProperties(
  bailleurId: string,
  params?: PaginationParams,
  filters?: PropertyFilters,
): Promise<PaginatedResponse<Logement>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 12;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('logements')
    .select('*', { count: 'exact' })
    .eq('bailleur_id', bailleurId);

  query = applyPropertyFilters(query, filters);

  const { data, error, count } = await query.range(from, to);
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
  form: PropertyFormPayload,
): Promise<Logement> {
  const documents = buildPropertyDocuments(form.metadata ?? {}, form.documentUploads ?? []);
  const insert: InsertTables<'logements'> = {
    bailleur_id: bailleurId,
    type: form.type,
    commune: form.commune,
    address: form.address,
    quartier: form.quartier ?? null,
    avenue: form.avenue ?? null,
    parcelle: form.parcelle ?? null,
    loyer_mensuel: form.loyerMensuel,
    currency: form.currency,
    rooms: form.rooms ?? null,
    surface_m2: form.surfaceM2 ?? null,
    description: form.description ?? null,
    coordinates: form.coordinates ?? null,
    photos: form.photos ?? [],
    documents: documents as Json,
    status: form.status ?? 'disponible',
  };

  const { data, error } = await supabase.from('logements').insert(insert).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProperty(
  id: string,
  form: Partial<PropertyFormPayload>,
): Promise<Logement> {
  const updates: UpdateTables<'logements'> = {};

  if (form.type) updates.type = form.type;
  if (form.commune) updates.commune = form.commune;
  if (form.address) updates.address = form.address;
  if (form.quartier !== undefined) updates.quartier = form.quartier;
  if (form.avenue !== undefined) updates.avenue = form.avenue;
  if (form.parcelle !== undefined) updates.parcelle = form.parcelle;
  if (form.loyerMensuel) updates.loyer_mensuel = form.loyerMensuel;
  if (form.currency) updates.currency = form.currency;
  if (form.rooms !== undefined) updates.rooms = form.rooms;
  if (form.surfaceM2 !== undefined) updates.surface_m2 = form.surfaceM2;
  if (form.description !== undefined) updates.description = form.description;
  if (form.status) updates.status = form.status;
  if (form.coordinates) updates.coordinates = form.coordinates;
  if (form.photos) updates.photos = form.photos;

  if (form.metadata || form.documentUploads) {
    const existing = await getPropertyById(id);
    const current = (existing.documents as { metadata?: PropertyMetadata; uploads?: PropertyDocumentFile[] }) ?? {};
    updates.documents = buildPropertyDocuments(
      form.metadata ?? current.metadata ?? {},
      form.documentUploads ?? current.uploads ?? [],
    ) as Json;
  }

  const { data, error } = await supabase.from('logements').update(updates).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function archiveProperty(id: string): Promise<Logement> {
  return updateProperty(id, { status: 'inactif' });
}

export async function getPropertyContracts(propertyId: string) {
  const { data, error } = await supabase
    .from('contrats')
    .select('*, locataire:users!contrats_locataire_id_fkey(id, full_name, phone, avatar_url)')
    .eq('logement_id', propertyId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPropertyPayments(propertyId: string) {
  const { data, error } = await supabase
    .from('paiements')
    .select(`
      *,
      contrat:contrats!inner(
        id, logement_id,
        locataire:users!contrats_locataire_id_fkey(full_name, phone)
      ),
      recu:recus(code)
    `)
    .eq('contrat.logement_id', propertyId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLandlordDashboardStats(bailleurId: string): Promise<LandlordDashboardStats> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [propertiesRes, contractsRes, paymentsRes, taxesRes] = await Promise.all([
    supabase.from('logements').select('id, created_at, loyer_mensuel, is_occupied').eq('bailleur_id', bailleurId),
    supabase.from('contrats').select('id, locataire_id, status').eq('bailleur_id', bailleurId).eq('status', 'actif'),
    supabase
      .from('paiements')
      .select('montant, status, paid_at, contrat:contrats!inner(bailleur_id)')
      .eq('contrat.bailleur_id', bailleurId)
      .eq('status', 'complete')
      .gte('paid_at', monthStart),
    supabase
      .from('impots')
      .select('montant, status, contrat:contrats!inner(bailleur_id)')
      .eq('contrat.bailleur_id', bailleurId)
      .eq('periode', period),
  ]);

  if (propertiesRes.error) throw new Error(propertiesRes.error.message);
  if (contractsRes.error) throw new Error(contractsRes.error.message);
  if (paymentsRes.error) throw new Error(paymentsRes.error.message);
  if (taxesRes.error) throw new Error(taxesRes.error.message);

  const properties = propertiesRes.data ?? [];
  const contracts = contractsRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const taxes = taxesRes.data ?? [];

  const propertiesThisMonth = properties.filter((p) => p.created_at >= monthStart).length;
  const activeTenants = new Set(contracts.map((c) => c.locataire_id)).size;
  const monthlyRentDue = properties
    .filter((p) => p.is_occupied)
    .reduce((sum, p) => sum + Number(p.loyer_mensuel), 0);
  const monthlyRentCollected = payments.reduce((sum, p) => sum + Number(p.montant), 0);

  const taxTotal = taxes.reduce((sum, t) => sum + Number(t.montant), 0);
  const taxPaid = taxes.filter((t) => t.status === 'paye').reduce((sum, t) => sum + Number(t.montant), 0);
  const taxOutstanding = taxTotal - taxPaid;
  const taxPaidPercent = taxTotal > 0 ? Math.round((taxPaid / taxTotal) * 100) : 0;

  return {
    propertyCount: properties.length,
    propertiesThisMonth,
    tenantCount: activeTenants,
    activeTenants,
    monthlyRentDue,
    monthlyRentCollected,
    taxPaidPercent,
    taxOutstanding,
    taxTotal,
  };
}

export async function getRecentPayments(bailleurId: string, limit = 5) {
  const { data, error } = await supabase
    .from('paiements')
    .select(`
      *,
      contrat:contrats!inner(
        bailleur_id,
        logement:logements(code, address, type, rooms),
        locataire:users!contrats_locataire_id_fkey(full_name)
      ),
      recu:recus(code)
    `)
    .eq('contrat.bailleur_id', bailleurId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function uploadPropertyPhoto(
  bailleurId: string,
  propertyId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${bailleurId}/${propertyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('property-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('property-photos').getPublicUrl(path);
  return data.publicUrl;
}
