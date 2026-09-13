import { supabase } from '@/config/supabase';
import type { PaginatedResponse, PaginationParams } from '@/types';
import type { Contrat, InsertTables, Json, UpdateTables, User, Logement, Bailleur, Paiement } from '@/types/database.types';
import type { CreateContractFormData, RenewContractFormData } from '@/components/contracts/schema';

export interface ContractTermsMetadata {
  chargesMensuelles?: number;
  paymentFrequency?: 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel';
  conditionsParticulieres?: string;
  addendums?: Array<{ name: string; url: string; path: string }>;
  sentToTenantAt?: string;
  terminationReason?: string;
  renewedFromId?: string;
}

export interface ContractFilters {
  status?: string;
  commune?: string;
  propertyId?: string;
  search?: string;
  dateStart?: string;
  dateEnd?: string;
}

export interface ContractWithRelations extends Contrat {
  locataire?: Pick<User, 'id' | 'full_name' | 'phone' | 'email' | 'avatar_url' | 'kyc_status'>;
  logement?: Pick<Logement, 'id' | 'code' | 'address' | 'commune' | 'loyer_mensuel' | 'currency' | 'photos' | 'status'>;
  bailleur?: Bailleur & { user?: Pick<User, 'id' | 'full_name' | 'phone' | 'email'> };
  paiements?: Paiement[];
}

export interface ContractStats {
  activeCount: number;
  monthlyRevenue: number;
  expiringIn30Days: number;
  unpaidCount: number;
}

export interface CreateContractInput extends Omit<CreateContractFormData, 'certifie'> {
  bailleurId: string;
}

export interface UpdateContractInput {
  dateDebut?: string;
  dateFin?: string;
  loyerMensuel?: number;
  depotGarantie?: number;
  paymentDay?: number;
  terms?: ContractTermsMetadata;
  notesInternes?: string;
}

export interface RenewalTerms extends RenewContractFormData {}

async function createAuditLog(
  userId: string | null,
  action: string,
  entityId: string,
  oldData?: Json,
  newData?: Json,
) {
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
    entity_type: 'contrat',
    entity_id: entityId,
    old_data: oldData ?? null,
    new_data: newData ?? null,
  });
}

async function createNotification(
  userId: string,
  title: string,
  message: string,
  type = 'info',
  metadata?: Json,
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    metadata: metadata ?? null,
  });
}

function buildTermsPayload(input: Partial<CreateContractInput>): ContractTermsMetadata {
  return {
    chargesMensuelles: input.chargesMensuelles ?? 0,
    paymentFrequency: input.paymentFrequency ?? 'mensuel',
    conditionsParticulieres: input.conditionsParticulieres,
    addendums: input.addendums,
  };
}

export async function getContracts(
  bailleurId: string,
  params?: PaginationParams,
  filters?: ContractFilters,
): Promise<PaginatedResponse<ContractWithRelations>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('contrats')
    .select(
      `
      *,
      locataire:users!contrats_locataire_id_fkey(id, full_name, phone, email, avatar_url, kyc_status),
      logement:logements!inner(id, code, address, commune, loyer_mensuel, currency, photos, status, bailleur_id)
    `,
      { count: 'exact' },
    )
    .eq('bailleur_id', bailleurId);

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status as Contrat['status']);
  }
  if (filters?.propertyId) {
    query = query.eq('logement_id', filters.propertyId);
  }
  if (filters?.commune) {
    query = query.eq('logement.commune', filters.commune);
  }
  if (filters?.dateStart) {
    query = query.gte('date_debut', filters.dateStart);
  }
  if (filters?.dateEnd) {
    query = query.lte('date_fin', filters.dateEnd);
  }

  const sortBy = params?.sortBy ?? 'created_at';
  const ascending = params?.sortOrder === 'asc';
  query = query.order(sortBy, { ascending });

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);

  let contracts = (data ?? []) as ContractWithRelations[];

  if (filters?.search) {
    const term = filters.search.toLowerCase();
    contracts = contracts.filter(
      (c) =>
        c.code.toLowerCase().includes(term) ||
        c.locataire?.full_name.toLowerCase().includes(term) ||
        c.locataire?.phone.includes(term),
    );
  }

  return {
    data: contracts,
    total: count ?? contracts.length,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getContractById(id: string): Promise<ContractWithRelations> {
  const { data, error } = await supabase
    .from('contrats')
    .select(
      `
      *,
      locataire:users!contrats_locataire_id_fkey(id, full_name, phone, email, avatar_url, kyc_status),
      logement:logements(id, code, address, commune, loyer_mensuel, currency, photos, status),
      bailleur:bailleurs(id, business_name, tax_id, user_id, user:users!bailleurs_user_id_fkey(id, full_name, phone, email))
    `,
    )
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);

  const { data: paiements } = await supabase
    .from('paiements')
    .select('*')
    .eq('contrat_id', id)
    .order('created_at', { ascending: false });

  return { ...(data as ContractWithRelations), paiements: paiements ?? [] };
}

