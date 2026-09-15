import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SectionLabel } from './SectionLabel';

interface SectionHeadingProps {
  number?: string;
  label: string;
  labelTone?: 'blue' | 'red' | 'yellow' | 'gold' | 'white';
  title: ReactNode;
  subtitle?: ReactNode;
  align?: 'left' | 'center';
  /** `light` = dark text on light background; `dark` = light text on navy. */
  tone?: 'light' | 'dark';
  size?: 'md' | 'lg';
  className?: string;
  id?: string;
}

/** Editorial section header: eyebrow, oversized Poppins title, measured subtitle. */
export function SectionHeading({
  number,
  label,
  labelTone,
  title,
  subtitle,
  align = 'center',
  tone = 'light',
  size = 'lg',
  className,
  id,
}: SectionHeadingProps) {
  const centered = align === 'center';
  return (
    <div className={cn('flex flex-col gap-5', centered ? 'items-center text-center' : 'items-start', className)}>
      <SectionLabel number={number} tone={labelTone ?? (tone === 'dark' ? 'yellow' : 'blue')} align={align}>
        {label}
      </SectionLabel>
      <h2
        id={id}
        className={cn(
          'lp-display',
          size === 'lg' ? 'text-[30px] sm:text-[40px] lg:text-[48px]' : 'text-[28px] sm:text-[34px] lg:text-[40px]',
          tone === 'dark' ? 'text-white' : 'text-drc-navy',
          centered && 'max-w-[820px]',
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            'text-[17px] leading-[1.65] sm:text-[18px]',
            tone === 'dark' ? 'text-white/65' : 'text-drc-gray-600',
            centered ? 'mx-auto max-w-[640px]' : 'max-w-[560px]',
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
