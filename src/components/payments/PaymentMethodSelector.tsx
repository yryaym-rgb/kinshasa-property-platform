import { cn } from '@/lib/utils';
import { MobileMoneyLogo } from './MobileMoneyLogo';
import type { PaymentMethod, PaymentProviderId } from '@/services/payment/types';

interface PaymentMethodSelectorProps {
  methods: PaymentMethod[];
  selected: PaymentProviderId | null;
  onSelect: (id: PaymentProviderId) => void;
  disabled?: boolean;
}

export function PaymentMethodSelector({
  methods,
  selected,
  onSelect,
  disabled,
}: PaymentMethodSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Méthode de paiement">
      {methods.map((method) => {
        const isSelected = selected === method.id;
        const borderColor =
          method.id === 'orange_money'
            ? 'border-orange-500'
            : method.id === 'mpesa'
              ? 'border-green-600'
              : method.id === 'airtel_money'
                ? 'border-red-600'
                : 'border-[var(--color-kinshasa-gold)]';

        return (
          <button
            key={method.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled || !method.available}
            onClick={() => onSelect(method.id)}
            className={cn(
              'flex min-h-[72px] items-center gap-3 rounded-xl border-2 p-4 text-left transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
              isSelected
                ? `${borderColor} bg-amber-50/60 dark:bg-amber-900/10`
                : 'border-[var(--color-border)] hover:border-[var(--color-muted-foreground)]',
              (!method.available || disabled) && 'cursor-not-allowed opacity-50',
            )}
          >
            <MobileMoneyLogo provider={method.id} size="md" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{method.name}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{method.subtext}</p>
            </div>
            <div
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                isSelected
                  ? 'border-[var(--color-kinshasa-gold)] bg-[var(--color-kinshasa-gold)]'
                  : 'border-[var(--color-border)]',
              )}
              aria-hidden="true"
            >
              {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
