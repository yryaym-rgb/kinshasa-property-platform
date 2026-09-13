import { Badge } from '@/components/ui/Badge';
import type { PropertyStatus } from '@/types';
import { STATUS_LABELS } from '@/utils/propertyUtils';

const STATUS_VARIANTS: Record<PropertyStatus, 'success' | 'neutral' | 'warning' | 'danger'> = {
  disponible: 'neutral',
  occupe: 'success',
  maintenance: 'warning',
  inactif: 'danger',
};

export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
