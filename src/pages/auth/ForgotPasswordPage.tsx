import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { sendPasswordResetOTP, resetPassword } from '@/services/auth.service';
import { ROUTES } from '@/config/routes';
import { toastError, toastSuccess } from '@/components/ui/Toast';

const schema = z.object({
  contact: z.string().min(1, 'Champ requis'),
  method: z.enum(['phone', 'email']),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { method: 'phone' },
  });

  const contact = watch('contact');

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      if (data.method === 'phone') {
        await sendPasswordResetOTP(data.contact);
      } else {
        await resetPassword(data.contact);
      }
      setSent(true);
      toastSuccess('Instructions de réinitialisation envoyées');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Erreur d\'envoi');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="animate-fade-in text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="font-heading text-2xl font-bold">Vérifiez vos messages</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Nous avons envoyé les instructions de réinitialisation. Suivez le lien ou entrez le code OTP reçu.
        </p>
        <Link to={ROUTES.LOGIN} className="mt-6 inline-block">
          <Button variant="outline">Retour à la connexion</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="font-heading text-2xl font-bold">Mot de passe oublié</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        Entrez votre numéro de téléphone ou email pour recevoir un code de réinitialisation.
      </p>

      <div className="my-6 flex rounded-lg border border-[var(--color-border)] p-1">
        {(['phone', 'email'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMethod(m); setValue('method', m); }}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${
              method === m ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-muted-foreground)]'
            }`}
          >
            {m === 'phone' ? 'Téléphone' : 'Email'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...register('method')} />
        {method === 'phone' ? (
          <PhoneInput
            value={contact}
            onChange={(val) => setValue('contact', val)}
            error={errors.contact?.message}
          />
        ) : (
          <Input
            type="email"
            label="Adresse email"
            {...register('contact')}
            error={errors.contact?.message}
          />
        )}
        <Button type="submit" className="w-full" loading={loading}>
          Envoyer le code
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link to={ROUTES.LOGIN} className="text-[var(--color-primary)] hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
