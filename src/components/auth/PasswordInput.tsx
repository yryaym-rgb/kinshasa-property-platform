import { forwardRef, useState } from 'react';
import { useT } from '@/i18n';
import { EyeIcon, EyeOffIcon, LockIcon } from '@/components/landing/icons';
import { TextField, type TextFieldProps } from './primitives';

export type PasswordInputProps = Omit<TextFieldProps, 'type' | 'icon' | 'suffix'>;

/** Password field with a lock prefix and a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { autoComplete = 'current-password', ...rest },
  ref,
) {
  const t = useT();
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      ref={ref}
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      autoCapitalize="off"
      spellCheck={false}
      icon={<LockIcon size={20} />}
      suffix={
        <button
          type="button"
          className="auth-iconbtn"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('phone.hidePassword') : t('phone.showPassword')}
          aria-pressed={visible}
        >
          {visible ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
        </button>
      }
      {...rest}
    />
  );
});
