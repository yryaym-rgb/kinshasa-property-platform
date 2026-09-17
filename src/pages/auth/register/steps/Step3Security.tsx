import { Link } from 'react-router-dom';
import { useT } from '@/i18n';
import type { RegisterDraft } from '@/lib/authStorage';
import { validate, type FieldErrors } from '@/validations/authSchemas';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { Checkbox, TextField } from '@/components/auth/primitives';
import { KeyIcon } from '@/components/landing/icons';
import { registerSecuritySchema } from '../schemas/step3.schema';
import type { SecurityField } from '../wizard';

export interface SecurityValues {
  password: string;
  confirm: string;
  pin: string;
  acceptTerms: boolean;
}

interface Step3SecurityProps {
  values: SecurityValues;
  onPasswordChange: (password: string) => void;
  onConfirmChange: (confirm: string) => void;
  onPinChange: (pin: string) => void;
  notifications: RegisterDraft['notifications'];
  patch: (changes: Partial<RegisterDraft>) => void;
  errors: FieldErrors<SecurityField>;
  onErrorsChange: (update: (errors: FieldErrors<SecurityField>) => FieldErrors<SecurityField>) => void;
}

export function validateStep3(values: SecurityValues): FieldErrors<SecurityField> {
  return validate<typeof registerSecuritySchema, SecurityField>(registerSecuritySchema, values).errors;
}

/**
 * Step 3 — credentials. Lazy-loaded together with the strength meter and its
 * schema; the Supabase SDK is only needed when this step is submitted.
 */
export function Step3Security({
  values,
  onPasswordChange,
  onConfirmChange,
  onPinChange,
  notifications,
  patch,
  errors,
  onErrorsChange,
}: Step3SecurityProps) {
  const t = useT();
  const { password, confirm, pin, acceptTerms } = values;

  return (
    <>
      <div className="auth-form" style={{ gap: 12 }}>
        <PasswordInput
          id="register-password"
          label={t('register.password')}
          placeholder={t('register.password.placeholder')}
          autoComplete="new-password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          error={errors.password ? t(errors.password) : undefined}
          aria-describedby="password-strength"
          autoFocus
          required
        />
        <PasswordStrengthMeter password={password} />
      </div>
      <PasswordInput
        id="register-confirm"
        label={t('register.confirm')}
        placeholder={t('register.confirm.placeholder')}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => onConfirmChange(e.target.value)}
        error={errors.confirm ? t(errors.confirm) : undefined}
        success={confirm && confirm === password ? t('register.confirm.match') : undefined}
        required
      />
      <TextField
        id="register-pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        label={t('register.pin')}
        hint={`(${t('common.optional').toLowerCase()})`}
        placeholder="••••"
        icon={<KeyIcon size={20} />}
        help={t('register.pin.help')}
        value={pin}
        onChange={(e) => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        error={errors.pin ? t(errors.pin) : undefined}
        mono
      />
      <div className="grid gap-4 pt-1">
        <Checkbox
          id="register-acceptTerms"
          checked={acceptTerms}
          onChange={(e) => {
            patch({ acceptTerms: e.target.checked });
            if (e.target.checked) onErrorsChange((current) => ({ ...current, acceptTerms: undefined }));
          }}
          error={errors.acceptTerms ? t(errors.acceptTerms) : undefined}
          required
          label={
            <>
              {t('register.terms.prefix')}
              <Link to="/conditions" className="auth-link" target="_blank" rel="noreferrer">
                {t('common.terms')}
              </Link>
              {t('register.terms.and')}
              <Link to="/confidentialite" className="auth-link" target="_blank" rel="noreferrer">
                {t('common.privacy')}
              </Link>
            </>
          }
        />
        <Checkbox
          id="register-notifications"
          checked={notifications}
          onChange={(e) => patch({ notifications: e.target.checked })}
          label={t('register.notifications')}
        />
      </div>
    </>
  );
}
