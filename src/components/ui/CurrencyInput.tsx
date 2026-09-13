import { useState, useCallback } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { Select } from './Select';
import type { SelectOption } from '@/types';

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'CDF', label: 'CDF - Franc congolais' },
  { value: 'USD', label: 'USD - Dollar américain' },
];

export interface CurrencyInputProps {
  value?: number;
  onChange?: (value: number, currency: 'CDF' | 'USD') => void;
  currency?: 'CDF' | 'USD';
  onCurrencyChange?: (currency: 'CDF' | 'USD') => void;
  label?: string;
  error?: string;
  showCurrencySelector?: boolean;
  disabled?: boolean;
  className?: string;
}

function formatRawNumber(num: number, currency: 'CDF' | 'USD'): string {
  if (num === 0) return '';
  return new Intl.NumberFormat('fr-CD', {
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(num);
}

function parseFormattedValue(str: string): number {
  const cleaned = str.replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function CurrencyInput({
  value = 0,
  onChange,
  currency = 'CDF',
  onCurrencyChange,
  label,
  error,
  showCurrencySelector = true,
  disabled,
  className,
}: CurrencyInputProps) {
  const [display, setDisplay] = useState(formatRawNumber(value, currency));

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setDisplay(raw);
      const num = parseFormattedValue(raw);
      onChange?.(num, currency);
    },
    [currency, onChange],
  );

  const handleBlur = useCallback(() => {
    setDisplay(formatRawNumber(value, currency));
  }, [value, currency]);

  const handleCurrencyChange = (newCurrency: string) => {
    const c = newCurrency as 'CDF' | 'USD';
    onCurrencyChange?.(c);
    onChange?.(value, c);
    setDisplay(formatRawNumber(value, c));
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <label className="block text-sm font-medium">{label}</label>}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            inputMode="decimal"
            value={display}
            onChange={handleInputChange}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder="0"
            aria-label={label ?? 'Montant'}
            className={cn(
              'flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]',
              error && 'border-[var(--color-destructive)]',
            )}
          />
          {value > 0 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted-foreground)]">
              {formatCurrency(value, currency)}
            </span>
          )}
        </div>
        {showCurrencySelector && (
          <div className="w-32">
            <Select
              options={CURRENCY_OPTIONS}
              value={currency}
              onValueChange={handleCurrencyChange}
              disabled={disabled}
            />
          </div>
        )}
      </div>
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
    </div>
  );
}
