import { useState, useCallback } from 'react';
import { Input } from './Input';
import { formatPhone, normalizePhone, isValidDRCPhone } from '@/lib/utils';

const OPERATOR_PREFIXES: Record<string, string> = {
  '81': 'Orange',
  '82': 'Orange',
  '84': 'Orange',
  '85': 'Orange',
  '89': 'Orange',
  '90': 'Vodacom (M-Pesa)',
  '91': 'Vodacom (M-Pesa)',
  '97': 'Airtel',
  '98': 'Airtel',
  '99': 'Africell',
};

function getOperator(phone: string): string | null {
  const normalized = normalizePhone(phone);
  const prefix = normalized.slice(4, 6);
  return OPERATOR_PREFIXES[prefix] ?? null;
}

export interface PhoneInputProps {
  value?: string;
  onChange?: (value: string, isValid: boolean) => void;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  showOperator?: boolean;
}

export function PhoneInput({
  value = '',
  onChange,
  label = 'Numéro de téléphone',
  error,
  required,
  disabled,
  showOperator = true,
}: PhoneInputProps) {
  const [localValue, setLocalValue] = useState(value);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^\d+\s]/g, '');
      setLocalValue(raw);
      const normalized = normalizePhone(raw);
      onChange?.(normalized, isValidDRCPhone(normalized));
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    if (localValue) {
      const formatted = formatPhone(localValue);
      setLocalValue(formatted.replace('+243 ', ''));
    }
  }, [localValue]);

  const operator = showOperator && localValue ? getOperator(localValue) : null;
  const validationError = localValue && !isValidDRCPhone(normalizePhone(localValue))
    ? 'Numéro invalide. Format: +243 8XX XXX XXX'
    : undefined;

  return (
    <div>
      <Input
        type="tel"
        label={label}
        prefix="+243"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        error={error ?? validationError}
        required={required}
        disabled={disabled}
        placeholder="8XX XXX XXX"
        helpText={operator ? `Opérateur détecté: ${operator}` : 'Orange, Vodacom, Airtel ou Africell'}
        autoComplete="tel"
      />
    </div>
  );
}
