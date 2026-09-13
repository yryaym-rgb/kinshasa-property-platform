import { useFormContext } from 'react-hook-form';
import { formatCDF } from '@/lib/utils';
import { previewPropertyCode } from '@/utils/propertyUtils';
import type { KinshasaCommune, PropertyType } from '@/types';
import type { PropertyWizardFormData } from './schema';

export function Step6Summary() {
  const { watch } = useFormContext<PropertyWizardFormData>();
  const data = watch();

  const codePreview = previewPropertyCode(
    data.commune as KinshasaCommune,
    data.avenue,
    data.parcelle,
    data.type as PropertyType,
  );

  const sections = [
    {
      title: 'Localisation',
      items: [
        ['Commune', data.commune],
        ['Quartier', data.quartier],
        ['Avenue', data.avenue],
        ['Numéro', data.numero],
        ['Parcelle', data.parcelle || '—'],
        ['Immeuble', data.immeuble || '—'],
        ['Appartement', data.appartement || '—'],
      ],
    },
    {
      title: 'Caractéristiques',
      items: [
        ['Type', data.type],
        ['Pièces', data.rooms],
        ['Chambres', data.chambres ?? '—'],
        ['Salles de bain', data.sallesDeBain ?? '—'],
        ['Superficie', `${data.surfaceM2} m²`],
        ['Étage', data.etage ?? '—'],
      ],
    },
    {
      title: 'Loyer',
      items: [
        ['Loyer mensuel', formatCDF(data.loyerMensuel ?? 0)],
        ['Charges', formatCDF(data.chargesMensuelles ?? 0)],
        ['Dépôt de garantie', formatCDF(data.depotGarantie ?? 0)],
        ["Jour d'échéance", `Le ${data.paymentDay} de chaque mois`],
      ],
    },
    {
      title: 'Équipements',
      items: [['Sélectionnés', (data.amenities ?? []).join(', ') || 'Aucun']],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--color-kinshasa-gold)] bg-amber-50 p-4">
        <p className="text-sm text-[var(--color-muted-foreground)]">Code logement (prévisualisation)</p>
        <p className="mt-1 font-mono text-lg font-bold text-[var(--color-kinshasa-blue)]">{codePreview}</p>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Le code définitif sera généré automatiquement à l&apos;enregistrement.
        </p>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="mb-2 font-semibold">{section.title}</h3>
          <dl className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {section.items.map(([label, value]) => (
              <div key={label} className="flex justify-between px-4 py-2 text-sm">
                <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
                <dd className="font-medium text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      {(data.photos ?? []).length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">Photos ({data.photos?.length})</h3>
          <div className="flex gap-2 overflow-x-auto">
            {data.photos?.map((photo, i) => (
              <img key={i} src={photo} alt="" className="h-16 w-16 rounded object-cover" />
            ))}
          </div>
        </div>
      )}

      {data.description && (
        <div>
          <h3 className="mb-2 font-semibold">Description</h3>
          <p className="text-sm text-[var(--color-muted-foreground)]">{data.description}</p>
        </div>
      )}
    </div>
  );
}
