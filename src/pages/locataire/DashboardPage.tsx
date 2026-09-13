import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  CreditCard,
  Receipt,
  Bell,
  User,
  Headphones,
  Phone,
  Building2,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { DashboardSkeleton } from '@/components/common/SkeletonLoaders';
import { ContactSheet } from '@/components/common/ContactSheet';
import { SupportModal, useSupportModal } from '@/components/common/SupportModal';
import { Timeline } from '@/components/common/Timeline';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ContractStatusBadge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { useTenantDashboard } from '@/hooks/useTenantDashboard';
import { useMarkNotificationRead } from '@/hooks/useNotifications';
import { formatCDF, getInitials, formatDate } from '@/lib/utils';
import {
  formatLongFrenchDate,
  formatRelativeTime,
  getTimeBasedGreeting,
  getDueDateBadge,
} from '@/utils/dateUtils';
import { ROUTES } from '@/config/routes';

const QUICK_TILES = [
  { label: 'Mes contrats', icon: FileText, href: ROUTES.LOCATAIRE.CONTRACTS },
  { label: 'Mes paiements', icon: CreditCard, href: ROUTES.LOCATAIRE.PAYMENTS },
  { label: 'Mes reçus', icon: Receipt, href: ROUTES.LOCATAIRE.RECEIPTS },
  { label: 'Notifications', icon: Bell, href: ROUTES.LOCATAIRE.NOTIFICATIONS, badge: true },
  { label: 'Profil', icon: User, href: ROUTES.LOCATAIRE.PROFILE },
  { label: 'Support', icon: Headphones, action: 'support' as const },
];

