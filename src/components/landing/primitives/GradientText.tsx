import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Gradient = 'blue-yellow' | 'yellow-red' | 'blue' | 'gold';

const GRADIENTS: Record<Gradient, string> = {
  'blue-yellow': 'linear-gradient(92deg, #009FE3 0%, #5CC8F2 45%, #FFDD00 100%)',
  'yellow-red': 'linear-gradient(92deg, #FFDD00 0%, #FFB347 50%, #EF3E42 100%)',
  blue: 'linear-gradient(92deg, #009FE3 0%, #6FD0F5 100%)',
  gold: 'linear-gradient(92deg, #C9A227 0%, #F5E6B8 100%)',
};

interface GradientTextProps {
  children: ReactNode;
  gradient?: Gradient;
  className?: string;
}

/** Inline gradient-filled text, used sparingly for a single emphasised phrase. */
export function GradientText({ children, gradient = 'blue-yellow', className }: GradientTextProps) {
  return (
    <span
      className={cn('inline-block bg-clip-text text-transparent', className)}
      style={{ backgroundImage: GRADIENTS[gradient], WebkitBackgroundClip: 'text' }}
    >
      {children}
    </span>
  );
}
