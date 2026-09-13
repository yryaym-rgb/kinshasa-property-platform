import { useFormContext } from 'react-hook-form';
import { Building2, Home, Store, Warehouse, Building } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { PROPERTY_TYPES } from '@/config/app.config';
import type { PropertyWizardFormData } from './schema';

const TYPE_ICONS: Record<string, typeof Building2> = {
  Appartement: Building2,
  Studio: Home,
  Villa: Home,
  Bureau: Building,
  Magasin: Store,
  'Entrepôt': Warehouse,
};

export function Step2Features() {
  const { register, setValue, watch, formState: { errors } } = useFormContext<PropertyWizardFormData>();
  const selectedType = watch('type');

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium">Type de logement</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PROPERTY_TYPES.filter((t) => t !== 'Entrepôt').map((type) => {
            const Icon = TYPE_ICONS[type] ?? Building2;
            const isSelected = selectedType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setValue('type', type, { shouldValidate: true })}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors',
                  isSelected
                    ? 'border-[var(--color-kinshasa-gold)] bg-amber-50'
                    : 'border-[var(--color-border)] hover:border-[var(--color-kinshasa-blue)]',
                )}
              >
                <Icon className="h-8 w-8 text-[var(--color-kinshasa-blue)]" />
                <span className="text-sm font-medium">{type}</span>
              </button>
            );
          })}
        </div>
        {errors.type && <p className="mt-1 text-sm text-[var(--color-destructive)]">{errors.type.message}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nombre de pièces"
          type="number"
          min={1}
          {...register('rooms')}
          error={errors.rooms?.message}
        />
        <Input label="Nombre de chambres" type="number" min={0} {...register('chambres')} />
        <Input label="Salles de bain" type="number" min={0} {...register('sallesDeBain')} />
        <Input
          label="Superficie (m²)"
          type="number"
          step="0.01"
          {...register('surfaceM2')}
          error={errors.surfaceM2?.message}
        />
        <Input label="Étage (optionnel)" type="number" {...register('etage')} />
      </div>
    </div>
  );
}
