import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  icon?: ReactNode;
  status?: 'completed' | 'current' | 'upcoming';
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {items.map((item, index) => (
        <div key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                item.status === 'completed' && 'border-[var(--color-success)] bg-green-50 text-[var(--color-success)]',
                item.status === 'current' && 'border-[var(--color-kinshasa-gold)] bg-amber-50 text-[var(--color-kinshasa-gold)]',
                (!item.status || item.status === 'upcoming') && 'border-[var(--color-border)] bg-[var(--color-muted)]',
              )}
            >
              {item.icon ?? <span className="h-2 w-2 rounded-full bg-current" />}
            </div>
            {index < items.length - 1 && (
              <div className="mt-1 w-0.5 flex-1 bg-[var(--color-border)]" />
            )}
          </div>
          <div className="pb-4">
            <p className="font-medium">{item.title}</p>
            {item.description && (
              <p className="text-sm text-[var(--color-muted-foreground)]">{item.description}</p>
            )}
            {item.timestamp && (
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{item.timestamp}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
