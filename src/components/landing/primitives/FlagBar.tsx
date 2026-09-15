import { cn } from '@/lib/utils';

interface FlagBarProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

/** Thin decorative bar in the three colours of the DRC flag. */
export function FlagBar({ className, orientation = 'horizontal' }: FlagBarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(orientation === 'vertical' ? 'lp-flag-bar--vertical' : 'lp-flag-bar', className)}
    />
  );
}