const NOTIF_ICONS: Record<string, typeof Bell> = {
  payment: CreditCard,
  contract: FileText,
  tax: Receipt,
  info: Bell,
};

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useTenantDashboard();
  const markRead = useMarkNotificationRead();
  const { open, openSupport, closeSupport } = useSupportModal();
  const [contactOpen, setContactOpen] = useState(false);

  const firstName = user?.full_name?.split(' ')[0] ?? 'Locataire';

  if (isLoading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-destructive)]">{error.message}</p>
        <Button className="mt-4" onClick={() => refetch()}>Réessayer</Button>
      </div>
    );
  }

  const contract = data?.activeContract;
  const logement = contract?.logement;
  const bailleur = contract?.bailleur;
  const bailleurName = bailleur?.user?.full_name ?? bailleur?.business_name ?? 'Bailleur';
  const unreadCount = data?.recentNotifications.filter((n) => !n.read).length ?? 0;

  if (!contract) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`${getTimeBasedGreeting()}, ${firstName}`}
          subtitle={formatLongFrenchDate()}
        />
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Building2 className="mb-4 h-12 w-12 text-[var(--color-muted-foreground)]" />
            <h2 className="font-heading text-xl font-semibold">Aucun contrat actif</h2>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Vous n&apos;avez pas encore de contrat de location actif.
            </p>
            <Button className="mt-6" onClick={openSupport}>Contacter le support</Button>
          </CardContent>
        </Card>
        <SupportModal open={open} onClose={closeSupport} />
      </div>
    );
  }

  const propertyLabel = logement
    ? `${logement.type}${logement.rooms ? ` ${logement.rooms} pièces` : ''} - ${logement.address}, ${logement.commune}`
    : 'Logement';

  const dueBadge = data?.nextPayment
    ? getDueDateBadge(data.nextPayment.daysRemaining, data.nextPayment.isOverdue)
    : null;

  const activityItems = (data?.recentActivity ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    timestamp: formatRelativeTime(a.timestamp),
    status: 'completed' as const,
    icon: a.type === 'payment' ? <CreditCard className="h-4 w-4" /> : a.type === 'contract' ? <FileText className="h-4 w-4" /> : <Receipt className="h-4 w-4" />,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">{getTimeBasedGreeting()}, {firstName}</h1>
          <p className="mt-0.5 capitalize text-sm text-[var(--color-muted-foreground)]">
            {formatLongFrenchDate()}
          </p>
        </div>
        <Link
          to={ROUTES.LOCATAIRE.PROFILE}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-kinshasa-blue)] text-sm font-medium text-white"
          aria-label="Mon profil"
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            getInitials(user?.full_name ?? 'L')
          )}
        </Link>
      </div>

      {/* Current housing card */}
      <Card>
        <CardHeader>
          <CardTitle>Logement actuel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-40 overflow-hidden rounded-xl bg-gradient-to-br from-[var(--color-kinshasa-blue)] to-[var(--color-kinshasa-blue-dark)]">
            <div className="flex h-full items-center justify-center">
              <Building2 className="h-16 w-16 text-white/40" />
            </div>
          </div>
          <div>
            <p className="font-medium">{propertyLabel}</p>
            <p className="mt-1 font-mono text-xs text-[var(--color-muted-foreground)]">{logement?.code}</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">{bailleurName}</span>
              {bailleur?.user?.phone && (
                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-muted)] hover:bg-[var(--color-accent)]"
                  aria-label="Contacter le bailleur"
                >
                  <Phone className="h-4 w-4 text-[var(--color-kinshasa-blue)]" />
                </button>
              )}
            </div>
            <ContractStatusBadge status={contract.status} />
          </div>
        </CardContent>
      </Card>

      {/* Next rent card */}
      {data?.nextPayment && (
        <Card className="border-2 border-[var(--color-kinshasa-gold)]/30 bg-amber-50/30 dark:bg-amber-900/10">
          <CardHeader>
            <CardTitle className="text-[var(--color-kinshasa-gold-dark)]">Prochain loyer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-3xl font-bold text-[var(--color-kinshasa-gold)]">
              {formatCDF(data.nextPayment.amount)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--color-muted-foreground)]">
                Échéance : {formatDate(data.nextPayment.dueDate)}
              </span>
              {dueBadge && (
                <Badge
                  variant={dueBadge.variant === 'info' ? 'info' : dueBadge.variant === 'warning' ? 'warning' : 'danger'}
                >
                  {dueBadge.label}
                </Badge>
              )}
            </div>
            <Link to={ROUTES.LOCATAIRE.PAYMENT_NEW}>
              <Button size="xl" className="w-full">Payer maintenant</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick access tiles */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {QUICK_TILES.map((tile) => {
          const Icon = tile.icon;
          if (tile.action === 'support') {
            return (
              <button
                key={tile.label}
                type="button"
                onClick={openSupport}
                className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-center transition-colors hover:bg-[var(--color-muted)]"
              >
                <Icon className="h-5 w-5 text-[var(--color-kinshasa-blue)]" />
                <span className="text-[10px] font-medium leading-tight sm:text-xs">{tile.label}</span>
              </button>
            );
          }
          return (
            <Link
              key={tile.label}
              to={tile.href!}
              className="relative flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-center transition-colors hover:bg-[var(--color-muted)]"
            >
              <Icon className="h-5 w-5 text-[var(--color-kinshasa-blue)]" />
              <span className="text-[10px] font-medium leading-tight sm:text-xs">{tile.label}</span>
              {tile.badge && unreadCount > 0 && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-destructive)] text-[8px] text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Activité récente</CardTitle>
            <Link to={ROUTES.LOCATAIRE.PAYMENTS} className="text-sm text-[var(--color-kinshasa-blue)] hover:underline">
              Voir tout →
            </Link>
          </CardHeader>
          <CardContent>
            {activityItems.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">Aucune activité récente</p>
            ) : (
              <Timeline items={activityItems} />
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Notifications</CardTitle>
            <Link to={ROUTES.LOCATAIRE.NOTIFICATIONS} className="text-sm text-[var(--color-kinshasa-blue)] hover:underline">
              Voir tout
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.recentNotifications ?? []).length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">Aucune notification</p>
            ) : (
              data!.recentNotifications.map((notif) => {
                const Icon = NOTIF_ICONS[notif.type] ?? Bell;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => {
                      if (!notif.read) markRead.mutate(notif.id);
                    }}
                    className={`flex w-full gap-3 rounded-lg p-2 text-left transition-colors hover:bg-[var(--color-muted)] ${!notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  >
                    <div className="rounded-full bg-[var(--color-muted)] p-2">
                      <Icon className="h-4 w-4 text-[var(--color-kinshasa-blue)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{notif.title}</p>
                      <p className="truncate text-xs text-[var(--color-muted-foreground)]">{notif.message}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">{formatRelativeTime(notif.created_at)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <ContactSheet
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        name={bailleurName}
        phone={bailleur?.user?.phone ?? ''}
      />
      <SupportModal open={open} onClose={closeSupport} />
    </div>
  );
}
