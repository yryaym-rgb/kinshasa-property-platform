import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, FileText, Landmark, RefreshCw, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/common/PageHeader';
import { KPICard } from '@/components/common/KPICard';
import { DashboardSkeleton } from '@/components/common/SkeletonLoaders';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ComplianceBadge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Select';
import { useFiscalDashboard, useForecast } from '@/hooks/useTaxes';
import { formatCDF } from '@/lib/utils';
import { ROUTES } from '@/config/routes';
import { COMPLIANCE_COLORS, type AggregateRevenue, type ComplianceLevel, type RevenueFilters } from '@/types/tax';
import type { DataTableColumn, SelectOption } from '@/types';

const TYPE_COLORS = ['#0033a0', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#64748b'];
const COMPLIANCE_ORDER: ComplianceLevel[] = ['excellent', 'good', 'warning', 'critical'];

type PeriodKey = 'month' | 'quarter' | 'year' | 'ytd';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function periodRange(key: PeriodKey): RevenueFilters {
  const now = new Date();
  const to = isoDate(now);
  const from = new Date(now);
  switch (key) {
    case 'month':
      from.setDate(1);
      break;
    case 'quarter':
      from.setMonth(now.getMonth() - 2, 1);
      break;
    case 'year':
      from.setFullYear(now.getFullYear() - 1);
      from.setDate(from.getDate() + 1);
      break;
    case 'ytd':
      from.setMonth(0, 1);
      break;
  }
  return { from: isoDate(from), to };
}

const PERIOD_OPTIONS: SelectOption[] = [
  { value: 'month', label: 'Ce mois' },
  { value: 'quarter', label: '3 derniers mois' },
  { value: 'ytd', label: 'Depuis janvier' },
  { value: 'year', label: '12 derniers mois' },
];

function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0) return <span className="text-xs text-[var(--color-muted-foreground)]">pas de période de comparaison</span>;
  const delta = ((current - previous) / previous) * 100;
  const up = delta >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${up ? 'text-emerald-600' : 'text-red-600'}`}>
      <Icon className="h-4 w-4" />
      {up ? '+' : ''}
      {delta.toLocaleString('fr-CD', { maximumFractionDigits: 1 })} % vs période précédente
    </span>
  );
}

export function FiscalDashboardPage() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('month');
  const filters = useMemo(() => periodRange(periodKey), [periodKey]);
  const dashboard = useFiscalDashboard(filters);
  const forecast = useForecast(6);

  if (dashboard.isLoading) return <DashboardSkeleton />;

  if (dashboard.error || !dashboard.data) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-destructive)]">{dashboard.error?.message ?? 'Données indisponibles'}</p>
        <Button className="mt-4" onClick={() => void dashboard.refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  const d = dashboard.data;
  const communeData = d.byCommune.slice(0, 12).map((c) => ({ name: c.commune, montant: c.montant }));
  const typeData = d.byPropertyType.map((t) => ({ name: t.type, value: t.montant }));
  const complianceData = COMPLIANCE_ORDER.map((level) => ({
    level,
    label: COMPLIANCE_COLORS[level].label,
    count: d.complianceDistribution.find((c) => c.level === level)?.count ?? 0,
  }));
  const totalLandlordsScored = complianceData.reduce((a, c) => a + c.count, 0);
  const forecastData = (forecast.data?.projection ?? []).map((p) => ({ month: p.month.slice(2), base: p.base, lower: p.lower, upper: p.upper }));

  const contributorColumns: DataTableColumn<AggregateRevenue['topContributors'][number]>[] = [
    { key: 'nom', header: 'Bailleur', render: (row) => <span className="font-medium">{row.nom}</span> },
    { key: 'commune', header: 'Commune', render: (row) => row.commune ?? '—' },
    { key: 'nbPaiements', header: 'Paiements', sortable: true },
    { key: 'montant', header: 'Impôt collecté', sortable: true, render: (row) => <span className="font-mono font-semibold">{formatCDF(row.montant)}</span> },
    {
      key: 'complianceScore',
      header: 'Conformité',
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono text-xs">{Math.round(row.complianceScore)}</span>
          <ComplianceBadge level={row.complianceLevel} />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6" data-testid="fiscal-dashboard">
      <PageHeader
        title="Tableau de bord fiscal"
        subtitle="Mobilisation des recettes de l’impôt sur les revenus locatifs — Kinshasa"
        actions={
          <div className="flex gap-2">
            <Select options={PERIOD_OPTIONS} value={periodKey} onValueChange={(v) => setPeriodKey(v as PeriodKey)} className="w-44" />
            <Button variant="ghost" onClick={() => void dashboard.refetch()} aria-label="Actualiser">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <Card className="border-[var(--color-kinshasa-blue)]/30 bg-gradient-to-br from-[var(--color-card)] to-[var(--color-accent)]">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Recettes fiscales — {filters.from} → {filters.to}
            </p>
            <p className="mt-1 font-heading text-4xl font-bold text-[var(--color-kinshasa-blue)] sm:text-5xl" data-testid="total-revenue">
              {formatCDF(d.totalRevenue)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Trend current={d.totalRevenue} previous={d.previousRevenue} />
              <span className="text-xs text-[var(--color-muted-foreground)]">
                dont {formatCDF(d.collectedRevenue)} déjà reversés · {d.paymentsCount} paiements · volume locatif {formatCDF(d.rentVolume)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:text-right">
            <div>
              <p className="text-[var(--color-muted-foreground)]">Période précédente</p>
              <p className="font-mono font-semibold">{formatCDF(d.previousRevenue)}</p>
            </div>
            <div>
              <p className="text-[var(--color-muted-foreground)]">Taux de conformité</p>
              <p className="font-mono font-semibold">{d.complianceRate.toLocaleString('fr-CD', { maximumFractionDigits: 1 })} %</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Bailleurs enregistrés" value={d.registeredLandlords} icon={Users} />
        <KPICard label="Logements enregistrés" value={d.registeredProperties} icon={Building2} />
        <KPICard label="Contrats actifs" value={d.activeContracts} subtitle={`loyer moyen ${formatCDF(d.averageRent)}`} icon={FileText} />
        <Link to={ROUTES.FISCAL.ANOMALIES} className="block">
          <KPICard
            label="Anomalies ouvertes"
            value={d.anomaliesOpen}
            subtitle={Object.entries(d.anomaliesBySeverity)
              .map(([k, v]) => `${v} ${k}`)
              .join(' · ') || 'aucune'}
            icon={AlertTriangle}
            valueClassName={d.anomaliesOpen > 0 ? 'text-[var(--color-destructive)]' : undefined}
          />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recettes par commune</CardTitle>
            <CardDescription>Impôt calculé sur la période, 12 premières communes</CardDescription>
          </CardHeader>
          <CardContent>
            {communeData.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--color-muted-foreground)]">Aucune recette sur la période.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={communeData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip formatter={(v) => formatCDF(Number(v))} />
                    <Bar dataKey="montant" fill="#0033a0" radius={[0, 4, 4, 0]} name="Impôt" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Par type de bien</CardTitle>
            <CardDescription>Répartition de l’impôt calculé</CardDescription>
          </CardHeader>
          <CardContent>
            {typeData.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--color-muted-foreground)]">Aucune donnée.</p>
            ) : (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {typeData.map((_, i) => (
                          <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCDF(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 space-y-1 text-xs">
                  {typeData.map((t, i) => (
                    <li key={t.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                        {t.name}
                      </span>
                      <span className="font-mono">{formatCDF(t.value)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top contributeurs</CardTitle>
            <CardDescription>20 premiers bailleurs par impôt collecté sur la période</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={contributorColumns as unknown as DataTableColumn<Record<string, unknown>>[]}
              data={d.topContributors as unknown as Record<string, unknown>[]}
              emptyTitle="Aucun contributeur sur la période"
              pageSize={10}
              getRowId={(row) => String(row.bailleurId)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribution de la conformité</CardTitle>
            <CardDescription>{totalLandlordsScored} bailleurs notés</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {complianceData.map((c) => {
              const share = totalLandlordsScored ? (c.count / totalLandlordsScored) * 100 : 0;
              const colors = COMPLIANCE_COLORS[c.level];
              return (
                <div key={c.level}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>{c.label}</span>
                    <span className="font-mono text-xs">
                      {c.count} · {share.toLocaleString('fr-CD', { maximumFractionDigits: 0 })} %
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
                    <div className="h-full rounded-full" style={{ width: `${share}%`, background: colors.hex }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Croissance des enregistrements</CardTitle>
            <CardDescription>Nouveaux bailleurs et logements par mois (12 mois)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.registrationGrowth.map((g) => ({ ...g, month: g.month.slice(2) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="bailleurs" name="Bailleurs" stroke="#0033a0" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="logements" name="Logements" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Prévision — 6 prochains mois</CardTitle>
              <CardDescription>
                Scénario de base {forecast.data ? formatCDF(forecast.data.totals.base) : '…'} · IC 80 %
              </CardDescription>
            </div>
            <Link to={ROUTES.FISCAL.FORECAST} className="text-sm text-[var(--color-kinshasa-blue)] hover:underline">
              Détail →
            </Link>
          </CardHeader>
          <CardContent>
            {forecast.isLoading ? (
              <div className="h-60 animate-pulse rounded-lg bg-[var(--color-muted)]" />
            ) : forecastData.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--color-muted-foreground)]">Historique insuffisant pour projeter.</p>
            ) : (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={44} />
                    <Tooltip formatter={(v) => formatCDF(Number(v))} />
                    <Line type="monotone" dataKey="upper" name="Haut" stroke="#94a3b8" strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="base" name="Base" stroke="#0033a0" strokeWidth={2} />
                    <Line type="monotone" dataKey="lower" name="Bas" stroke="#94a3b8" strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm">
        <p className="flex items-center gap-2 text-[var(--color-muted-foreground)]">
          <Landmark className="h-4 w-4" /> Les montants correspondent à l’impôt calculé par le moteur fiscal sur les loyers encaissés via eLoyer.
        </p>
        <div className="flex gap-2">
          <Link to={ROUTES.FISCAL.ANOMALIES}>
            <Button variant="outline" size="sm">
              <AlertTriangle className="mr-2 h-4 w-4" /> Anomalies
            </Button>
          </Link>
          <Link to={ROUTES.FISCAL.FORECAST}>
            <Button variant="outline" size="sm">
              <Wallet className="mr-2 h-4 w-4" /> Prévisions
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