export async function getContractStats(bailleurId: string): Promise<ContractStats> {
  const { data: activeContracts, error } = await supabase
    .from('contrats')
    .select('id, loyer_mensuel, date_fin, status')
    .eq('bailleur_id', bailleurId)
    .eq('status', 'actif');

  if (error) throw new Error(error.message);

  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(now.getDate() + 30);

  const activeCount = activeContracts?.length ?? 0;
  const monthlyRevenue = (activeContracts ?? []).reduce((sum, c) => sum + Number(c.loyer_mensuel), 0);
  const expiringIn30Days = (activeContracts ?? []).filter((c) => {
    if (!c.date_fin) return false;
    const end = new Date(c.date_fin);
    return end >= now && end <= in30Days;
  }).length;

  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let unpaidCount = 0;
  for (const contract of activeContracts ?? []) {
    const { data: payments } = await supabase
      .from('paiements')
      .select('id')
      .eq('contrat_id', contract.id)
      .eq('periode', period)
      .eq('status', 'complete')
      .limit(1);
    if (!payments?.length) unpaidCount++;
  }

  return { activeCount, monthlyRevenue, expiringIn30Days, unpaidCount };
}

export async function getExpiringContracts(bailleurId: string, daysAhead = 30): Promise<ContractWithRelations[]> {
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);
  const today = formatDate(new Date());

  const { data, error } = await supabase
    .from('contrats')
    .select(
      `
      *,
      locataire:users!contrats_locataire_id_fkey(id, full_name, phone, email, avatar_url),
      logement:logements(id, code, address, commune)
    `,
    )
    .eq('bailleur_id', bailleurId)
    .eq('status', 'actif')
    .gte('date_fin', today)
    .lte('date_fin', formatDate(future));

  if (error) throw new Error(error.message);
  return (data ?? []) as ContractWithRelations[];
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0] ?? '';
}

