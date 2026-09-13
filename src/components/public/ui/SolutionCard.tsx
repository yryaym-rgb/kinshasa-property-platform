import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SolutionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function SolutionCard({ icon: Icon, title, description, className }: SolutionCardProps) {
  return (
    <article
      className={cn(
        'landing-card-hover group relative flex flex-col rounded-xl border border-[#e5e7eb] bg-white p-6',
        className,
      )}
    >
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--blue-primary)]">
        <Icon className="h-6 w-6 text-[var(--blue-primary)]" aria-hidden="true" />
      </span>
      <h3 className="mb-2 font-heading text-lg font-bold text-[var(--navy-900)]">{title}</h3>
      <p className="mb-8 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
      <span
        className="absolute bottom-6 right-6 text-[var(--blue-primary)] transition-transform group-hover:translate-x-1"
        aria-hidden="true"
      >
        <ArrowRight className="h-5 w-5" />
      </span>
    </article>
  );
}
