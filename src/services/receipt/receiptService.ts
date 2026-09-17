import { supabase } from '@/config/supabase';
import type { Recu, Paiement } from '@/types/database.types';

export interface ReceiptWithDetails extends Recu {
  paiement?: Paiement;
  contrat?: {
    logement?: { code?: string; address?: string; type?: string; rooms?: number | null };
    locataire?: { full_name?: string };
    bailleur?: { business_name?: string; user?: { full_name?: string; phone?: string } };
  };
}

export const receiptService = {
  async getReceiptById(id: string): Promise<ReceiptWithDetails | null> {
    const { data, error } = await supabase
      .from('recus')
      .select(`
        *,
        paiement:paiements(*),
        contrat:contrats(
          *,
          logement:logements(code, address, type, rooms, commune),
          locataire:users!contrats_locataire_id_fkey(full_name, phone, email),
          bailleur:bailleurs(business_name, user:users!bailleurs_user_id_fkey(full_name, phone))
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as ReceiptWithDetails | null;
  },

  async getReceiptByPaymentId(paymentId: string): Promise<ReceiptWithDetails | null> {
    const { data, error } = await supabase
      .from('recus')
      .select(`
        *,
        paiement:paiements(*),
        contrat:contrats(
          *,
          logement:logements(code, address, type, rooms, commune),
          locataire:users!contrats_locataire_id_fkey(full_name, phone, email),
          bailleur:bailleurs(business_name, user:users!bailleurs_user_id_fkey(full_name, phone))
        )
      `)
      .eq('paiement_id', paymentId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as ReceiptWithDetails | null;
  },

  async getReceiptsForTenant(
    tenantId: string,
    filters?: { year?: number; propertyCode?: string; minAmount?: number; maxAmount?: number },
  ): Promise<ReceiptWithDetails[]> {
    let query = supabase
      .from('recus')
      .select(`
        *,
        paiement:paiements(*),
        contrat:contrats!inner(
          locataire_id,
          logement:logements(code, address, type, rooms, commune)
        )
      `)
      .eq('contrat.locataire_id', tenantId)
      .order('issued_at', { ascending: false });

    if (filters?.year) {
      query = query.gte('issued_at', `${filters.year}-01-01`).lte('issued_at', `${filters.year}-12-31`);
    }
    if (filters?.minAmount) query = query.gte('montant', filters.minAmount);
    if (filters?.maxAmount) query = query.lte('montant', filters.maxAmount);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let results = (data ?? []) as ReceiptWithDetails[];
    if (filters?.propertyCode) {
      results = results.filter((r) => {
        const logement = r.contrat?.logement as { code?: string } | undefined;
        return logement?.code?.toLowerCase().includes(filters.propertyCode!.toLowerCase());
      });
    }
    return results;
  },

  /**
   * Receipts are created server-side by the post-success pipeline
   * (supabase/functions/_shared/pipeline.ts → step `receipt`). The frontend
   * only reads them; this waits for the pipeline to catch up (max ~10 s).
   */
  async waitForReceipt(paymentId: string, options?: { attempts?: number; intervalMs?: number }) {
    const attempts = options?.attempts ?? 5;
    const intervalMs = options?.intervalMs ?? 2000;
    for (let i = 0; i < attempts; i++) {
      const receipt = await this.getReceiptByPaymentId(paymentId);
      if (receipt) return receipt;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return null;
  },

  async downloadReceiptPdf(receiptId: string): Promise<void> {
    // Stub for Module 8 PDF generation
    const receipt = await this.getReceiptById(receiptId);
    if (!receipt) throw new Error('Reçu introuvable');
    const blob = new Blob(
      [`Reçu ${receipt.code}\nMontant: ${receipt.montant} ${receipt.currency}`],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${receipt.code}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async sendReceiptEmail(receiptId: string, email: string): Promise<void> {
    // Stub — will integrate with email service in Module 8
    console.info(`[receiptService] Email receipt ${receiptId} to ${email}`);
  },
};
