import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  icon: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
}

export function KPICard({
  label,
  value,
  subtitle,
  change,
  icon: Icon,
  iconClassName,
  valueClassName,
}: KPICardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">
          {label}
        </CardTitle>
        <div className={cn('rounded-lg bg-[var(--color-muted)] p-2', iconClassName)}>
          <Icon className="h-4 w-4 text-[var(--color-kinshasa-blue)]" />
        </div>
      </CardHeader>
      <CardContent>
        <p className={cn('text-2xl font-bold', valueClassName)}>{value}</p>
        {(subtitle || change) && (
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {change && <span className="text-[var(--color-success)]">{change}</span>}
            {change && subtitle && ' · '}
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
