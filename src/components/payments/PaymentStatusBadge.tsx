import { Badge } from '@/components/ui/Badge';

const STATUS_MAP: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  complete: { label: 'Réussi', variant: 'success' },
  en_attente: { label: 'En attente', variant: 'warning' },
  en_cours: { label: 'En cours', variant: 'info' },
  echoue: { label: 'Échoué', variant: 'danger' },
  rembourse: { label: 'Remboursé', variant: 'neutral' },
};

interface PaymentStatusBadgeProps {
  status: string;
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
