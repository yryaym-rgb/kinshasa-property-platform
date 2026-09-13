import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_CONFIG } from '@/config/app.config';

export interface DatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({ value, onChange, label, error, min, max, disabled, className }: DatePickerProps) {
  const displayValue = value && isValid(parseISO(value))
    ? format(parseISO(value), 'dd MMMM yyyy', { locale: fr })
    : '';

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <label className="block text-sm font-medium">{label}</label>}
      <div className="relative">
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          min={min}
          max={max}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]',
            error && 'border-[var(--color-destructive)]',
          )}
          aria-label={label}
        />
        {displayValue && (
          <span className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted-foreground)]">
            {displayValue}
          </span>
        )}
        <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
      </div>
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
    </div>
  );
}

export interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onStartChange?: (value: string) => void;
  onEndChange?: (value: string) => void;
  label?: string;
  error?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  label,
  error,
}: DateRangePickerProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium">{label}</label>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DatePicker value={startDate} onChange={onStartChange} label="Date de début" max={endDate} />
        <DatePicker value={endDate} onChange={onEndChange} label="Date de fin" min={startDate} />
      </div>
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
      <p className="text-xs text-[var(--color-muted-foreground)]">
        Fuseau horaire: {APP_CONFIG.timezone}
      </p>
    </div>
  );
}
