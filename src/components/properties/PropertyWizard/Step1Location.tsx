import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PropertyMapPicker } from '@/components/properties/PropertyMapPicker';
import { KINSHASA_COMMUNES } from '@/config/communes';
import type { PropertyWizardFormData } from './schema';

export function Step1Location() {
  const { register, setValue, watch, formState: { errors } } = useFormContext<PropertyWizardFormData>();
  const coordinates = watch('coordinates');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Province" {...register('province')} disabled />
        <Input label="Ville" {...register('ville')} disabled />
      </div>
      <Select
        label="Commune *"
        options={KINSHASA_COMMUNES.map((c) => ({ value: c, label: c }))}
        value={watch('commune') ?? ''}
        onValueChange={(v) => setValue('commune', v as PropertyWizardFormData['commune'], { shouldValidate: true })}
        error={errors.commune?.message}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Quartier" required {...register('quartier')} error={errors.quartier?.message} />
        <Input label="Avenue" required {...register('avenue')} error={errors.avenue?.message} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Numéro" required {...register('numero')} error={errors.numero?.message} />
        <Input label="Parcelle" {...register('parcelle')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Immeuble (optionnel)" {...register('immeuble')} />
        <Input label="Appartement (optionnel)" {...register('appartement')} />
      </div>
      <PropertyMapPicker
        value={coordinates}
        onChange={(coords) => setValue('coordinates', coords, { shouldValidate: true })}
      />
    </div>
  );
}
