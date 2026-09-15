import { cn } from '@/lib/cn';

type Tone = 'blue' | 'red' | 'yellow' | 'gold' | 'white';

interface SectionLabelProps {
  /** Two-digit section index rendered in mono, e.g. "01". */
  number?: string;
  children: string;
  tone?: Tone;
  align?: 'left' | 'center';
  className?: string;
}

const TONE_CLASS: Record<Tone, string> = {
  blue: 'text-drc-blue-ink',
  red: 'text-drc-red-ink',
  yellow: 'text-drc-yellow',
  gold: 'text-drc-gold-ink',
  white: 'text-white/70',
};

const BAR_CLASS: Record<Tone, string> = {
  blue: 'bg-drc-blue',
  red: 'bg-drc-red',
  yellow: 'bg-drc-yellow',
  gold: 'bg-drc-gold',
  white: 'bg-white/50',
};

/** Eyebrow label: "01 / POUR QUI ?" — tiny, uppercase, tracked, numbered in mono. */
export function SectionLabel({
  number,
  children,
  tone = 'blue',
  align = 'left',
  className,
}: SectionLabelProps) {
  return (
    <p
      className={cn(
        'flex items-center gap-3 text-[12px] font-bold uppercase tracking-[3px]',
        align === 'center' && 'justify-center',
        TONE_CLASS[tone],
        className,
      )}
    >
      <span aria-hidden="true" className={cn('h-px w-6', BAR_CLASS[tone])} />
      {number ? (
        <span className="lp-mono flex items-center gap-2 font-semibold tracking-[1px]">
          {number}
          <span className="opacity-50">/</span>
        </span>
      ) : null}
      <span>{children}</span>
    </p>
  );
}
