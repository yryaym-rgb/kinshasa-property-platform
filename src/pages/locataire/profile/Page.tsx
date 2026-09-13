import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogOut, KeyRound } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseMutation } from '@/hooks/useSupabaseMutation';
import { TenantProfileSchema, type TenantProfileForm } from '@/validations/paymentSchemas';
import { formatPhone, getInitials } from '@/lib/utils';
import { ROUTES } from '@/config/routes';
import toast from 'react-hot-toast';

export function ProfilePage() {
  const { user, logout, updateProfile } = useAuth();

  const { register, handleSubmit, formState: { errors } } = useForm<TenantProfileForm>({
    resolver: zodResolver(TenantProfileSchema) as never,
    defaultValues: {
      fullName: user?.full_name ?? '',
      email: user?.email ?? '',
      address: user?.address ?? '',
      notifyEmail: true,
      notifySms: true,
      preferredLanguage: 'fr',
    },
  });

  const saveMutation = useSupabaseMutation({
    mutationFn: async (data: TenantProfileForm) => {
      await updateProfile({
        fullName: data.fullName,
        email: data.email,
        address: data.address,
      });
      if (user?.id) {
        localStorage.setItem(`eloyer_prefs_${user.id}`, JSON.stringify({
          notifyEmail: data.notifyEmail,
          notifySms: data.notifySms,
          preferredLanguage: data.preferredLanguage,
        }));
      }
    },
    successMessage: 'Profil mis à jour',
  });

  const handleLogout = async () => {
    await logout();
    window.location.href = ROUTES.LOGIN;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Mon profil" subtitle="Gérez vos informations personnelles" />

      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-6 sm:flex-row sm:items-start">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-kinshasa-blue)] text-2xl font-bold text-white">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                getInitials(user?.full_name ?? 'L')
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-[var(--color-kinshasa-gold)] p-1.5 text-xs text-white hover:opacity-90">
              <input type="file" accept="image/*" className="hidden" onChange={() => toast('Upload photo — Module 8')} />
              📷
            </label>
          </div>
          <div className="text-center sm:text-left">
            <p className="font-medium">{user?.full_name}</p>
            <p className="text-sm text-[var(--color-muted-foreground)]">{formatPhone(user?.phone ?? '')}</p>
            <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Vérifié</span>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Informations personnelles</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nom complet</label>
              <input {...register('fullName')} className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm" />
              {errors.fullName && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.fullName.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Téléphone</label>
              <input value={formatPhone(user?.phone ?? '')} disabled className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2.5 text-sm opacity-70" />
            </div>
            <div>
              <label className="text-sm font-medium">E-mail</label>
              <input {...register('email')} type="email" className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm" />
              {errors.email && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Adresse actuelle</label>
              <input {...register('address')} className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Pièce d&apos;identité</label>
              <div className="mt-1 flex items-center gap-3 rounded-lg border border-dashed border-[var(--color-border)] p-4">
                <span className="text-sm text-[var(--color-muted-foreground)]">Aucun document —</span>
                <Button type="button" variant="outline" size="sm" onClick={() => toast('Upload ID — Module 8')}>
                  Téléverser
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Préférences</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm">Notifications par e-mail</span>
              <input type="checkbox" {...register('notifyEmail')} className="h-5 w-5 rounded" />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Notifications par SMS</span>
              <input type="checkbox" {...register('notifySms')} className="h-5 w-5 rounded" />
            </label>
            <div>
              <label className="text-sm font-medium">Langue préférée</label>
              <select {...register('preferredLanguage')} className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm">
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" loading={saveMutation.isPending} className="w-full">Enregistrer</Button>
      </form>

      <div className="space-y-3">
        <Button variant="outline" className="w-full" leftIcon={<KeyRound className="h-4 w-4" />} onClick={() => toast('Changement PIN — Module 8')}>
          Changer mon code PIN
        </Button>
        <Button variant="danger" className="w-full" leftIcon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
