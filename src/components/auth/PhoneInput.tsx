import { forwardRef, useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useT } from '@/i18n';
import {
  DRC_DIAL_CODE,
  detectOperator,
  formatNationalDigits,
  OPERATOR_COLORS,
  toNationalDigits,
  type DRCOperator,
} from '@/lib/phone';
import { DRCFlag } from '@/components/landing/icons';
import { TextField } from './primitives';

export interface PhoneInputProps {
  /** Nine national digits (unformatted). */
  value: string;
  onChange: (digits: string) => void;
  label?: ReactNode;
  help?: ReactNode;
  error?: string;
  id?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  onBlur?: () => void;
}

const OPERATOR_KEYS: Record<DRCOperator, 'phone.operator.orange' | 'phone.operator.vodacom' | 'phone.operator.airtel' | 'phone.operator.africell'> = {
  orange: 'phone.operator.orange',
  vodacom: 'phone.operator.vodacom',
  airtel: 'phone.operator.airtel',
  africell: 'phone.operator.africell',
};

/**
 * DRC mobile number input: fixed +243 prefix, live "812 345 678" formatting
 * with caret preservation, and operator detection from the network prefix.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { value, onChange, label, help, error, id, autoFocus, disabled, required, autoComplete = 'tel', onBlur },
  forwardedRef,
) {
  const t = useT();
  const innerRef = useRef<HTMLInputElement | null>(null);
  const [caretDigits, setCaretDigits] = useState<number | null>(null);

  const setRefs = (el: HTMLInputElement | null) => {
    innerRef.current = el;
    if (typeof forwardedRef === 'function') forwardedRef(el);
    else if (forwardedRef) forwardedRef.current = el;
  };

  const formatted = formatNationalDigits(value);
  const operator = value.length >= 3 ? detectOperator(value) : null;

  // After React re-renders the formatted value, put the caret back after the
  // same number of digits the user had typed before.
  useLayoutEffect(() => {
    if (caretDigits === null || !innerRef.current) return;
    let seen = 0;
    let pos = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (seen === caretDigits) {
        pos = i;
        break;
      }
      if (/\d/.test(formatted[i]!)) seen++;
    }
    innerRef.current.setSelectionRange(pos, pos);
    setCaretDigits(null);
  }, [formatted, caretDigits]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    const digitsBeforeCaret = toNationalDigits(raw.slice(0, caret)).length;
    const digits = toNationalDigits(raw);
    setCaretDigits(Math.min(digitsBeforeCaret, digits.length));
    onChange(digits);
  };

  return (
    <TextField
      ref={setRefs}
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete={autoComplete}
      label={label ?? t('login.phone.label')}
      help={help}
      error={error}
      value={formatted}
      onChange={handleChange}
      onBlur={onBlur}
      placeholder="812 345 678"
      autoFocus={autoFocus}
      disabled={disabled}
      required={required}
      maxLength={11}
      mono
      prefix={
        <>
          <DRCFlag width={22} title="République Démocratique du Congo" />
          <span>{DRC_DIAL_CODE}</span>
        </>
      }
      suffix={
        operator ? (
          <span className="auth-operator" style={{ '--dot': OPERATOR_COLORS[operator] } as React.CSSProperties}>
            <span className="auth-operator__dot" aria-hidden="true" />
            <span className="sr-only">{t('phone.operatorDetected', { operator: t(OPERATOR_KEYS[operator]) })}</span>
            <span aria-hidden="true">{t(OPERATOR_KEYS[operator])}</span>
          </span>
        ) : undefined
      }
    />
  );
});
