import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  tabs?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  showBack,
  onBack,
  tabs,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={cn('mb-6', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack ?? (() => navigate(-1))}
              aria-label="Retour"
              className="mt-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-4 border-b border-[var(--color-border)]">{tabs}</div>}
    </div>
  );
}
