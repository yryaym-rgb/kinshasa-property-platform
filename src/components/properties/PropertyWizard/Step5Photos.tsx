import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useFormContext } from 'react-hook-form';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PropertyCard } from '@/components/properties/PropertyCard';
import type { PropertyWizardFormData } from './schema';
import type { Logement } from '@/types/database.types';

export function Step5Photos() {
  const { watch, setValue } = useFormContext<PropertyWizardFormData>();
  const photos = watch('photos') ?? [];
  const description = watch('description') ?? '';

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const remaining = 10 - photos.length;
      const toAdd = acceptedFiles.slice(0, remaining);
      toAdd.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setValue('photos', [...photos, reader.result]);
          }
        };
        reader.readAsDataURL(file);
      });
    },
    [photos, setValue],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxSize: 5 * 1024 * 1024,
    disabled: photos.length >= 10,
  });

  const removePhoto = (index: number) => {
    setValue('photos', photos.filter((_, i) => i !== index));
  };

  const previewProperty: Logement = {
    id: 'preview',
    bailleur_id: '',
    code: 'KIN-XXX-XXX-XXX-XXX',
    type: (watch('type') ?? 'Appartement') as Logement['type'],
    status: 'disponible',
    commune: watch('commune') ?? 'Gombe',
    address: `${watch('numero') ?? ''}, Av. ${watch('avenue') ?? ''}`,
    quartier: watch('quartier') ?? null,
    avenue: watch('avenue') ?? null,
    parcelle: watch('parcelle') ?? null,
    loyer_mensuel: watch('loyerMensuel') ?? 0,
    currency: 'CDF',
    rooms: watch('rooms') ?? null,
    surface_m2: watch('surfaceM2') ?? null,
    coordinates: null,
    photos: photos.length > 0 ? photos : null,
    documents: null,
    description: description || null,
    is_occupied: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={cn(
          'cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors',
          isDragActive ? 'border-[var(--color-kinshasa-gold)] bg-amber-50' : 'border-[var(--color-border)]',
          photos.length >= 10 && 'cursor-not-allowed opacity-50',
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-10 w-10 text-[var(--color-muted-foreground)]" />
        <p className="mt-2 font-medium">Glissez vos photos ici</p>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Maximum 10 images, 5 Mo chacune ({photos.length}/10)
        </p>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {photos.map((photo, index) => (
            <div key={index} className="relative aspect-square overflow-hidden rounded-lg">
              <img src={photo} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white"
                aria-label="Supprimer la photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setValue('description', e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Décrivez votre logement..."
          className="w-full rounded-lg border border-[var(--color-border)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-right text-xs text-[var(--color-muted-foreground)]">
          {description.length}/1000
        </p>
      </div>

      <div>
        <p className="mb-3 flex items-center gap-2 text-sm font-medium">
          <ImageIcon className="h-4 w-4" />
          Aperçu de l&apos;annonce
        </p>
        <div className="max-w-sm">
          <PropertyCard property={previewProperty} />
        </div>
      </div>
    </div>
  );
}
