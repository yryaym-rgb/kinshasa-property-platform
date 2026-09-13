import { Link } from 'react-router-dom';
import { Building2, Users, Wallet, CreditCard, Plus, Bell, FileText, Calculator } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { PageHeader } from '@/components/common/PageHeader';
import { KPICard } from '@/components/common/KPICard';
import { DashboardSkeleton } from '@/components/common/SkeletonLoaders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PaymentStatusBadge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { useAuth } from '@/hooks/useAuth';
import { useLandlordDashboard, useNotifications } from '@/hooks/useNotifications';
import { formatCDF } from '@/lib/utils';
import { formatRelativeTime, getTimeBasedGreeting } from '@/utils/dateUtils';
import { ROUTES } from '@/config/routes';
import type { DataTableColumn } from '@/types';

const CHART_COLORS = ['#10b981', '#ef4444'];

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useLandlordDashboard();
  const { data: notifications = [] } = useNotifications(5);

  if (isLoading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-destructive)]">{error.message}</p>
        <Button className="mt-4" onClick={() => refetch()}>Réessayer</Button>
      </div>
    );
  }

  const stats = data?.stats;
  const recentPayments = data?.recentPayments ?? [];
  const taxPaidPercent = stats?.taxPaidPercent ?? 0;
  const taxOutstandingPercent = 100 - taxPaidPercent;

  const chartData = [
    { name: 'Payé', value: taxPaidPercent },
    { name: 'Restant', value: taxOutstandingPercent },
  ];

  const paymentColumns: DataTableColumn<Record<string, unknown>>[] = [
    {
      key: 'locataire',
      header: 'Locataire',
      render: (row) => {
        const contrat = row.contrat as { locataire?: { full_name?: string } };
        return contrat?.locataire?.full_name ?? '—';
      },
    },
    {
      key: 'logement',
      header: 'Logement',
      render: (row) => {
        const contrat = row.contrat as { logement?: { code?: string } };
        return <span className="font-mono text-xs">{contrat?.logement?.code ?? '—'}</span>;
      },
    },
    {
      key: 'montant',
      header: 'Montant',
      render: (row) => formatCDF(Number(row.montant)),
    },
    {
      key: 'paid_at',
      header: 'Date',
      render: (row) => (row.paid_at ? formatRelativeTime(row.paid_at as string) : '—'),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => <PaymentStatusBadge status={row.status as string} />,
    },
    {
      key: 'recu',
      header: 'Reçu',
      render: (row) => {
        const recu = row.recu as { code?: string }[] | { code?: string } | null;
        const code = Array.isArray(recu) ? recu[0]?.code : recu?.code;
        return code ? <span className="font-mono text-xs">{code}</span> : '—';
      },
    },
  ];

  const notificationIcons: Record<string, typeof Bell> = {
    payment: CreditCard,
    contract: FileText,
    tax: Calculator,
    info: Bell,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${getTimeBasedGreeting()}, ${user?.full_name ?? 'Bailleur'}`}
        subtitle="Voici un résumé de votre activité locative"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Mes logements"
          value={stats?.propertyCount ?? 0}
          change={stats?.propertiesThisMonth ? `+${stats.propertiesThisMonth}` : undefined}
          subtitle="ce mois"
          icon={Building2}
        />
        <KPICard
          label="Locataires"
          value={stats?.tenantCount ?? 0}
          subtitle={`${stats?.activeTenants ?? 0} actifs`}
          icon={Users}
        />
        <KPICard
          label="Loyers du mois"
          value={formatCDF(stats?.monthlyRentDue ?? 0)}
          subtitle="à percevoir"
          icon={Wallet}
          valueClassName="text-[var(--color-kinshasa-gold)]"
        />
        <KPICard
          label="Paiements reçus"
          value={formatCDF(stats?.monthlyRentCollected ?? 0)}
          subtitle="ce mois"
          icon={CreditCard}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Derniers paiements</CardTitle>
            <Link
              to={ROUTES.BAILLEUR.PAYMENTS}
              className="text-sm text-[var(--color-kinshasa-blue)] hover:underline"
            >
              Voir tous les paiements →
            </Link>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={paymentColumns}
              data={recentPayments as unknown as Record<string, unknown>[]}
              emptyTitle="Aucun paiement récent"
              pageSize={5}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Situation fiscale</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="h-32 w-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                        {chartData.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCDF(stats?.taxTotal ?? 0)}</p>
                  <p className="text-sm text-[var(--color-muted-foreground)]">obligations totales</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--color-destructive)]">
                    {formatCDF(stats?.taxOutstanding ?? 0)}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">à payer</p>
                  <p className="mt-1 text-sm">{taxPaidPercent}% payé</p>
                </div>
              </div>
              <Link to={ROUTES.BAILLEUR.TAXES}>
                <Button variant="outline" className="mt-4 w-full">
                  Voir le détail
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifications.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">Aucune notification</p>
              ) : (
                notifications.slice(0, 5).map((notif) => {
                  const Icon = notificationIcons[notif.type] ?? Bell;
                  return (
                    <div key={notif.id} className="flex gap-3">
                      <div className="rounded-full bg-[var(--color-muted)] p-2">
                        <Icon className="h-4 w-4 text-[var(--color-kinshasa-blue)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{notif.title}</p>
                        <p className="truncate text-xs text-[var(--color-muted-foreground)]">{notif.message}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          {formatRelativeTime(notif.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Link
        to={ROUTES.BAILLEUR.PROPERTY_NEW}
        className="fixed bottom-20 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-[var(--color-kinshasa-gold)] px-5 text-sm font-medium text-[var(--color-secondary-foreground)] shadow-lg hover:opacity-90 md:bottom-6"
        aria-label="Ajouter un logement"
      >
        <Plus className="h-5 w-5" />
        <span className="hidden sm:inline">Ajouter un logement</span>
      </Link>
    </div>
  );
}
