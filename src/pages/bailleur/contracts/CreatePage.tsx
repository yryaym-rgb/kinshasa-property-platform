import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, useBlocker } from 'react-router-dom';
import { Check, Home, Search, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { ContractPreview } from '@/components/contracts/ContractPreview';
import {
  DRAFT_STORAGE_KEY,
  WIZARD_STEPS,
  type CreateContractFormData,
} from '@/components/contracts/schema';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { FileUpload } from '@/components/ui/FileUpload';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Select, CommuneSelect } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  useCreateContract,
  useSendContractInvitation,
  useSignContract,
  useGenerateContractPdf,
  useUpdateContract,
} from '@/hooks/useContracts';
import { useContract } from '@/hooks/useContract';
import { useProperties } from '@/hooks/useProperties';
import { useAuth } from '@/hooks/useAuth';
import { createTenantUser, searchTenantsForBailleur } from '@/services/contract/contractService';
import { sendOTP } from '@/services/auth.service';
import { useBailleurId } from '@/hooks/useProperties';
import { calculateEndDate } from '@/utils/contractUtils';
import { formatCurrency, getInitials } from '@/lib/utils';
import { ROUTES } from '@/config/routes';
import type { Logement } from '@/types/database.types';
import type { User } from '@/types/database.types';

interface WizardState {
  step: number;
  logementId?: string;
  locataireId?: string;
  locataire?: Pick<User, 'id' | 'full_name' | 'phone' | 'email' | 'avatar_url'>;
  dateDebut: string;
  dateFin?: string;
  dureeMois: number;
  customDuration: boolean;
  loyerMensuel: number;
  chargesMensuelles: number;
  depotGarantie: number;
  currency: 'CDF' | 'USD';
  paymentDay: number;
  paymentFrequency: 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel';
  conditionsParticulieres: string;
  addendums: Array<{ name: string; url: string; path: string }>;
  certifie: boolean;
  newTenantMode: boolean;
  newTenantPhone: string;
  newTenantName: string;
  newTenantEmail: string;
  newTenantAddress: string;
  tenantVerified: boolean;
}

const today = new Date().toISOString().split('T')[0] ?? '';

const DEFAULT_STATE: WizardState = {
  step: 1,
  dateDebut: today,
  dureeMois: 12,
  customDuration: false,
  loyerMensuel: 0,
  chargesMensuelles: 0,
  depotGarantie: 0,
  currency: 'CDF',
  paymentDay: 5,
  paymentFrequency: 'mensuel',
  conditionsParticulieres: '',
  addendums: [],
  certifie: false,
  newTenantMode: false,
  newTenantPhone: '',
  newTenantName: '',
  newTenantEmail: '',
  newTenantAddress: '',
  tenantVerified: false,
};

