import { cn } from '@/lib/utils';
import type { PaymentProviderId } from '@/services/payment/types';

interface MobileMoneyLogoProps {
  provider: PaymentProviderId | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = { sm: 'h-6 w-6', md: 'h-10 w-10', lg: 'h-14 w-14' };

const PROVIDER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  orange_money: { bg: 'bg-orange-500', text: 'text-white', label: 'OM' },
  mpesa: { bg: 'bg-green-600', text: 'text-white', label: 'M' },
  airtel_money: { bg: 'bg-red-600', text: 'text-white', label: 'A' },
  card: { bg: 'bg-blue-700', text: 'text-white', label: '💳' },
  bank: { bg: 'bg-slate-600', text: 'text-white', label: '🏦' },
};

export function MobileMoneyLogo({ provider, size = 'md', className }: MobileMoneyLogoProps) {
  const config = PROVIDER_COLORS[provider] ?? { bg: 'bg-gray-400', text: 'text-white', label: '?' };

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg font-bold',
        SIZE_MAP[size],
        config.bg,
        config.text,
        className,
      )}
      aria-label={provider}
    >
      <span className={size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'}>
        {config.label}
      </span>
    </div>
  );
}
