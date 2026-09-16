import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface AuthCardProps {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}

/** Right-side content column (split layout) or the floating card (centered layout). */
export function AuthCard({ children, className, wide = false }: AuthCardProps) {
  return <div className={cn('auth-card', wide && 'auth-card--wide', className)}>{children}</div>;
}

interface AuthCardHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Icon rendered inside a 64px coloured disc above the title. */
  badge?: ReactNode;
  badgeTone?: 'blue' | 'yellow' | 'green' | 'red';
  align?: 'left' | 'center';
  size?: 'lg' | 'md';
  id?: string;
  children?: ReactNode;
}

export function AuthCardHeader({
  title,
  subtitle,
  badge,
  badgeTone = 'blue',
  align = 'left',
  size = 'lg',
  id = 'auth-title',
  children,
}: AuthCardHeaderProps) {
  return (
    <header className={cn(align === 'center' && 'auth-center')}>
      {badge ? (
        <span className={cn('auth-badge mb-6', badgeTone !== 'blue' && `auth-badge--${badgeTone}`)} aria-hidden="true">
          {badge}
        </span>
      ) : null}
      <h1 id={id} className={cn('auth-title', size === 'md' && 'auth-title--md')}>
        {title}
      </h1>
      {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
      {children}
    </header>
  );
}
