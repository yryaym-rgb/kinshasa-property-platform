import { cn } from '@/lib/utils';
import { APP_CONFIG } from '@/config/app.config';

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-3',
  lg: 'h-12 w-12 border-4',
} as const;

export interface LoadingSpinnerProps {
  size?: keyof typeof sizeClasses;
  className?: string;
  label?: string;
}

export function LoadingSpinner({ size = 'md', className, label = 'Chargement...' }: LoadingSpinnerProps) {
  return (
    <div role="status" aria-label={label} className={cn('inline-flex', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-[var(--color-kinshasa-blue)] border-t-transparent',
          sizeClasses[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function FullPageLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-background)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-kinshasa-blue)]">
        <span className="font-heading text-2xl font-bold text-white">eL</span>
      </div>
      <LoadingSpinner size="lg" />
      <p className="text-sm text-[var(--color-muted-foreground)]">{APP_CONFIG.name}</p>
    </div>
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} />;
}
