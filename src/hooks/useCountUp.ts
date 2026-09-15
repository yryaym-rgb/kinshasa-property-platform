import { useEffect, useRef, useState } from 'react';

export interface UseCountUpOptions {
  /** Target value. */
  end: number;
  /** Start counting when true (typically when the element is in view). */
  isActive: boolean;
  /** Starting value (default 0). */
  start?: number;
  /** Animation duration in ms. */
  duration?: number;
  /** Number of decimals to render. */
  decimals?: number;
  /** Delay before the animation starts, in ms. */
  delay?: number;
}

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Animates a number from `start` to `end` with an expo ease-out curve.
 * Returns the raw numeric value; format it with `formatCountUp` or your own formatter.
 * Honors `prefers-reduced-motion` by jumping straight to the end value.
 */
export function useCountUp({
  end,
  isActive,
  start = 0,
  duration = 2000,
  decimals = 0,
  delay = 0,
}: UseCountUpOptions): number {
  const [value, setValue] = useState(start);
  const frame = useRef<number | null>(null);
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!isActive || reduceMotion) return;

    let startTime: number | null = null;
    const factor = Math.pow(10, decimals);

    const tick = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(Math.max(elapsed / duration, 0), 1);
      const eased = easeOutExpo(progress);
      const next = start + (end - start) * eased;
      setValue(Math.round(next * factor) / factor);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };

    const timeout = window.setTimeout(() => {
      frame.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [end, start, duration, decimals, delay, isActive, reduceMotion]);

  if (reduceMotion && isActive) return end;
  return value;
}

/** Formats a count-up value using French locale grouping (e.g. 500 000). */
export function formatCountUp(value: number, decimals = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
