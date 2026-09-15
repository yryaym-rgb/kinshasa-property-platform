import { useEffect, useRef, useState, type RefObject } from 'react';

export interface UseScrollRevealOptions {
  /** Fraction of the element that must be visible before revealing. */
  threshold?: number;
  /** Margin around the viewport, e.g. "0px 0px -10% 0px" to trigger slightly before the bottom. */
  rootMargin?: string;
  /** Reveal once and stop observing (default) or toggle on every intersection change. */
  once?: boolean;
}

function shouldRevealImmediately(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Observes an element and reports when it enters the viewport.
 * Respects `prefers-reduced-motion` by revealing immediately.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.2,
  rootMargin = '0px 0px -8% 0px',
  once = true,
}: UseScrollRevealOptions = {}): { ref: RefObject<T | null>; isVisible: boolean } {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(shouldRevealImmediately);

  useEffect(() => {
    const element = ref.current;
    if (!element || shouldRevealImmediately()) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setIsVisible(false);
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, isVisible };
}
