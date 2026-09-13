import type { LucideIcon } from 'lucide-react';

interface FeaturePillProps {
  icon: LucideIcon;
  label: string;
}

export function FeaturePill({ icon: Icon, label }: FeaturePillProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-gold)]">
        <Icon className="h-4 w-4 text-[var(--brand-gold)]" aria-hidden="true" />
      </span>
      <span className="text-sm font-medium text-white">{label}</span>
    </div>
  );
}