function ContractStepper({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Progression du contrat" className="mb-8">
      <ol className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          return (
            <li key={step.id} className="relative flex flex-1 flex-col items-center">
              {index > 0 && (
                <div
                  className={`absolute left-0 right-1/2 top-4 h-0.5 -translate-y-1/2 ${
                    isCompleted ? 'bg-[var(--color-kinshasa-gold)]' : 'bg-[var(--color-border)]'
                  }`}
                  style={{ width: '100%', marginLeft: '-50%' }}
                />
              )}
              <div
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium ${
                  isCompleted
                    ? 'border-[var(--color-kinshasa-gold)] bg-[var(--color-kinshasa-gold)] text-white'
                    : isCurrent
                      ? 'border-[var(--color-kinshasa-blue)] bg-[var(--color-kinshasa-blue)] text-white'
                      : 'border-[var(--color-border)] bg-white text-[var(--color-muted-foreground)]'
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step.id}
              </div>
              <span
                className={`mt-2 hidden text-xs sm:block ${
                  isCurrent ? 'font-medium text-[var(--color-kinshasa-blue)]' : 'text-[var(--color-muted-foreground)]'
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function CreateContractPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const bailleurId = useBailleurId();

  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [dirty, setDirty] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantResults, setTenantResults] = useState<
    Array<Pick<User, 'id' | 'full_name' | 'phone' | 'email' | 'avatar_url'>>
  >([]);
  const [propertyCommune, setPropertyCommune] = useState('');
  const [propertySearch, setPropertySearch] = useState('');
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sent, setSent] = useState(false);

  const { contract: existingContract } = useContract(isEdit ? id : undefined);
  const createMutation = useCreateContract();
  const updateMutation = useUpdateContract(id);
  const sendMutation = useSendContractInvitation();
  const signMutation = useSignContract();
  const pdfMutation = useGenerateContractPdf();

  const { data: propertiesData } = useProperties(
    { pageSize: 50 },
    {
      status: 'disponible',
      commune: propertyCommune ? (propertyCommune as import('@/types').KinshasaCommune) : undefined,
      search: propertySearch || undefined,
    },
  );

  const availableProperties = propertiesData?.data ?? [];

  const blocker = useBlocker(dirty && state.step < 5);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!isEdit) {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        try {
          setState(JSON.parse(saved));
        } catch {
          /* ignore */
        }
      }
      const logementId = searchParams.get('logementId');
      if (logementId) {
        setState((s) => ({ ...s, logementId }));
      }
    }
  }, [isEdit, searchParams]);

  useEffect(() => {
    if (!isEdit && dirty) {
      const timer = setInterval(() => {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state));
      }, 30000);
      return () => clearInterval(timer);
    }
  }, [state, dirty, isEdit]);

  useEffect(() => {
    if (existingContract && isEdit) {
      setState((s) => ({
        ...s,
        logementId: existingContract.logement_id,
        locataireId: existingContract.locataire_id,
        locataire: existingContract.locataire,
        dateDebut: existingContract.date_debut,
        dateFin: existingContract.date_fin ?? undefined,
        loyerMensuel: Number(existingContract.loyer_mensuel),
        depotGarantie: Number(existingContract.depot_garantie ?? 0),
        currency: existingContract.currency as 'CDF' | 'USD',
        paymentDay: existingContract.payment_day,
      }));
    }
  }, [existingContract, isEdit]);

  const updateState = useCallback((patch: Partial<WizardState>) => {
    setState((s) => ({ ...s, ...patch }));
    setDirty(true);
  }, []);

  const selectProperty = (property: Logement) => {
    updateState({
      logementId: property.id,
      loyerMensuel: Number(property.loyer_mensuel),
      depotGarantie: Number(property.loyer_mensuel),
      currency: property.currency as 'CDF' | 'USD',
    });
  };

  const searchTenants = async (term: string) => {
    if (!bailleurId || term.length < 2) {
      setTenantResults([]);
      return;
    }
    const results = await searchTenantsForBailleur(bailleurId, term);
    setTenantResults(results);
  };

  useEffect(() => {
    const timer = setTimeout(() => void searchTenants(tenantSearch), 300);
    return () => clearTimeout(timer);
  }, [tenantSearch, bailleurId]);

  const createNewTenant = async () => {
    const tenant = await createTenantUser({
      phone: state.newTenantPhone,
      fullName: state.newTenantName,
      email: state.newTenantEmail || undefined,
      address: state.newTenantAddress || undefined,
    });
    await sendOTP(state.newTenantPhone);
    updateState({
      locataireId: tenant.id,
      locataire: tenant,
      tenantVerified: true,
      newTenantMode: false,
    });
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!state.logementId;
      case 2:
        return !!state.locataireId;
      case 3:
        return state.loyerMensuel > 0 && !!state.dateDebut;
      case 4:
        return state.certifie;
      default:
        return true;
    }
  };

  const computedEndDate = state.customDuration
    ? state.dateFin
    : calculateEndDate(state.dateDebut, state.dureeMois);

  const buildPayload = (): Omit<CreateContractFormData, 'certifie'> & { certifie?: boolean } => ({
    logementId: state.logementId!,
    locataireId: state.locataireId!,
    dateDebut: state.dateDebut,
    dateFin: computedEndDate,
    dureeMois: state.dureeMois,
    loyerMensuel: state.loyerMensuel,
    chargesMensuelles: state.chargesMensuelles,
    depotGarantie: state.depotGarantie,
    currency: state.currency,
    paymentDay: state.paymentDay,
    paymentFrequency: state.paymentFrequency,
    conditionsParticulieres: state.conditionsParticulieres,
    addendums: state.addendums,
    certifie: state.certifie,
  });

  const handleCreateAndGenerate = async () => {
    setGenerating(true);
    try {
      let contractId = createdContractId;
      if (!contractId) {
        const payload = buildPayload();
        if (isEdit && id) {
          await updateMutation.mutateAsync({
            dateDebut: payload.dateDebut,
            dateFin: payload.dateFin,
            loyerMensuel: payload.loyerMensuel,
            depotGarantie: payload.depotGarantie,
            paymentDay: payload.paymentDay,
            terms: {
              chargesMensuelles: payload.chargesMensuelles,
              paymentFrequency: payload.paymentFrequency,
              conditionsParticulieres: payload.conditionsParticulieres,
              addendums: payload.addendums,
            },
          });
          contractId = id;
        } else {
          const contract = await createMutation.mutateAsync(payload);
          contractId = contract.id;
        }
        setCreatedContractId(contractId);
      }
      await pdfMutation.mutateAsync(contractId);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setDirty(false);
      updateState({ step: 5 });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendToTenant = async () => {
    if (!createdContractId) return;
    await sendMutation.mutateAsync(createdContractId);
    setSent(true);
    navigate(ROUTES.BAILLEUR.CONTRACT_DETAIL.replace(':id', createdContractId));
  };

  const handleSignSelf = async () => {
    if (!createdContractId) return;
    await signMutation.mutateAsync({ contractId: createdContractId, party: 'bailleur' });
    await sendMutation.mutateAsync(createdContractId);
    navigate(ROUTES.BAILLEUR.CONTRACT_DETAIL.replace(':id', createdContractId));
  };

  const selectedProperty = availableProperties.find((p) => p.id === state.logementId);

  const previewData = {
    logement: selectedProperty ?? existingContract?.logement,
    locataire: state.locataire ?? existingContract?.locataire,
    bailleur: {
      full_name: user?.full_name,
      phone: user?.phone,
      email: user?.email,
    },
    dateDebut: state.dateDebut,
    dateFin: computedEndDate,
    loyerMensuel: state.loyerMensuel,
    chargesMensuelles: state.chargesMensuelles,
    depotGarantie: state.depotGarantie,
    currency: state.currency,
    paymentDay: state.paymentDay,
    paymentFrequency: state.paymentFrequency,
    conditionsParticulieres: state.conditionsParticulieres,
  };

  if (blocker.state === 'blocked') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Card className="max-w-md p-6">
          <h2 className="font-heading text-lg font-semibold">Quitter sans enregistrer ?</h2>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Vos modifications seront perdues.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => blocker.reset?.()}>
              Rester
            </Button>
            <Button variant="danger" onClick={() => blocker.proceed?.()}>
              Quitter
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? 'Modifier le contrat' : 'Nouveau contrat'}
        subtitle="Créez un contrat de bail en 5 étapes"
        showBack
        onBack={() => navigate(ROUTES.BAILLEUR.CONTRACTS)}
      />

      <ContractStepper currentStep={state.step} />

      {state.step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Rechercher un logement..."
              value={propertySearch}
              onChange={(e) => setPropertySearch(e.target.value)}
            />
            <CommuneSelect value={propertyCommune} onValueChange={setPropertyCommune} placeholder="Filtrer par commune" />
          </div>

          {availableProperties.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Home className="mx-auto h-12 w-12 text-[var(--color-muted-foreground)]" />
                <p className="mt-4 font-medium">Aucun logement disponible</p>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                  Ajoutez un logement avec le statut « disponible » pour créer un contrat.
                </p>
                <Button className="mt-4" onClick={() => navigate(ROUTES.BAILLEUR.PROPERTY_NEW)}>
                  Ajouter un logement
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availableProperties.map((property) => (
                <Card
                  key={property.id}
                  className={`cursor-pointer transition-all ${
                    state.logementId === property.id
                      ? 'ring-2 ring-[var(--color-kinshasa-blue)]'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => selectProperty(property)}
                >
                  <CardContent className="p-4">
                    {property.photos?.[0] && (
                      <img
                        src={property.photos[0]}
                        alt=""
                        className="mb-3 h-32 w-full rounded-lg object-cover"
                      />
                    )}
                    <p className="font-mono text-sm">{property.code}</p>
                    <p className="text-sm text-[var(--color-muted-foreground)]">{property.address}</p>
                    <p className="mt-2 font-bold">
                      {formatCurrency(Number(property.loyer_mensuel), property.currency as 'CDF' | 'USD')}
                    </p>
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      variant={state.logementId === property.id ? 'primary' : 'outline'}
                    >
                      {state.logementId === property.id ? 'Sélectionné' : 'Sélectionner'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {state.step === 2 && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={!state.newTenantMode ? 'primary' : 'outline'}
              onClick={() => updateState({ newTenantMode: false })}
            >
              <Search className="mr-2 h-4 w-4" />
              Rechercher
            </Button>
            <Button
              variant={state.newTenantMode ? 'primary' : 'outline'}
              onClick={() => updateState({ newTenantMode: true })}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Nouveau locataire
            </Button>
          </div>

          {!state.newTenantMode ? (
            <>
              <Input
                placeholder="Rechercher par numéro de téléphone ou nom"
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
              />
              <div className="space-y-2">
                {tenantResults.map((tenant) => (
                  <Card
                    key={tenant.id}
                    className={`cursor-pointer ${
                      state.locataireId === tenant.id ? 'ring-2 ring-[var(--color-kinshasa-blue)]' : ''
                    }`}
                    onClick={() =>
                      updateState({ locataireId: tenant.id, locataire: tenant })
                    }
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-kinshasa-blue)] text-white">
                        {getInitials(tenant.full_name)}
                      </div>
                      <div>
                        <p className="font-medium">{tenant.full_name}</p>
                        <p className="text-sm text-[var(--color-muted-foreground)]">{tenant.phone}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="space-y-4 p-6">
                <PhoneInput
                  value={state.newTenantPhone}
                  onChange={(v) => updateState({ newTenantPhone: v })}
                  required
                />
                <Input
                  label="Nom complet"
                  value={state.newTenantName}
                  onChange={(e) => updateState({ newTenantName: e.target.value })}
                  required
                />
                <Input
                  label="Email (optionnel)"
                  type="email"
                  value={state.newTenantEmail}
                  onChange={(e) => updateState({ newTenantEmail: e.target.value })}
                />
                <Input
                  label="Adresse actuelle (optionnel)"
                  value={state.newTenantAddress}
                  onChange={(e) => updateState({ newTenantAddress: e.target.value })}
                />
                <FileUpload
                  label="Pièce d'identité (optionnel)"
                  accept="all"
                  folder="kyc"
                  onUpload={() => updateState({})}
                />
                <Button
                  onClick={() => void createNewTenant()}
                  disabled={!state.newTenantPhone || !state.newTenantName}
                >
                  Créer et envoyer OTP
                </Button>
              </CardContent>
            </Card>
          )}

          {state.locataire && (
            <Card className="border-[var(--color-kinshasa-gold)]">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-kinshasa-blue)] text-white">
                  {getInitials(state.locataire.full_name)}
                </div>
                <div>
                  <p className="font-medium">{state.locataire.full_name}</p>
                  <p className="text-sm">{state.locataire.phone}</p>
                  {state.tenantVerified && (
                    <span className="text-xs text-green-600">OTP envoyé pour vérification</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {state.step === 3 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <DatePicker
              label="Date de début"
              value={state.dateDebut}
              onChange={(v) => {
                updateState({ dateDebut: v });
                if (!state.customDuration) {
                  updateState({ dateFin: calculateEndDate(v, state.dureeMois) });
                }
              }}
            />

            <Select
              label="Durée"
              options={[
                { value: '6', label: '6 mois' },
                { value: '12', label: '12 mois' },
                { value: '24', label: '24 mois' },
                { value: '36', label: '36 mois' },
                { value: 'custom', label: 'Personnalisé' },
              ]}
              value={state.customDuration ? 'custom' : String(state.dureeMois)}
              onValueChange={(v) => {
                if (v === 'custom') {
                  updateState({ customDuration: true });
                } else {
                  const months = Number(v);
                  updateState({
                    customDuration: false,
                    dureeMois: months,
                    dateFin: calculateEndDate(state.dateDebut, months),
                  });
                }
              }}
            />

            <DatePicker
              label="Date de fin"
              value={computedEndDate ?? ''}
              onChange={(v) => updateState({ dateFin: v, customDuration: true })}
              disabled={!state.customDuration}
            />

            <CurrencyInput
              label="Loyer mensuel"
              value={state.loyerMensuel}
              currency={state.currency}
              onChange={(v, c) => updateState({ loyerMensuel: v, currency: c })}
            />

            <CurrencyInput
              label="Charges mensuelles"
              value={state.chargesMensuelles}
              currency={state.currency}
              onChange={(v) => updateState({ chargesMensuelles: v })}
              showCurrencySelector={false}
            />

            <CurrencyInput
              label="Dépôt de garantie"
              value={state.depotGarantie}
              currency={state.currency}
              onChange={(v) => updateState({ depotGarantie: v })}
              showCurrencySelector={false}
            />

            <Select
              label="Jour d'échéance"
              options={Array.from({ length: 28 }, (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              }))}
              value={String(state.paymentDay)}
              onValueChange={(v) => updateState({ paymentDay: Number(v) })}
            />

            <div>
              <p className="mb-2 text-sm font-medium">Fréquence de paiement</p>
              <div className="flex flex-wrap gap-3">
                {(['mensuel', 'trimestriel', 'semestriel', 'annuel'] as const).map((freq) => (
                  <label key={freq} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="frequency"
                      checked={state.paymentFrequency === freq}
                      onChange={() => updateState({ paymentFrequency: freq })}
                    />
                    <span className="text-sm capitalize">{freq}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Conditions particulières</label>
              <textarea
                className="min-h-[100px] w-full rounded-lg border border-[var(--color-input)] p-3 text-sm"
                maxLength={2000}
                value={state.conditionsParticulieres}
                onChange={(e) => updateState({ conditionsParticulieres: e.target.value })}
                placeholder="Conditions spéciales du contrat..."
              />
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {state.conditionsParticulieres.length}/2000 caractères
              </p>
            </div>

            <FileUpload
              label="Addendums (max 5 fichiers)"
              accept="pdf"
              multiple
              folder="contracts/addendums"
              onUpload={(files) =>
                updateState({
                  addendums: files.slice(0, 5).map((f) => ({
                    name: f.name,
                    url: f.url,
                    path: f.path,
                  })),
                })
              }
            />
          </CardContent>
        </Card>
      )}

      {state.step === 4 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((s) => (
              <button
                key={s}
                type="button"
                className="text-sm text-[var(--color-kinshasa-blue)] underline"
                onClick={() => updateState({ step: s })}
              >
                Modifier étape {s}
              </button>
            ))}
          </div>

          <ContractPreview data={previewData} />

          <Card>
            <CardContent className="p-4">
              <Checkbox
                checked={state.certifie}
                onCheckedChange={(v) => updateState({ certifie: !!v })}
                label="Je certifie que les informations sont exactes et j'accepte les conditions générales"
              />
              <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
                En créant ce contrat, vous acceptez les conditions générales d&apos;utilisation
                d&apos;eLoyer Kinshasa et confirmez que les informations fournies sont exactes.
                Ce document a une valeur légale en République Démocratique du Congo.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {state.step === 5 && (
        <Card>
          <CardContent className="py-12 text-center">
            {generating ? (
              <>
                <LoadingSpinner size="lg" className="mx-auto" />
                <p className="mt-4 font-medium">Génération du contrat PDF...</p>
              </>
            ) : sent ? (
              <p className="font-medium text-[var(--color-kinshasa-blue)]">
                En attente de signature du locataire
              </p>
            ) : (
              <>
                <Check className="mx-auto h-16 w-16 text-green-600" />
                <p className="mt-4 text-xl font-bold">Contrat créé avec succès</p>
                {createdContractId && existingContract?.code && (
                  <p className="mt-2 font-mono text-[var(--color-muted-foreground)]">
                    {existingContract.code}
                  </p>
                )}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button onClick={() => void handleSendToTenant()}>
                    Envoyer au locataire pour signature
                  </Button>
                  <Button variant="outline" onClick={() => void handleSignSelf()}>
                    Signer moi-même d&apos;abord
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {state.step < 5 && (
        <div className="flex justify-between border-t border-[var(--color-border)] pt-4">
          <Button
            variant="outline"
            disabled={state.step === 1}
            onClick={() => updateState({ step: state.step - 1 })}
          >
            Retour
          </Button>
          {state.step < 4 ? (
            <Button
              disabled={!isStepValid(state.step)}
              onClick={() => updateState({ step: state.step + 1 })}
            >
              Suivant
            </Button>
          ) : (
            <Button
              disabled={!isStepValid(4)}
              onClick={() => void handleCreateAndGenerate()}
            >
              Générer le contrat
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
