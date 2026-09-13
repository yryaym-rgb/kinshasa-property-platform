import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { ROUTES } from '@/config/routes';
import { toastError } from '@/components/ui/Toast';

const loginSchema = z.object({
  phone: z.string().min(9, 'Numéro de téléphone requis'),
  password: z.string().optional(),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login, loading } = useAuth();
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  });

  const phone = watch('phone');

  const onSubmit = async (data: LoginForm) => {
    try {
      await login({ phone: data.phone, password: data.password, rememberMe: data.rememberMe });
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Erreur de connexion');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8 text-center lg:text-left">
        <h1 className="font-heading text-2xl font-bold">Connexion</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Accédez à votre espace eLoyer Kinshasa
        </p>
      </div>

      <div className="mb-6 flex rounded-lg border border-[var(--color-border)] p-1">
        {(['phone', 'email'] as const).map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => setAuthMethod(method)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              authMethod === method
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            }`}
          >
            {method === 'phone' ? 'Téléphone' : 'Email'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {authMethod === 'phone' ? (
          <PhoneInput
            value={phone}
            onChange={(val) => setValue('phone', val)}
            error={errors.phone?.message}
            required
          />
        ) : (
          <Input
            type="email"
            label="Adresse email"
            placeholder="email@exemple.com"
            {...register('phone')}
            error={errors.phone?.message}
          />
        )}

        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            label="Mot de passe / PIN"
            placeholder="••••••••"
            {...register('password')}
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Masquer' : 'Afficher'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('rememberMe')} className="rounded" />
            Se souvenir de moi
          </label>
          <Link
            to={ROUTES.FORGOT_PASSWORD}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Se connecter
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-muted-foreground)]">
        Vous n&apos;avez pas de compte ?{' '}
        <Link to={ROUTES.REGISTER} className="font-medium text-[var(--color-primary)] hover:underline">
          S&apos;inscrire
        </Link>
      </p>
    </div>
  );
}
