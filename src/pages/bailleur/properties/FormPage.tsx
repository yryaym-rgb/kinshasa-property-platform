import { useEffect, useCallback, useState } from 'react';
import { useNavigate, useParams, useBlocker } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/common/PageHeader';
import { Stepper } from '@/components/properties/PropertyWizard/Stepper';
import { Step1Location } from '@/components/properties/PropertyWizard/Step1Location';
import { Step2Features } from '@/components/properties/PropertyWizard/Step2Features';
import { Step3Pricing } from '@/components/properties/PropertyWizard/Step3Pricing';
import { Step4Amenities } from '@/components/properties/PropertyWizard/Step4Amenities';
import { Step5Photos } from '@/components/properties/PropertyWizard/Step5Photos';
import { Step6Summary } from '@/components/properties/PropertyWizard/Step6Summary';
import {
  propertyWizardSchema,
  DRAFT_STORAGE_KEY,
  type PropertyWizardFormData,
} from '@/components/properties/PropertyWizard/schema';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useCreateProperty, useUpdateProperty } from '@/hooks/useProperties';
import { useProperty } from '@/hooks/useProperty';
import { getPropertyMetadata } from '@/utils/propertyUtils';
import { ROUTES } from '@/config/routes';
import type { KinshasaCommune, PropertyType } from '@/types';

const STEP_FIELDS: Record<number, (keyof PropertyWizardFormData)[]> = {
  1: ['commune', 'quartier', 'avenue', 'numero'],
  2: ['type', 'rooms', 'surfaceM2'],
  3: ['loyerMensuel', 'paymentDay'],
  4: [],
  5: [],
  6: [],
};

function formToPayload(data: PropertyWizardFormData) {
  const address = `${data.numero}, Av. ${data.avenue}`;
  return {
    type: data.type as PropertyType,
    commune: data.commune as KinshasaCommune,
    quartier: data.quartier,
    avenue: data.avenue,
    parcelle: data.parcelle,
    address,
    loyerMensuel: data.loyerMensuel,
    currency: data.currency,
    rooms: data.rooms,
    surfaceM2: data.surfaceM2,
    description: data.description,
    coordinates: data.coordinates,
    photos: data.photos,
    metadata: {
      province: data.province,
      ville: data.ville,
      numero: data.numero,
      immeuble: data.immeuble,
      appartement: data.appartement,
      chambres: data.chambres,
      sallesDeBain: data.sallesDeBain,
      etage: data.etage,
      chargesMensuelles: data.chargesMensuelles,
      depotGarantie: data.depotGarantie,
      paymentDay: data.paymentDay,
      amenities: data.amenities,
    },
  };
}

export function PropertyFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [dirty, setDirty] = useState(false);

  const { data: existingProperty } = useProperty(id);
  const createMutation = useCreateProperty();
  const updateMutation = useUpdateProperty(id);

  const methods = useForm<PropertyWizardFormData>({
    resolver: zodResolver(propertyWizardSchema) as never,
    defaultValues: {
      province: 'Kinshasa',
      ville: 'Kinshasa',
      commune: 'Gombe',
      currency: 'CDF',
      paymentDay: 5,
      amenities: [],
      photos: [],
      type: 'Appartement',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (existingProperty && isEdit) {
      const meta = getPropertyMetadata(existingProperty);
      methods.reset({
        province: meta.province ?? 'Kinshasa',
        ville: meta.ville ?? 'Kinshasa',
        commune: existingProperty.commune as KinshasaCommune,
        quartier: existingProperty.quartier ?? '',
        avenue: existingProperty.avenue ?? '',
        numero: meta.numero ?? '',
        parcelle: existingProperty.parcelle ?? '',
        immeuble: meta.immeuble ?? '',
        appartement: meta.appartement ?? '',
        coordinates: existingProperty.coordinates as { lat: number; lng: number } | undefined,
        type: existingProperty.type,
        rooms: existingProperty.rooms ?? 1,
        chambres: meta.chambres,
        sallesDeBain: meta.sallesDeBain,
        surfaceM2: Number(existingProperty.surface_m2) || 1,
        etage: meta.etage,
        loyerMensuel: Number(existingProperty.loyer_mensuel),
        chargesMensuelles: meta.chargesMensuelles ?? 0,
        depotGarantie: meta.depotGarantie ?? 0,
        paymentDay: meta.paymentDay ?? 5,
        currency: existingProperty.currency as 'CDF' | 'USD',
        amenities: meta.amenities ?? [],
        photos: existingProperty.photos ?? [],
        description: existingProperty.description ?? '',
      });
    }
  }, [existingProperty, isEdit, methods]);

  useEffect(() => {
    if (!isEdit) {
      const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) {
        try {
          methods.reset(JSON.parse(draft) as PropertyWizardFormData);
        } catch { /* ignore */ }
      }
    }
  }, [isEdit, methods]);

  useEffect(() => {
    const subscription = methods.watch(() => setDirty(true));
    return () => subscription.unsubscribe();
  }, [methods]);

  useEffect(() => {
    if (!isEdit && dirty) {
      const interval = setInterval(() => {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(methods.getValues()));
      }, 30_000);
      return () => clearInterval(interval);
    }
  }, [isEdit, dirty, methods]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const blocker = useBlocker(dirty && !createMutation.isPending && !updateMutation.isPending);

  const handleNext = async () => {
    const fields = STEP_FIELDS[step] ?? [];
    if (fields.length > 0) {
      const valid = await methods.trigger(fields);
      if (!valid) return;
    }
    setStep((s) => Math.min(s + 1, 6));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    const valid = await methods.trigger();
    if (!valid) return;

    const payload = formToPayload(methods.getValues());

    if (isEdit && id) {
      await updateMutation.mutateAsync(payload);
      navigate(ROUTES.BAILLEUR.PROPERTY_DETAIL.replace(':id', id));
    } else {
      const created = await createMutation.mutateAsync(payload);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      navigate(ROUTES.BAILLEUR.PROPERTY_DETAIL.replace(':id', created.id));
    }
    setDirty(false);
  };

  const renderStep = useCallback(() => {
    switch (step) {
      case 1: return <Step1Location />;
      case 2: return <Step2Features />;
      case 3: return <Step3Pricing />;
      case 4: return <Step4Amenities />;
      case 5: return <Step5Photos />;
      case 6: return <Step6Summary />;
      default: return null;
    }
  }, [step]);

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Modifier le logement' : 'Ajouter un logement'}
        subtitle={`Étape ${step} sur 6`}
      />

      {blocker.state === 'blocked' && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm">Vous avez des modifications non enregistrées.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="danger" onClick={() => blocker.proceed?.()}>Quitter</Button>
            <Button size="sm" variant="outline" onClick={() => blocker.reset?.()}>Continuer</Button>
          </div>
        </div>
      )}

      <Stepper currentStep={step} />

      <Card>
        <CardContent className="p-6">
          <FormProvider {...methods}>
            {renderStep()}
          </FormProvider>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={step === 1}>
          Précédent
        </Button>
        {step < 6 ? (
          <Button onClick={handleNext}>Suivant</Button>
        ) : (
          <Button
            loading={createMutation.isPending || updateMutation.isPending}
            onClick={handleSubmit}
          >
            {isEdit ? 'Enregistrer' : 'Enregistrer le logement'}
          </Button>
        )}
      </div>
    </div>
  );
}
