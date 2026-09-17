import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { KINSHASA_COMMUNES } from '@/config/communes';
import type { SelectOption } from '@/types';

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Select({
  options,
  value,
  onValueChange,
  placeholder = 'Sélectionner...',
  label,
  error,
  searchable = false,
  disabled,
  className,
}: SelectProps) {
  const [search, setSearch] = useState('');

  const filtered = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <label className="block text-sm font-medium">{label}</label>}
      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-[var(--color-destructive)]',
          )}
          aria-label={label ?? placeholder}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="z-50 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg"
            position="popper"
            sideOffset={4}
          >
            {searchable && (
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-2">
                <Search className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            )}
            <SelectPrimitive.Viewport className="max-h-60 p-1">
              {filtered.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    'relative flex cursor-pointer select-none items-center rounded-md px-8 py-2 text-sm outline-none',
                    'data-[highlighted]:bg-[var(--color-muted)] data-[disabled]:opacity-50',
                  )}
                >
                  <SelectPrimitive.ItemIndicator className="absolute left-2">
                    <Check className="h-4 w-4" />
                  </SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
    </div>
  );
}

export function CommuneSelect(props: Omit<SelectProps, 'options'>) {
  const options: SelectOption[] = KINSHASA_COMMUNES.map((c) => ({ value: c, label: c }));
  return <Select {...props} options={options} searchable placeholder="Choisir une commune..." />;
}

export interface MultiSelectProps {
  options: SelectOption[];
  values: string[];
  onValuesChange: (values: string[]) => void;
  label?: string;
  placeholder?: string;
}

export function MultiSelect({ options, values, onValuesChange, label, placeholder }: MultiSelectProps) {
  const toggle = (val: string) => {
    onValuesChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val]);
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium">{label}</label>}
      <div className="flex flex-wrap gap-2 rounded-lg border border-[var(--color-input)] p-2">
        {values.length === 0 && (
          <span className="text-sm text-[var(--color-muted-foreground)]">{placeholder ?? 'Sélectionner...'}</span>
        )}
        {options
          .filter((o) => values.includes(o.value))
          .map((o) => (
            <span key={o.value} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-2 py-1 text-xs">
              {o.label}
              <button type="button" onClick={() => toggle(o.value)} aria-label={`Retirer ${o.label}`}>×</button>
            </span>
          ))}
      </div>
      <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--color-border)]">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-[var(--color-muted)]">
            <input type="checkbox" checked={values.includes(o.value)} onChange={() => toggle(o.value)} />
            <span className="text-sm">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
