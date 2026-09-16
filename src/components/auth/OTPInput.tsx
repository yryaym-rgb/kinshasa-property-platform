import { useCallback, useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

export interface OTPInputProps {
  /** Digits entered so far (0–`length` characters). */
  value: string;
  onChange: (value: string) => void;
  /** Called once when the last digit is filled. */
  onComplete?: (code: string) => void;
  length?: number;
  status?: 'idle' | 'error' | 'success';
  disabled?: boolean;
  autoFocus?: boolean;
  /** Re-triggers the shake animation on every increment. */
  shakeKey?: number;
  label?: string;
}

/**
 * Six individual boxes with auto-advance, backspace-to-previous, arrow-key
 * navigation, paste/autofill splitting and auto-submit on completion.
 */
export function OTPInput({
  value,
  onChange,
  onComplete,
  length = 6,
  status = 'idle',
  disabled = false,
  autoFocus = false,
  shakeKey = 0,
  label,
}: OTPInputProps) {
  const t = useT();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const completedFor = useRef<string | null>(null);

  const focusBox = useCallback((index: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, index))];
    el?.focus();
    el?.select();
  }, [length]);

  useEffect(() => {
    if (autoFocus && !disabled) focusBox(0);
  }, [autoFocus, disabled, focusBox]);

  useEffect(() => {
    if (value.length === length && completedFor.current !== value) {
      completedFor.current = value;
      onComplete?.(value);
    }
    if (value.length < length) completedFor.current = null;
  }, [value, length, onComplete]);

  const commit = (next: string, caret: number) => {
    onChange(next.slice(0, length));
    focusBox(caret);
  };

  const handleInput = (index: number, raw: string) => {
    let digits = raw.replace(/\D/g, '');
    const existing = value[index];
    // Typing over an unselected filled box yields "<old><new>" — keep only the new digit.
    if (existing && digits.length === 2) {
      digits = digits.startsWith(existing) ? digits.slice(1) : digits.slice(0, 1);
    }
    if (!digits) {
      // Non-digit typed into a box: keep state, clear the box.
      commit(value.slice(0, index) + value.slice(index + 1), index);
      return;
    }
    // Autofill / multi-character input lands here as well as single keystrokes.
    const next = (value.slice(0, index) + digits + value.slice(index + digits.length)).slice(0, length);
    commit(next, index + digits.length);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Backspace': {
        e.preventDefault();
        if (value[index]) {
          commit(value.slice(0, index) + value.slice(index + 1), index);
        } else if (index > 0) {
          commit(value.slice(0, index - 1) + value.slice(index), index - 1);
        }
        break;
      }
      case 'Delete':
        e.preventDefault();
        commit(value.slice(0, index) + value.slice(index + 1), index);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        focusBox(index - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        focusBox(index + 1);
        break;
      case 'Home':
        e.preventDefault();
        focusBox(0);
        break;
      case 'End':
        e.preventDefault();
        focusBox(Math.min(value.length, length - 1));
        break;
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (digits) commit(digits, digits.length);
  };

  return (
    <div
      key={shakeKey}
      role="group"
      aria-label={label ?? t('otp.inputLabel')}
      className={cn(
        'auth-otp',
        status === 'error' && 'auth-otp--error auth-shake',
        status === 'success' && 'auth-otp--success',
        disabled && 'auth-otp--locked',
      )}
      onPaste={handlePaste}
    >
      {Array.from({ length }, (_, index) => {
        const digit = value[index] ?? '';
        return (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={index === 0 ? length : 1}
            value={digit}
            disabled={disabled}
            aria-label={t('otp.digit', { index: index + 1 })}
            aria-invalid={status === 'error' ? true : undefined}
            className={cn('auth-otp__box', digit && 'auth-otp__box--filled')}
            onChange={(e) => handleInput(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={(e) => e.target.select()}
          />
        );
      })}
    </div>
  );
}
