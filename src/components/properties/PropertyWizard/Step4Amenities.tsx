import { useFormContext } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { PROPERTY_AMENITIES } from '@/utils/propertyUtils';
import type { PropertyWizardFormData } from './schema';

export function Step4Amenities() {
  const { watch, setValue } = useFormContext<PropertyWizardFormData>();
  const amenities = watch('amenities') ?? [];

  const toggle = (amenity: string) => {
    const next = amenities.includes(amenity)
      ? amenities.filter((a) => a !== amenity)
      : [...amenities, amenity];
    setValue('amenities', next);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PROPERTY_AMENITIES.map((amenity) => {
        const checked = amenities.includes(amenity);
        return (
          <label
            key={amenity}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
              checked
                ? 'border-[var(--color-kinshasa-gold)] bg-amber-50'
                : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]',
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(amenity)}
              className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-kinshasa-gold)]"
            />
            <span className="text-sm">{amenity}</span>
          </label>
        );
      })}
    </div>
  );
}
