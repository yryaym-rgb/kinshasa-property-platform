import { supabase } from '@/config/supabase';
import { generateTransactionReference, sleep } from '@/lib/utils';
import { taxService } from '@/services/tax/taxService';
import { receiptService } from '@/services/receipt/receiptService';
import { getProvider, getAllProviders } from './providers';
import {
  type InitiatePaymentInput,
  type PaymentMethod,
  type PaymentResult,
  type PaymentStatus,
  providerIdToDbMethod,
  isMobileMoneyProvider,
} from './types';
import type { Paiement, InsertTables } from '@/types/database.types';

const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_DURATION_MS = 60000;

export const paymentService = {
  async initiatePayment(input: InitiatePaymentInput): Promise<PaymentResult> {
    const existing = await this.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.status === 'complete') {
        const receipt = await receiptService.getReceiptByPaymentId(existing.id);
        return {
          status: 'success',
          payment: { ...existing, receiptId: receipt?.id, receiptCode: receipt?.code },
          providerReference: existing.provider_transaction_id ?? undefined,
        };
      }
      if (existing.status === 'echoue') {
        return { status: 'failed', failureReason: existing.failure_reason ?? 'provider_error', payment: existing as Paiement };
      }
    }

    const { data: contract, error: contractError } = await supabase
      .from('contrats')
      .select('*, logement:logements(*)')
      .eq('id', input.contratId)
      .eq('locataire_id', input.tenantId)
      .eq('status', 'actif')
      .single();

    if (contractError || !contract) {
      throw new Error('Contrat introuvable ou inactif');
    }

    const paymentMethod = isMobileMoneyProvider(input.method)
      ? 'mobile_money'
      : input.method === 'card'
        ? 'card'
        : 'bank';

    const taxCalc = taxService.calculateTax({
      rentAmount: input.rentAmount,
      paymentMethod,
    });

    const reference = generateTransactionReference();
    const insert: InsertTables<'paiements'> & {
      idempotency_key?: string;
      tax_calculation?: Record<string, unknown>;
    } = {
      contrat_id: input.contratId,
      montant: input.amount,
      currency: input.currency,
      method: providerIdToDbMethod(input.method) as InsertTables<'paiements'>['method'],
      provider: getProvider(input.method).name,
      periode: input.periode,
      reference,
      status: 'en_cours',
      metadata: { phone: input.phone, provider_id: input.method },
      idempotency_key: input.idempotencyKey,
      tax_calculation: JSON.parse(JSON.stringify(taxCalc)),
    };

    const { data: payment, error: insertError } = await supabase
      .from('paiements')
      .insert(insert)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const dup = await this.findByIdempotencyKey(input.idempotencyKey);
        if (dup) return { status: 'pending', payment: dup };
      }
      throw new Error(insertError.message);
    }

    const provider = getProvider(input.method);
    const initResult = await provider.initiate({
      amount: input.amount,
      currency: input.currency,
      phone: input.phone,
      reference: payment.reference,
      description: input.description ?? `Loyer ${input.periode}`,
      metadata: { contratId: input.contratId },
    });

    await supabase
      .from('paiements')
      .update({ provider_transaction_id: initResult.providerTransactionId })
      .eq('id', payment.id);

    const verifyResult = await this.pollProvider(
      provider,
      initResult.providerTransactionId,
    );

    if (verifyResult.status === 'success') {
      const updated = await this.completePayment(payment.id, {
        providerTransactionId: initResult.providerTransactionId,
        providerReference: verifyResult.providerReference,
        paidAt: verifyResult.paidAt,
        taxCalc,
        contract,
        tenantId: input.tenantId,
      });
      const receipt = await receiptService.getReceiptByPaymentId(updated.id);
      return {
        status: 'success',
        payment: { ...updated, receiptId: receipt?.id, receiptCode: receipt?.code },
        providerReference: verifyResult.providerReference,
      };
    }

    const failureReason = verifyResult.failureReason ?? 'provider_error';
    await supabase
      .from('paiements')
      .update({ status: 'echoue', failure_reason: failureReason })
      .eq('id', payment.id);

    const failed = await this.getPaymentById(payment.id);
    return { status: 'failed', failureReason, payment: failed };
  },

  async pollProvider(
    provider: ReturnType<typeof getProvider>,
    transactionId: string,
  ) {
    const start = Date.now();
    while (Date.now() - start < MAX_POLL_DURATION_MS) {
      const result = await provider.verify(transactionId);
      if (result.status === 'success' || result.status === 'failed') {
        return result;
      }
      await sleep(POLL_INTERVAL_MS);
    }
    return { status: 'failed' as const, failureReason: 'timeout' };
  },

  async completePayment(
    paymentId: string,
    ctx: {
      providerTransactionId: string;
      providerReference?: string;
      paidAt?: string;
      taxCalc: ReturnType<typeof taxService.calculateTax>;
      contract: { id: string; bailleur_id: string };
      tenantId: string;
    },
  ): Promise<Paiement> {
    const { data: updated, error } = await supabase
      .from('paiements')
      .update({
        status: 'complete',
        provider_transaction_id: ctx.providerReference ?? ctx.providerTransactionId,
        paid_at: ctx.paidAt ?? new Date().toISOString(),
        notifications_sent: true,
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const receipt = await receiptService.generateReceipt(updated, ctx.taxCalc);

    const { data: bailleur } = await supabase
      .from('bailleurs')
      .select('user_id')
      .eq('id', ctx.contract.bailleur_id)
      .single();

    const notifications = [
      {
        user_id: ctx.tenantId,
        title: 'Paiement confirmé',
        message: `Votre paiement de ${updated.montant} ${updated.currency} a été enregistré. Reçu ${receipt.code}.`,
        type: 'payment',
        metadata: { payment_id: paymentId, receipt_id: receipt.id },
      },
    ];

    if (bailleur?.user_id) {
      notifications.push({
        user_id: bailleur.user_id,
        title: 'Paiement reçu',
        message: `Un paiement de ${updated.montant} ${updated.currency} a été reçu pour la période ${updated.periode}.`,
        type: 'payment',
        metadata: { payment_id: paymentId, receipt_id: receipt.id },
      });
    }

    await supabase.from('notifications').insert(notifications);

    return updated;
  },

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const payment = await this.getPaymentById(paymentId);
    return {
      id: payment.id,
      status: payment.status,
      failureReason: payment.failure_reason,
      providerReference: payment.provider_transaction_id,
    };
  },

  async getPaymentById(id: string): Promise<Paiement> {
    const { data, error } = await supabase.from('paiements').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
  },

  async findByIdempotencyKey(key: string): Promise<Paiement | null> {
    const { data, error } = await supabase
      .from('paiements')
      .select('*')
      .eq('idempotency_key', key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const createdAt = new Date(data.created_at).getTime();
    if (Date.now() - createdAt > IDEMPOTENCY_WINDOW_MS) return null;
    return data;
  },

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return getAllProviders().map((p) => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      subtext: p.subtext,
      supportsPartial: p.supportsPartial,
      processingTime: p.processingTime,
      available: true,
    }));
  },

  async getPaymentsForTenant(
    tenantId: string,
    filters?: { year?: number | 'all'; status?: string; search?: string },
  ) {
    let query = supabase
      .from('paiements')
      .select(`
        *,
        recu:recus(code, id),
        contrat:contrats!inner(
          locataire_id,
          logement:logements(code, address, type, rooms, commune)
        )
      `)
      .eq('contrat.locataire_id', tenantId)
      .order('created_at', { ascending: false });

    if (filters?.year && filters.year !== 'all') {
      query = query.gte('periode', `${filters.year}-01`).lte('periode', `${filters.year}-12`);
    }
    if (filters?.status && filters.status !== 'all') {
      const statusMap: Record<string, string> = {
        reussi: 'complete',
        en_attente: 'en_attente',
        echoue: 'echoue',
      };
      const dbStatus = statusMap[filters.status] ?? filters.status;
      query = query.eq('status', dbStatus as 'en_attente' | 'en_cours' | 'complete' | 'echoue' | 'rembourse');
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let results = data ?? [];
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter((p) => {
        const logement = (p.contrat as { logement?: { code?: string } })?.logement;
        return (
          p.reference.toLowerCase().includes(q) ||
          (logement?.code?.toLowerCase().includes(q) ?? false)
        );
      });
    }
    return results;
  },
};
