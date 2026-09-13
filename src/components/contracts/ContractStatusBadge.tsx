import { Badge } from '@/components/ui/Badge';
import type { BadgeProps } from '@/components/ui/Badge';

const statusConfig: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  brouillon: { label: 'Brouillon', variant: 'neutral' },
  en_attente_signature: { label: 'En attente de signature', variant: 'warning' },
  actif: { label: 'Actif', variant: 'success' },
  expire: { label: 'Expiré', variant: 'warning' },
  resilie: { label: 'Résilié', variant: 'danger' },
  suspendu: { label: 'Suspendu', variant: 'danger' },
};

interface ContractStatusBadgeProps {
  status: string;
  className?: string;
}

export function ContractStatusBadge({ status, className }: ContractStatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: 'neutral' as const };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
