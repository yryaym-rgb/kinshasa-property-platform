import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Calculator, Download, FileCheck, Landmark, Receipt, RefreshCw, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/common/PageHeader';
import { KPICard } from '@/components/common/KPICard';
import { DashboardSkeleton } from '@/components/common/SkeletonLoaders';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { toastError, toastSuccess } from '@/components/ui/Toast';
import { ComplianceGauge } from '@/components/tax/ComplianceGauge';
import { TaxStatusBadge } from '@/components/tax/TaxStatusBadge';
import { UnderstandTaxesPanel } from '@/components/tax/UnderstandTaxesPanel';
import { useAuth } from '@/hooks/useAuth';
import { useTaxCompliance } from '@/hooks/useTaxCompliance';
import { useBailleurId, useTaxHistory, useTaxRealtime, useTaxSummary, useUpcomingDeadlines } from '@/hooks/useTaxes';
import { fiscalPdf } from '@/services/pdf/fiscalPdf';
import { formatCDF, formatDate } from '@/lib/utils';
import { getDueDateBadge } from '@/utils/dateUtils';
import { ROUTES } from '@/config/routes';
import { TAX_STATUS_LABELS, type TaxDeadline, type TaxHistoryRow } from '@/types/tax';
import type { DataTableColumn, SelectOption } from '@/types';

const CURRENT_YEAR = new Date().getFullYear();

function periodLabel(periode: string): string {
  const [y, m] = periode.split('-');
  if (!m) return periode;
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('fr-CD', { month: 'long', year: 'numeric' });
}

function DeadlineRow({ deadline }: { deadline: TaxDeadline }) {
  const overdue = deadline.joursRestants < 0;
  const badge = getDueDateBadge(Math.abs(deadline.joursRestants), overdue);
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {periodLabel(deadline.periode)}
          {deadline.logementCode && <span className="ml-2 font-mono text-xs text-[var(--color-muted-foreground)]">{deadline.logementCode}</span>}
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Échéance le {formatDate(deadline.dateEcheance, 'dd MMM yyyy')}
          {deadline.commune ? ` · ${deadline.commune}` : ''}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-semibold">{formatCDF(deadline.montant)}</p>
        <Badge variant={badge.variant} className="gap-1">
          <CalendarClock className="h-3 w-3" />
          {badge.label}
        </Badge>
      </div>
    </li>
  );
}

