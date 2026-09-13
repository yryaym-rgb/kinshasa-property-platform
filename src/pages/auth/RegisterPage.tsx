import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Home, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { CommuneSelect } from '@/components/ui/Select';
import { FileUpload } from '@/components/ui/FileUpload';
import { ROUTES } from '@/config/routes';
import { toastError, toastSuccess } from '@/components/ui/Toast';
import type { KinshasaCommune, UserRole } from '@/types';
import { cn } from '@/lib/utils';

const registerSchema = z.object({
  role: z.enum(['bailleur', 'locataire', 'agence']),
  phone: z.string().min(9),
  fullName: z.string().min(2, 'Nom complet requis'),
  email: z.string().email().optional().or(z.literal('')),
  commune: z.string().optional(),
  address: z.string().optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

const STEPS = ['Type de compte', 'Téléphone', 'Informations', 'Documents KYC'];

const ROLE_OPTIONS: { role: UserRole; label: string; description: string; icon: typeof Home }[] = [
  { role: 'bailleur', label: 'Bailleur', description: 'Propriétaire de biens immobiliers', icon: Building2 },
  { role: 'locataire', label: 'Locataire', description: 'Occupant d\'un logement loué', icon: Home },
  { role: 'agence', label: 'Agence', description: 'Agence immobilière ou gestionnaire', icon: Briefcase },
];

export function RegisterPage() {
  const { register: registerUser, loginWithOTP, loading } = useAuth();
  const [step, setStep] = useState(0);
  const [otpSent, setOtpSent] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'locataire' },
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = form;
  const selectedRole = watch('role');
  const phone = watch('phone');

  const handleSendOTP = async () => {
    if (!phone) {
      toastError('Veuillez entrer votre numéro de téléphone');
      return;
    }
    try {
      await loginWithOTP(phone);
      setOtpSent(true);
      toastSuccess('Code OTP envoyé par SMS');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Erreur d\'envoi OTP');
    }
  };

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser({
        role: data.role,
        phone: data.phone,
        fullName: data.fullName,
        email: data.email || undefined,
        commune: data.commune as KinshasaCommune | undefined,
        address: data.address,
      });
      toastSuccess('Inscription réussie !');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Erreur d\'inscription');
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">Créer un compte</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Étape {step + 1} sur {STEPS.length} — {STEPS[step]}
        </p>
        <div className="mt-4 flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-muted)]')}
            />
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {step === 0 && (
          <div className="space-y-3">
            {ROLE_OPTIONS.map(({ role, label, description, icon: Icon }) => (
              <button
                key={role}
                type="button"
                onClick={() => setValue('role', role as RegisterForm['role'])}
                className={cn(
                  'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors',
                  selectedRole === role
                    ? 'border-[var(--color-primary)] bg-[var(--color-accent)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]',
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-muted)]">
                  <Icon className="h-6 w-6 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-[var(--color-muted-foreground)]">{description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <PhoneInput
              value={phone}
              onChange={(val) => setValue('phone', val)}
              error={errors.phone?.message}
              required
            />
            {!otpSent ? (
              <Button type="button" className="w-full" onClick={() => void handleSendOTP()} loading={loading}>
                Envoyer le code OTP
              </Button>
            ) : (
              <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                Code envoyé ! Vérifiez votre téléphone et continuez.
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Input label="Nom complet" required {...register('fullName')} error={errors.fullName?.message} />
            <Input label="Email (optionnel)" type="email" {...register('email')} error={errors.email?.message} />
            <CommuneSelect
              value={watch('commune')}
              onValueChange={(v) => setValue('commune', v)}
              label="Commune"
            />
            <Input label="Adresse" {...register('address')} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {selectedRole === 'bailleur'
                ? 'Documents KYC requis pour les bailleurs (pièce d\'identité, titre de propriété).'
                : 'Documents KYC optionnels pour les locataires.'}
            </p>
            <FileUpload
              label="Pièce d'identité"
              accept="all"
              onError={(msg) => toastError(msg)}
            />
            {selectedRole === 'bailleur' && (
              <FileUpload
                label="Titre de propriété ou contrat"
                accept="pdf"
                onError={(msg) => toastError(msg)}
              />
            )}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={prevStep} leftIcon={<ChevronLeft className="h-4 w-4" />}>
              Retour
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" className="ml-auto" onClick={nextStep} rightIcon={<ChevronRight className="h-4 w-4" />}>
              Suivant
            </Button>
          ) : (
            <Button type="submit" className="ml-auto" loading={loading}>
              Terminer l&apos;inscription
            </Button>
          )}
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-muted-foreground)]">
        Déjà un compte ?{' '}
        <Link to={ROUTES.LOGIN} className="font-medium text-[var(--color-primary)] hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
