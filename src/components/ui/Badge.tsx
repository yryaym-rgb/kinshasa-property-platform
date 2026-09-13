import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const PAYMENT_STATUS_MAP: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  en_attente: { label: 'En attente', variant: 'warning' },
  en_cours: { label: 'En cours', variant: 'info' },
  complete: { label: 'Complété', variant: 'success' },
  echoue: { label: 'Échoué', variant: 'danger' },
  rembourse: { label: 'Remboursé', variant: 'neutral' },
};

const CONTRACT_STATUS_MAP: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  brouillon: { label: 'Brouillon', variant: 'neutral' },
  actif: { label: 'Actif', variant: 'success' },
  suspendu: { label: 'Suspendu', variant: 'warning' },
  resilie: { label: 'Résilié', variant: 'danger' },
  expire: { label: 'Expiré', variant: 'neutral' },
};

const COMPLIANCE_MAP: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  excellent: { label: 'Excellent', variant: 'success' },
  good: { label: 'Bon', variant: 'info' },
  warning: { label: 'Attention', variant: 'warning' },
  critical: { label: 'Critique', variant: 'danger' },
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const config = PAYMENT_STATUS_MAP[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function ContractStatusBadge({ status }: { status: string }) {
  const config = CONTRACT_STATUS_MAP[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function ComplianceBadge({ level }: { level: string }) {
  const config = COMPLIANCE_MAP[level] ?? { label: level, variant: 'neutral' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export { badgeVariants };
