import { addMonths, format, parseISO } from 'date-fns';
import type { Contrat } from '@/types/database.types';
import type { ContractTermsMetadata } from '@/services/contract/contractService';

export function getContractTerms(contrat: Contrat): ContractTermsMetadata {
  const terms = (contrat.terms ?? {}) as ContractTermsMetadata;
  const metadata = ((contrat as Contrat & { metadata?: ContractTermsMetadata }).metadata ??
    {}) as ContractTermsMetadata;
  return { ...metadata, ...terms };
}

export function calculateEndDate(dateDebut: string, dureeMois: number): string {
  const end = addMonths(parseISO(dateDebut), dureeMois);
  return format(end, 'yyyy-MM-dd');
}

export function getNextPaymentDue(paymentDay: number): { date: Date; daysRemaining: number } {
  const now = new Date();
  const day = Math.min(Math.max(paymentDay, 1), 28);
  let due = new Date(now.getFullYear(), now.getMonth(), day);
  if (due < now) {
    due = new Date(now.getFullYear(), now.getMonth() + 1, day);
  }
  const daysRemaining = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return { date: due, daysRemaining };
}

export function getPaymentFrequencyLabel(freq: string): string {
  const labels: Record<string, string> = {
    mensuel: 'Mensuel',
    trimestriel: 'Trimestriel',
    semestriel: 'Semestriel',
    annuel: 'Annuel',
  };
  return labels[freq] ?? freq;
}
