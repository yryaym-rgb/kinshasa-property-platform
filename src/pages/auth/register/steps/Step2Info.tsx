import { useT } from '@/i18n';
import { KINSHASA_COMMUNES } from '@/config/communes';
import type { RegisterDraft } from '@/lib/authStorage';
import { validate, type FieldErrors } from '@/validations/authSchemas';
import { PhoneInput } from '@/components/auth/PhoneInput';
import { DocumentUpload } from '@/components/auth/DocumentUpload';
import { SelectField, TextField } from '@/components/auth/primitives';
import { AtIcon, HomeIcon, MapPinIcon, UserIcon } from '@/components/landing/icons';
import { registerDetailsSchema } from '../schemas/step2.schema';
import { isProfessional, type DetailsField } from '../wizard';

interface Step2InfoProps {
  draft: RegisterDraft;
  patch: (changes: Partial<RegisterDraft>) => void;
  idFile: File | null;
  onFileChange: (file: File | null) => void;
  errors: FieldErrors<DetailsField>;
}

/** Validates the personal-details step; returns one error key per field (empty when valid). */
export function validateStep2(draft: RegisterDraft, idFile: File | null): FieldErrors<DetailsField> {
  const result = validate<typeof registerDetailsSchema, DetailsField>(registerDetailsSchema, {
    fullName: draft.fullName,
    phone: draft.phone,
    email: draft.email,
    commune: draft.commune,
    address: draft.address,
  });
  const errors: FieldErrors<DetailsField> = { ...result.errors };
  if (isProfessional(draft.role)) {
    if (!draft.email.trim() && !errors.email) errors.email = 'register.email.required';
    if (!idFile && !errors.document) errors.document = 'register.idDoc.required';
  }
  return errors;
}

/**
 * Step 2 — personal details. Lazy-loaded: the phone input (operator
 * detection), the commune list, the document dropzone and this step's schema
 * only download once the citizen has picked a profile.
 */
export function Step2Info({ draft, patch, idFile, onFileChange, errors }: Step2InfoProps) {
  const t = useT();
  const professional = isProfessional(draft.role);
  const optional = `(${t('common.optional').toLowerCase()})`;

  return (
    <>
      <TextField
        id="register-fullName"
        label={t('register.fullName')}
        placeholder={t('register.fullName.placeholder')}
        icon={<UserIcon size={20} />}
        autoComplete="name"
        autoCapitalize="words"
        value={draft.fullName}
        onChange={(e) => patch({ fullName: e.target.value })}
        error={errors.fullName ? t(errors.fullName) : undefined}
        autoFocus
        required
      />
      <PhoneInput
        id="register-phone"
        label={t('register.phone')}
        help={t('register.phone.help')}
        value={draft.phone}
        onChange={(phone) => patch({ phone })}
        error={errors.phone ? t(errors.phone) : undefined}
        required
      />
      <TextField
        id="register-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="off"
        label={t('register.email')}
        hint={professional ? undefined : optional}
        placeholder={t('login.email.placeholder')}
        icon={<AtIcon size={20} />}
        help={professional ? t('register.email.help.pro') : t('register.email.help.locataire')}
        value={draft.email}
        onChange={(e) => patch({ email: e.target.value })}
        error={errors.email ? t(errors.email) : undefined}
        required={professional}
      />
      <SelectField
        id="register-commune"
        label={t('register.commune')}
        icon={<MapPinIcon size={20} />}
        placeholder={t('register.commune.placeholder')}
        options={KINSHASA_COMMUNES}
        value={draft.commune}
        onChange={(e) => patch({ commune: e.target.value as RegisterDraft['commune'] })}
        error={errors.commune ? t(errors.commune) : undefined}
        autoComplete="address-level2"
        required
      />
      <TextField
        id="register-address"
        label={t('register.address')}
        hint={optional}
        placeholder={t('register.address.placeholder')}
        icon={<HomeIcon size={20} />}
        autoComplete="street-address"
        value={draft.address}
        onChange={(e) => patch({ address: e.target.value })}
      />
      <DocumentUpload
        file={idFile}
        onChange={onFileChange}
        label={t('register.idDoc')}
        hint={professional ? undefined : optional}
        help={t('register.idDoc.help')}
        error={errors.document ? t(errors.document) : undefined}
        stale={draft.document}
      />
    </>
  );
}