export async function createTenantUser(input: {
  phone: string;
  fullName: string;
  email?: string;
  address?: string;
}): Promise<User> {
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('phone', input.phone)
    .maybeSingle();

  if (existing) return existing;

  const id = crypto.randomUUID();
  const profile: InsertTables<'users'> = {
    id,
    phone: input.phone,
    full_name: input.fullName,
    email: input.email || null,
    address: input.address || null,
    role: 'locataire',
    kyc_status: 'pending',
    is_active: true,
  };

  const { data, error } = await supabase.from('users').insert(profile).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function searchTenantsForBailleur(bailleurId: string, search: string) {
  const { data: contracts, error } = await supabase
    .from('contrats')
    .select(`
      locataire:users!contrats_locataire_id_fkey(id, full_name, phone, email, avatar_url)
    `)
    .eq('bailleur_id', bailleurId);

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const tenants: Array<Pick<User, 'id' | 'full_name' | 'phone' | 'email' | 'avatar_url'>> = [];
  const term = search.toLowerCase();

  for (const row of contracts ?? []) {
    const loc = row.locataire as Pick<User, 'id' | 'full_name' | 'phone' | 'email' | 'avatar_url'> | null;
    if (!loc || seen.has(loc.id)) continue;
    if (
      !search ||
      loc.full_name.toLowerCase().includes(term) ||
      loc.phone.includes(search)
    ) {
      seen.add(loc.id);
      tenants.push(loc);
    }
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, phone, email, avatar_url')
    .eq('role', 'locataire')
    .or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
    .limit(20);

  for (const user of users ?? []) {
    if (!seen.has(user.id)) {
      seen.add(user.id);
      tenants.push(user);
    }
  }

  return tenants;
}

export const contractService = {
  async createContract(data: CreateContractInput, userId?: string): Promise<Contrat> {
    const terms = buildTermsPayload(data);
    const signatureToken = crypto.randomUUID();

    const insert: InsertTables<'contrats'> & {
      metadata?: Json;
      signature_token?: string;
    } = {
      logement_id: data.logementId,
      bailleur_id: data.bailleurId,
      locataire_id: data.locataireId,
      date_debut: data.dateDebut,
      date_fin: data.dateFin,
      loyer_mensuel: data.loyerMensuel,
      depot_garantie: data.depotGarantie,
      currency: data.currency,
      payment_day: data.paymentDay,
      status: 'brouillon',
      terms: terms as Json,
      metadata: terms as Json,
      signature_token: signatureToken,
    };

    const { data: contract, error } = await supabase
      .from('contrats')
      .insert(insert)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await supabase
      .from('logements')
      .update({ status: 'occupe', is_occupied: true })
      .eq('id', data.logementId);

    await createAuditLog(userId ?? null, 'contract_created', contract.id, null, contract as Json);

    const { data: bailleur } = await supabase
      .from('bailleurs')
      .select('user:users!bailleurs_user_id_fkey(full_name)')
      .eq('id', data.bailleurId)
      .single();

    const bailleurName =
      (bailleur?.user as { full_name?: string } | null)?.full_name ?? 'Votre bailleur';

    await createNotification(
      data.locataireId,
      'Nouveau contrat de bail',
      `Un contrat de bail vous a été envoyé par ${bailleurName}. Cliquez pour voir et signer.`,
      'contract',
      { contractId: contract.id },
    );

    return contract;
  },

  async updateContract(id: string, data: UpdateContractInput, userId?: string): Promise<Contrat> {
    const existing = await getContractById(id);

    const updates: UpdateTables<'contrats'> & { notes_internes?: string } = {};
    if (data.dateDebut) updates.date_debut = data.dateDebut;
    if (data.dateFin !== undefined) updates.date_fin = data.dateFin;
    if (data.loyerMensuel) updates.loyer_mensuel = data.loyerMensuel;
    if (data.depotGarantie !== undefined) updates.depot_garantie = data.depotGarantie;
    if (data.paymentDay) updates.payment_day = data.paymentDay;
    if (data.terms) updates.terms = data.terms as Json;
    if (data.notesInternes !== undefined) {
      (updates as { notes_internes?: string }).notes_internes = data.notesInternes;
    }

    const { data: contract, error } = await supabase
      .from('contrats')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await createAuditLog(userId ?? null, 'contract_updated', id, existing as unknown as Json, contract as unknown as Json);
    return contract;
  },

  async terminateContract(id: string, reason: string, userId?: string): Promise<void> {
    const existing = await getContractById(id);
    const today = formatDate(new Date());

    const { error } = await supabase
      .from('contrats')
      .update({
        status: 'resilie',
        date_fin: today,
        terminated_at: new Date().toISOString(),
        terms: {
          ...getContractTerms(existing),
          terminationReason: reason,
        } as Json,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);

    if (existing.logement_id) {
      await supabase
        .from('logements')
        .update({ status: 'disponible', is_occupied: false })
        .eq('id', existing.logement_id);
    }

    await createNotification(
      existing.locataire_id,
      'Contrat résilié',
      `Le contrat ${existing.code} a été résilié. Motif : ${reason}`,
      'contract',
      { contractId: id },
    );

    if (existing.bailleur?.user_id) {
      await createNotification(
        existing.bailleur.user_id,
        'Contrat résilié',
        `Le contrat ${existing.code} a été résilié.`,
        'contract',
        { contractId: id },
      );
    }

    await createAuditLog(userId ?? null, 'contract_terminated', id, existing as unknown as Json, { reason } as Json);
  },

  async renewContract(id: string, newTerms: RenewalTerms, bailleurId: string, userId?: string): Promise<Contrat> {
    const existing = await getContractById(id);

    return contractService.createContract(
      {
        bailleurId,
        logementId: existing.logement_id,
        locataireId: existing.locataire_id,
        dateDebut: newTerms.dateDebut,
        dateFin: newTerms.dateFin,
        dureeMois: newTerms.dureeMois,
        loyerMensuel: newTerms.loyerMensuel,
        chargesMensuelles: newTerms.chargesMensuelles,
        depotGarantie: newTerms.depotGarantie,
        currency: existing.currency as 'CDF' | 'USD',
        paymentDay: newTerms.paymentDay,
        paymentFrequency: newTerms.paymentFrequency,
        conditionsParticulieres: newTerms.conditionsParticulieres,
      },
      userId,
    );
  },

  async sendContractInvitation(contractId: string, userId?: string): Promise<void> {
    const contract = await getContractById(contractId);
    const signingLink = `${window.location.origin}/locataire/contrats?sign=${contract.signature_token ?? contractId}`;

    const terms = getContractTerms(contract);
    const updatedTerms = { ...terms, sentToTenantAt: new Date().toISOString() };

    const { error } = await supabase
      .from('contrats')
      .update({
        status: 'en_attente_signature' as Contrat['status'],
        terms: updatedTerms as Json,
      })
      .eq('id', contractId);

    if (error) throw new Error(error.message);

    await createNotification(
      contract.locataire_id,
      'Contrat à signer',
      `Veuillez signer votre contrat de bail (${contract.code}). Lien : ${signingLink}`,
      'contract',
      { contractId, signingLink },
    );

    await createAuditLog(userId ?? null, 'contract_sent', contractId, null, { signingLink } as Json);
  },

  async signContract(contractId: string, party: 'bailleur' | 'locataire', userId?: string): Promise<void> {
    const contract = await getContractById(contractId);
    const now = new Date().toISOString();

    const updates: UpdateTables<'contrats'> & {
      signed_by_bailleur_at?: string;
      signed_by_locataire_at?: string;
    } = {};

    if (party === 'bailleur') {
      updates.signed_by_bailleur_at = now;
    } else {
      updates.signed_by_locataire_at = now;
    }

    const bailleurSigned = party === 'bailleur' ? now : contract.signed_by_bailleur_at;
    const locataireSigned = party === 'locataire' ? now : contract.signed_by_locataire_at;

    if (bailleurSigned && locataireSigned) {
      updates.status = 'actif';
      updates.signed_at = now;
    }

    const { error } = await supabase.from('contrats').update(updates).eq('id', contractId);
    if (error) throw new Error(error.message);

    const tenantName = contract.locataire?.full_name ?? 'Le locataire';
    const propertyCode = contract.logement?.code ?? 'le logement';

    if (party === 'locataire' && contract.bailleur?.user_id) {
      await createNotification(
        contract.bailleur.user_id,
        'Contrat signé',
        `${tenantName} a signé le contrat pour ${propertyCode}.`,
        'contract',
        { contractId },
      );
    }

    if (bailleurSigned && locataireSigned) {
      await createNotification(
        contract.locataire_id,
        'Contrat actif',
        'Votre contrat est maintenant actif.',
        'contract',
        { contractId },
      );
      if (contract.bailleur?.user_id) {
        await createNotification(
          contract.bailleur.user_id,
          'Contrat actif',
          'Votre contrat est maintenant actif.',
          'contract',
          { contractId },
        );
      }
    }

    await createAuditLog(userId ?? null, `contract_signed_${party}`, contractId, null, updates as Json);
  },

  async generateContractPdf(contractId: string): Promise<string> {
    const contract = await getContractById(contractId);
    const pdfUrl = `https://storage.eloyer.cd/contracts/${contract.code}.pdf`;

    await supabase.from('contrats').update({ pdf_url: pdfUrl }).eq('id', contractId);
    return pdfUrl;
  },

  getContractStats,
  getExpiringContracts,
};

function getContractTerms(contract: Contrat): ContractTermsMetadata {
  return (contract.terms ?? {}) as ContractTermsMetadata;
}
