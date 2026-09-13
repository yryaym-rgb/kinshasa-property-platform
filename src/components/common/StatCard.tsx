import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  description?: string;
  className?: string;
  highlight?: boolean;
}

export function StatCard({ label, value, description, className, highlight }: StatCardProps) {
  return (
    <Card className={cn(highlight && 'border-[var(--color-kinshasa-gold)]', className)}>
      <CardContent className="p-4">
        <p className="text-sm text-[var(--color-muted-foreground)]">{label}</p>
        <p className={cn('mt-1 text-xl font-bold', highlight && 'text-[var(--color-kinshasa-gold)]')}>
          {value}
        </p>
        {description && (
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
