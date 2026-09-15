import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { APP_CONFIG } from '@/config/app.config';
import type { KinshasaCommune } from '@/types';

export { cn } from './cn';

/** Format amount in CDF (Franc congolais) */
export function formatCDF(amount: number): string {
  return new Intl.NumberFormat('fr-CD', {
    style: 'currency',
    currency: 'CDF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format amount in USD */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format currency based on code */
export function formatCurrency(amount: number, currency: 'CDF' | 'USD' = 'CDF'): string {
  return currency === 'USD' ? formatUSD(amount) : formatCDF(amount);
}

/** Format date in French locale with Kinshasa timezone */
export function formatDate(
  date: string | Date,
  pattern = 'dd MMMM yyyy',
): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern, { locale: fr });
}

/** Format datetime in French locale */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'dd MMM yyyy à HH:mm');
}

/** Format DRC phone number for display */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('243') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  if (normalized.length === 9) {
    return `+243 ${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`;
  }
  return phone.startsWith('+') ? phone : `+243${phone}`;
}

/** Normalize phone to E.164 format (+243XXXXXXXXX) */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('243')) return `+${digits}`;
  if (digits.startsWith('0')) return `+243${digits.slice(1)}`;
  if (digits.length === 9) return `+243${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

/** Format Kinshasa address */
export function formatAddress(parts: {
  commune?: string;
  quartier?: string | null;
  avenue?: string | null;
  parcelle?: string | null;
  address?: string;
}): string {
  const segments = [
    parts.address,
    parts.avenue ? `Av. ${parts.avenue}` : null,
    parts.parcelle ? `Parcelle ${parts.parcelle}` : null,
    parts.quartier,
    parts.commune,
    'Kinshasa',
  ].filter(Boolean);
  return segments.join(', ');
}

/** Validate DRC mobile phone number */
export function isValidDRCPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+243(81|82|84|85|89|90|91|97|98|99)\d{7}$/.test(normalized);
}

/** Validate email address */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Validate DRC tax ID (NIF) - placeholder format */
export function isValidTaxId(taxId: string): boolean {
  return /^[A-Z0-9]{8,15}$/.test(taxId.toUpperCase());
}

/** Validate property code format */
export function isValidPropertyCode(code: string): boolean {
  return /^KIN-[A-Z]{3}-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/.test(code);
}

/** Get commune abbreviation for codes */
export function getCommuneAbbreviation(commune: KinshasaCommune): string {
  const map: Record<string, string> = {
    Gombe: 'GOM',
    Lingwala: 'LIN',
    Kinshasa: 'KIN',
    Kalamu: 'KAL',
    Bandalungwa: 'BAN',
    Barumbu: 'BAR',
    Lemba: 'LEM',
    Limete: 'LIM',
    Matete: 'MAT',
    'Ngiri-Ngiri': 'NGI',
    Makala: 'MAK',
    Selembao: 'SEL',
    Bumbu: 'BUM',
    'Mont-Ngafula': 'MNG',
    Ndjili: 'NDJ',
    Kimbanseke: 'KIM',
    Kisenso: 'KIS',
    Masina: 'MAS',
    Nsele: 'NSE',
    Maluku: 'MAL',
    Ngaliema: 'NGA',
    Kintambo: 'KNT',
    'Kasa-Vubu': 'KAS',
    'Mont-Amba': 'MTA',
  };
  return map[commune] ?? commune.slice(0, 3).toUpperCase();
}

/** Generate property code: KIN-GOM-AV123-PARC456-APP012 */
export function generatePropertyCode(
  commune: KinshasaCommune,
  avenue?: string,
  parcelle?: string,
  typePrefix = 'APP',
  sequence = 1,
): string {
  const communeCode = getCommuneAbbreviation(commune);
  const avCode = avenue ? `AV${avenue.replace(/\D/g, '').slice(0, 3).padStart(3, '0')}` : 'AV000';
  const parcCode = parcelle ? `PARC${parcelle.replace(/\D/g, '').slice(0, 3).padStart(3, '0')}` : 'PARC000';
  const seq = `${typePrefix}${String(sequence).padStart(3, '0')}`;
  return `KIN-${communeCode}-${avCode}-${parcCode}-${seq}`;
}

/** Generate contract code */
export function generateContractCode(sequence = 1): string {
  const year = new Date().getFullYear();
  return `CTR-KIN-${year}-${String(sequence).padStart(6, '0')}`;
}

/** Generate receipt code */
export function generateReceiptCode(sequence = 1): string {
  const year = new Date().getFullYear();
  return `REC-KIN-${year}-${String(sequence).padStart(6, '0')}`;
}

/** Generate payment transaction reference */
export function generateTransactionReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TXN-${timestamp}-${random}`;
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

/** Get initials from full name */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Sleep utility for retry logic */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Get current timestamp in Kinshasa timezone ISO string */
export function nowKinshasa(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: APP_CONFIG.timezone }).replace(' ', 'T');
}
