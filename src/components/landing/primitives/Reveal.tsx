import type { ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: Direction;
  distance?: number;
  once?: boolean;
  amount?: number;
  as?: 'div' | 'section' | 'li' | 'article' | 'span' | 'header' | 'figure';
}

const OFFSETS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
  none: { x: 0, y: 0 },
};

export const LP_EASE = [0.16, 1, 0.3, 1] as const;

/** Fade + slide into view on scroll. Respects `prefers-reduced-motion`. */
export function Reveal({
  children,
  className,
  delay = 0,
  duration = 0.8,
  direction = 'up',
  distance = 28,
  once = true,
  amount = 0.25,
  as = 'div',
}: RevealProps) {
  const reduce = useReducedMotion();
  const Component = motion[as];
  const offset = OFFSETS[direction];

  const variants: Variants = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, x: offset.x * distance, y: offset.y * distance },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration, delay, ease: [...LP_EASE] },
    },
  };

  return (
    <Component
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount, margin: '0px 0px -8% 0px' }}
    >
      {children}
    </Component>
  );
}

interface StaggerProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  amount?: number;
  as?: 'div' | 'ul' | 'ol' | 'section';
}

/** Container that staggers `StaggerItem` children into view. */
export function Stagger({ children, className, stagger = 0.1, delay = 0, amount = 0.2, as = 'div' }: StaggerProps) {
  const Component = motion[as];
  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount, margin: '0px 0px -8% 0px' }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({
  children,
  className,
  as = 'div',
  distance = 28,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'article';
  distance?: number;
}) {
  const reduce = useReducedMotion();
  const Component = motion[as];
  return (
    <Component
      className={className}
      variants={{
        hidden: reduce ? { opacity: 1 } : { opacity: 0, y: distance },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [...LP_EASE] } },
      }}
    >
      {children}
    </Component>
  );
}
