import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { TAX_STATUS_LABELS, type Impot } from '@/types/tax';

const VARIANTS: Record<Impot['status'], BadgeProps['variant']> = {
  calcule: 'info',
  declare: 'warning',
  paye: 'success',
  en_retard: 'danger',
  exonere: 'neutral',
  annule: 'neutral',
};

export function TaxStatusBadge({ status }: { status: string }) {
  const key = status as Impot['status'];
  return <Badge variant={VARIANTS[key] ?? 'neutral'}>{TAX_STATUS_LABELS[key] ?? status}</Badge>;
}
