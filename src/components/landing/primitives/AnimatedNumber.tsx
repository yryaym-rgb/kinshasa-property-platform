import { useInView } from 'react-intersection-observer';
import { useCountUp, formatCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/cn';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  delay?: number;
  className?: string;
  /** Accessible label read by screen readers instead of the animating digits. */
  label?: string;
}

/** Counts up from zero when scrolled into view; renders tabular digits to avoid layout jitter. */
export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 2200,
  delay = 0,
  className,
  label,
}: AnimatedNumberProps) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.4 });
  const current = useCountUp({ end: value, isActive: inView, decimals, duration, delay });
  const finalText = `${prefix}${formatCountUp(value, decimals)}${suffix}`;

  return (
    <span ref={ref} className={cn('lp-tabular inline-block', className)}>
      <span className="sr-only">{label ?? finalText}</span>
      <span aria-hidden="true">
        {prefix}
        {formatCountUp(current, decimals)}
        {suffix}
      </span>
    </span>
  );
}
