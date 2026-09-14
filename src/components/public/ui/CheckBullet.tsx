import { Check } from 'lucide-react';

interface CheckBulletProps {
  children: string;
}

export function CheckBullet({ children }: CheckBulletProps) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/10"
        aria-hidden="true"
      >
        <Check className="h-4 w-4 text-[var(--success)]" strokeWidth={2.5} />
      </span>
      <span className="text-base text-[var(--navy-900)]">{children}</span>
    </li>
  );
}
