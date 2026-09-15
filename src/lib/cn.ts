import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Lives in its own module so entry-critical components (landing page, loaders)
 * can merge class names without dragging the date/currency helpers — and
 * date-fns — into the initial bundle.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
