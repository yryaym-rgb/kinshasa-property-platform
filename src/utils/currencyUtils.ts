export { formatCDF, formatUSD, formatCurrency } from '@/lib/utils';

export function parseCurrencyInput(value: string): number {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

export function formatCompactCDF(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace('.0', '')}M FC`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}K FC`;
  }
  return `${amount} FC`;
}