export function TaxDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const bailleurId = useBailleurId();
  useTaxRealtime(bailleurId);

  const [year, setYear] = useState<string>(String(CURRENT_YEAR));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

  const summary = useTaxSummary(year === 'all' ? undefined : year);
  const compliance = useTaxCompliance();
  const deadlines = useUpcomingDeadlines();
  const history = useTaxHistory({ year: year === 'all' ? 'all' : Number(year), status: statusFilter });

  const yearOptions: SelectOption[] = useMemo(() => {
    const years = new Set<number>([CURRENT_YEAR, CURRENT_YEAR - 1]);
    for (const row of history.data ?? []) years.add(Number(row.periode.slice(0, 4)));
    return [{ value: 'all', label: 'Toutes les années' }, ...[...years].sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) }))];
  }, [history.data]);

  const statusOptions: SelectOption[] = [
    { value: 'all', label: 'Tous les statuts' },
    ...Object.entries(TAX_STATUS_LABELS).map(([value, label]) => ({ value, label })),
  ];

  const chartData = useMemo(
    () => (summary.data?.parPeriode ?? []).slice(-12).map((p) => ({ periode: p.periode.slice(2), Payé: p.paye, Dû: p.du })),
    [summary.data],
  );

  const columns: DataTableColumn<TaxHistoryRow>[] = [
    { key: 'periode', header: 'Période', sortable: true, render: (row) => <span className="font-medium">{periodLabel(row.periode)}</span> },
    { key: 'logementCode', header: 'Logement', render: (row) => <span className="font-mono text-xs">{row.logementCode ?? '—'}</span> },
    { key: 'base_imposable', header: 'Base', render: (row) => formatCDF(Number(row.base_imposable ?? 0)) },
    { key: 'taux', header: 'Taux', render: (row) => `${(Number(row.taux) * 100).toLocaleString('fr-CD', { maximumFractionDigits: 2 })} %` },
    { key: 'montant', header: 'Impôt', sortable: true, render: (row) => <span className="font-mono font-semibold">{formatCDF(Number(row.montant))}</span> },
    { key: 'date_echeance', header: 'Échéance', render: (row) => (row.date_echeance ? formatDate(row.date_echeance, 'dd MMM yyyy') : '—') },
    { key: 'status', header: 'Statut', render: (row) => <TaxStatusBadge status={row.status} /> },
  ];

  const handleExport = async () => {
    if (!summary.data) return;
    setExporting(true);
    try {
      await fiscalPdf.exportTaxCertificate({
        landlordName: user?.bailleur?.business_name ?? user?.full_name ?? 'Bailleur',
        summary: summary.data,
        history: history.data ?? [],
      });
      toastSuccess('Attestation téléchargée');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Export impossible');
    } finally {
      setExporting(false);
    }
  };

  if (!bailleurId) {
    return (
      <EmptyState
        icon={<Landmark className="h-8 w-8" />}
        title="Profil bailleur introuvable"
        description="Votre compte n’est pas encore rattaché à un profil bailleur. Complétez votre profil pour accéder à votre fiscalité."
      />
    );
  }

  if (summary.isLoading && compliance.isLoading) return <DashboardSkeleton />;

  if (summary.error) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-destructive)]">{summary.error.message}</p>
        <Button className="mt-4" onClick={() => void summary.refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  const s = summary.data;
  const overdueCount = (deadlines.data ?? []).filter((d) => d.joursRestants < 0).length;

  return (
    <div className="space-y-6" data-testid="tax-dashboard">
      <PageHeader
        title="Ma fiscalité"
        subtitle="Impôt sur les revenus locatifs — calculé automatiquement à chaque loyer encaissé"
        actions={
          <div className="flex flex-wrap gap-2">
            <Select options={yearOptions} value={year} onValueChange={setYear} className="w-44" />
            <Link to={ROUTES.BAILLEUR.TAX_SIMULATOR}>
              <Button variant="outline">
                <Calculator className="mr-2 h-4 w-4" /> Simulateur
              </Button>
            </Link>
            <Button onClick={() => void handleExport()} disabled={exporting || !s} data-testid="download-certificate">
              <Download className="mr-2 h-4 w-4" /> {exporting ? 'Génération…' : 'Attestation PDF'}
            </Button>
          </div>
        }
      />

      {overdueCount > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">
              {overdueCount} obligation{overdueCount > 1 ? 's' : ''} en retard — {formatCDF(s?.totalEnRetard ?? 0)}
            </p>
            <p>Les impôts en retard pèsent sur votre score de conformité. Régularisez-les dès que possible.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Impôts calculés" value={formatCDF(s?.totalCalcule ?? 0)} subtitle={`${s?.nbObligations ?? 0} obligation(s) · ${year === 'all' ? 'toutes années' : year}`} icon={Receipt} />
        <KPICard label="Impôts réglés" value={formatCDF(s?.totalPaye ?? 0)} subtitle={`${s?.nbPayees ?? 0} réglée(s)`} icon={FileCheck} valueClassName="text-[var(--color-success)]" />
        <KPICard label="Reste dû" value={formatCDF(s?.totalDu ?? 0)} subtitle={s?.totalEnRetard ? `dont ${formatCDF(s.totalEnRetard)} en retard` : 'aucun retard'} icon={Wallet} valueClassName={s?.totalDu ? 'text-[var(--color-kinshasa-gold)]' : undefined} />
        <KPICard label="Base imposable" value={formatCDF(s?.baseImposable ?? 0)} subtitle="loyers bruts perçus" icon={Landmark} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card data-testid="compliance-card">
          <CardHeader>
            <CardTitle>Score de conformité</CardTitle>
            <CardDescription>Mis à jour à chaque paiement encaissé</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {compliance.isLoading ? (
              <div className="h-40 w-full animate-pulse rounded-lg bg-[var(--color-muted)]" />
            ) : compliance.data ? (
              <>
                <ComplianceGauge score={compliance.data.score} level={compliance.data.level} size={190} />
                <ul className="mt-4 w-full space-y-2">
                  {compliance.data.components.map((c) => (
                    <li key={c.key} className="text-xs">
                      <div className="flex justify-between">
                        <span>{c.label}</span>
                        <span className="font-mono">
                          {Math.round(c.score)}/{c.max}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
                        <div className="h-full rounded-full bg-[var(--color-kinshasa-blue)]" style={{ width: `${c.max ? (c.score / c.max) * 100 : 0}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                {compliance.advice[0] && (
                  <p className="mt-4 rounded-lg bg-[var(--color-muted)] p-3 text-xs text-[var(--color-muted-foreground)]">{compliance.advice[0].message}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--color-muted-foreground)]">Score indisponible.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Obligations en cours</CardTitle>
              <CardDescription>Ce que vous devez à la DGI, par période</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void summary.refetch()} aria-label="Actualiser">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Total dû</p>
                <p className="font-heading text-3xl font-bold text-[var(--color-kinshasa-gold)]">{formatCDF(s?.totalDu ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">En retard</p>
                <p className="font-heading text-xl font-semibold text-[var(--color-destructive)]">{formatCDF(s?.totalEnRetard ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Payé</p>
                <p className="font-heading text-xl font-semibold text-[var(--color-success)]">{formatCDF(s?.totalPaye ?? 0)}</p>
              </div>
            </div>
            {chartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">Aucune obligation sur cette période.</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={44} />
                    <Tooltip formatter={(v) => formatCDF(Number(v))} />
                    <Legend />
                    <Bar dataKey="Payé" stackId="a" fill="#059669" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="Dû" stackId="a" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Échéances à venir</CardTitle>
            <CardDescription>Obligations non encore réglées</CardDescription>
          </CardHeader>
          <CardContent>
            {deadlines.isLoading ? (
              <div className="h-32 animate-pulse rounded-lg bg-[var(--color-muted)]" />
            ) : (deadlines.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">Aucune échéance en attente. Vous êtes à jour.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {(deadlines.data ?? []).slice(0, 6).map((d) => (
                  <DeadlineRow key={d.impotId} deadline={d} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Historique</CardTitle>
              <CardDescription>Toutes vos obligations fiscales</CardDescription>
            </div>
            <Select options={statusOptions} value={statusFilter} onValueChange={setStatusFilter} className="w-48" />
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
              data={(history.data ?? []) as unknown as Record<string, unknown>[]}
              loading={history.isLoading}
              emptyTitle="Aucun impôt enregistré"
              emptyDescription="Vos impôts apparaîtront ici dès le premier loyer encaissé via eLoyer."
              pageSize={8}
              onRowClick={(row) => navigate(ROUTES.BAILLEUR.TAX_DETAIL.replace(':id', String(row.id)))}
              getRowId={(row) => String(row.id)}
            />
          </CardContent>
        </Card>
      </div>

      <UnderstandTaxesPanel />
    </div>
  );
}
