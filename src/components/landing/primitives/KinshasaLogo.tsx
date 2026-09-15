import { cn } from '@/lib/cn';

// Stable public URL so the static app shell in index.html can reference the same file.
export const KINSHASA_LOGO_SRC = '/landing/logo-kinshasa.png';

interface KinshasaSealProps {
  size?: number;
  className?: string;
  /** Wraps the seal in a white disc so it reads cleanly on dark backgrounds. */
  onDark?: boolean;
  priority?: boolean;
}

/** Official seal of the Ville de Kinshasa. */
export function KinshasaSeal({ size = 48, className, onDark = false, priority = false }: KinshasaSealProps) {
  const img = (
    <img
      src={KINSHASA_LOGO_SRC}
      alt="Armoiries officielles de la Ville de Kinshasa"
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      className={cn('block shrink-0 select-none', !onDark && className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );

  if (!onDark) return img;

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-white p-[3px]', className)}
      style={{ width: size + 6, height: size + 6 }}
    >
      {img}
    </span>
  );
}

interface WordmarkProps {
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md';
  className?: string;
  showCaption?: boolean;
}

/** "eLoyer Kinshasa" wordmark with the institutional caption. */
export function EloyerWordmark({ tone = 'light', size = 'md', className, showCaption = true }: WordmarkProps) {
  return (
    <span className={cn('flex flex-col leading-none', className)}>
      <span
        className={cn(
          'font-heading font-bold tracking-[-0.02em]',
          size === 'md' ? 'text-[22px]' : 'text-[18px]',
        )}
      >
        <span className={cn(tone === 'dark' ? 'text-drc-blue' : size === 'md' ? 'text-drc-blue-dark' : 'text-drc-blue-ink')}>eLoyer</span>{' '}
        <span className={tone === 'dark' ? 'text-white' : 'text-drc-navy'}>Kinshasa</span>
      </span>
      {showCaption ? (
        <span
          className={cn(
            'mt-[5px] text-[9px] font-semibold uppercase tracking-[1.5px]',
            tone === 'dark' ? 'text-white/55' : 'text-drc-gray-500',
          )}
        >
          Ville de Kinshasa
        </span>
      ) : null}
    </span>
  );
}

/** Seal + divider + wordmark lock-up used in the navbar and footer. */
export function KinshasaLogo({
  tone = 'light',
  className,
  priority = false,
}: {
  tone?: 'light' | 'dark';
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn('flex items-center gap-4', className)}>
      <KinshasaSeal size={48} onDark={tone === 'dark'} priority={priority} />
      <span aria-hidden="true" className={cn('h-9 w-px', tone === 'dark' ? 'bg-white/15' : 'bg-drc-gray-200')} />
      <EloyerWordmark tone={tone} />
    </span>
  );
}
