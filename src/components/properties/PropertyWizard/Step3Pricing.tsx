import { useFormContext } from 'react-hook-form';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import type { PropertyWizardFormData } from './schema';

export function Step3Pricing() {
  const { setValue, watch, formState: { errors } } = useFormContext<PropertyWizardFormData>();

  return (
    <div className="space-y-6">
      <CurrencyInput
        label="Loyer mensuel *"
        currency="CDF"
        value={watch('loyerMensuel') ?? 0}
        onChange={(v) => setValue('loyerMensuel', v, { shouldValidate: true })}
        error={errors.loyerMensuel?.message}
      />
      <CurrencyInput
        label="Charges mensuelles"
        currency="CDF"
        value={watch('chargesMensuelles') ?? 0}
        onChange={(v) => setValue('chargesMensuelles', v, { shouldValidate: true })}
      />
      <CurrencyInput
        label="Dépôt de garantie"
        currency="CDF"
        value={watch('depotGarantie') ?? 0}
        onChange={(v) => setValue('depotGarantie', v, { shouldValidate: true })}
      />
      <Input
        label="Jour d'échéance (1-31)"
        type="number"
        min={1}
        max={31}
        value={watch('paymentDay') ?? 5}
        onChange={(e) => setValue('paymentDay', parseInt(e.target.value, 10) || 5, { shouldValidate: true })}
        error={errors.paymentDay?.message}
      />
    </div>
  );
}
