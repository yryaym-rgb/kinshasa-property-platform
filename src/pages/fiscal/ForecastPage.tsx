import { useMemo, useState } from 'react';
import { Building2, Download, FileText, Gauge, Info, TrendingUp, Wallet } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/common/PageHeader';
import { KPICard } from '@/components/common/KPICard';
import { StatCard } from '@/components/common/StatCard';
import { DashboardSkeleton } from '@/components/common/SkeletonLoaders';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { toastError, toastSuccess } from '@/components/ui/Toast';
import { useForecast } from '@/hooks/useTaxes';
import { fiscalPdf } from '@/services/pdf/fiscalPdf';
import { formatCDF } from '@/lib/utils';
import type { ForecastScenario } from '@/types/tax';
import type { SelectOption } from '@/types';

const HORIZON_OPTIONS: SelectOption[] = [
  { value: '6', label: '6 mois' },
  { value: '12', label: '12 mois' },
  { value: '24', label: '24 mois' },
];

const SCENARIO_META: Record<ForecastScenario, { label: string; color: string; description: string }> = {
  pessimistic: { label: 'Pessimiste', color: '#dc2626', description: 'Ralentissement des enregistrements, conformité en baisse' },
  base: { label: 'Base', color: '#0033a0', description: 'Tendance des 12 derniers mois pondérée par le taux de conformité' },
  optimistic: { label: 'Optimiste', color: '#059669', description: 'Accélération de l’adoption et hausse de la conformité' },
};

function pct(v: number, digits = 1): string {
  return `${v.toLocaleString('fr-CD', { maximumFractionDigits: digits })} %`;
}

export function ForecastPage() {
  const [months, setMonths] = useState<number>(12);
  const [exporting, setExporting] = useState(false);
  const forecast = useForecast(months);

  const chartData = useMemo(() => {
    const f = forecast.data;
    if (!f) return [];
    const lastHistoryMonth = f.history[f.history.length - 1]?.month;
    const history = f.history.map((h) => ({ month: h.month, historique: h.impots, base: h.month === lastHistoryMonth ? h.impots : undefined }));
    const projection = f.projection.map((p) => ({
      month: p.month,
      base: p.base,
      optimiste: p.optimistic,
      pessimiste: p.pessimistic,
      bande: [p.lower, p.upper] as [number, number],
    }));
    return [...history, ...projection].map((d) => ({ ...d, label: d.month.slice(2) }));
  }, [forecast.data]);

  const exportPdf = async () => {
    if (!forecast.data) return;
    setExporting(true);
    try {
      await fiscalPdf.exportForecast(forecast.data, months);
      toastSuccess('Rapport de prévisions exporté');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Export impossible');
    } finally {
      setExporting(false);
    }
  };

  if (forecast.isLoading) return <DashboardSkeleton />;

  if (forecast.error || !forecast.data) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-destructive)]">{forecast.error?.message ?? 'Prévisions indisponibles'}</p>
        <Button className="mt-4" onClick={() => void forecast.refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  const f = forecast.data;
  const lastHistoryLabel = f.history[f.history.length - 1]?.month.slice(2);
  const historyTotal = f.history.slice(-12).reduce((a, h) => a + h.impots, 0);
  const uplift = historyTotal > 0 && months === 12 ? ((f.totals.base - historyTotal) / historyTotal) * 100 : null;

  return (
    <div className="space-y-6" data-testid="forecast-page">
      <PageHeader
        title="Prévisions de recettes"
        subtitle="Projection de l’impôt sur les revenus locatifs collecté via eLoyer"
        actions={
          <div className="flex gap-2">
            <Select options={HORIZON_OPTIONS} value={String(months)} onValueChange={(v) => setMonths(Number(v))} className="w-32" />
            <Button variant="outline" onClick={() => void exportPdf()} disabled={exporting} data-testid="export-forecast">
              <Download className="mr-2 h-4 w-4" /> {exporting ? 'Génération…' : 'Exporter en PDF'}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {(['pessimistic', 'base', 'optimistic'] as ForecastScenario[]).map((s) => (
          <StatCard
            key={s}
            label={`Scénario ${SCENARIO_META[s].label.toLowerCase()} — ${months} mois`}
            value={formatCDF(f.totals[s])}
            description={SCENARIO_META[s].description}
            highlight={s === 'base'}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[var(--color-kinshasa-blue)]" /> Historique et projection
          </CardTitle>
          <CardDescription>
            24 mois d’historique · projection {months} mois · bande = intervalle de confiance 80 % autour du scénario de base
            {uplift !== null && ` · ${uplift >= 0 ? '+' : ''}${pct(uplift)} vs 12 derniers mois`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--color-muted-foreground)]">Aucun historique disponible.</p>
          ) : (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={52} />
                  <Tooltip
                    formatter={(v, name) => {
                      if (Array.isArray(v)) return [`${formatCDF(Number(v[0]))} — ${formatCDF(Number(v[1]))}`, 'IC 80 %'];
                      return [formatCDF(Number(v)), String(name)];
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="bande" name="IC 80 %" fill="#0033a0" fillOpacity={0.08} stroke="none" connectNulls />
                  <Line type="monotone" dataKey="historique" name="Historique" stroke="#64748b" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                  <Line type="monotone" dataKey="base" name="Base" stroke={SCENARIO_META.base.color} strokeWidth={2.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="optimiste" name="Optimiste" stroke={SCENARIO_META.optimistic.color} strokeDasharray="5 4" dot={false} connectNulls />
                  <Line type="monotone" dataKey="pessimiste" name="Pessimiste" stroke={SCENARIO_META.pessimistic.color} strokeDasharray="5 4" dot={false} connectNulls />
                  {lastHistoryLabel && <ReferenceLine x={lastHistoryLabel} stroke="var(--color-muted-foreground)" strokeDasharray="2 2" label={{ value: 'aujourd’hui', fontSize: 10, position: 'top' }} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Projection mensuelle</CardTitle>
            <CardDescription>Montants d’impôt attendus par mois et par scénario</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  <tr>
                    <th className="py-2">Mois</th>
                    <th className="py-2 text-right" style={{ color: SCENARIO_META.pessimistic.color }}>
                      Pessimiste
                    </th>
                    <th className="py-2 text-right" style={{ color: SCENARIO_META.base.color }}>
                      Base
                    </th>
                    <th className="py-2 text-right" style={{ color: SCENARIO_META.optimistic.color }}>
                      Optimiste
                    </th>
                    <th className="py-2 text-right">IC 80 %</th>
                  </tr>
                </thead>
                <tbody>
                  {f.projection.map((p) => (
                    <tr key={p.month} className="border-t border-[var(--color-border)]">
                      <td className="py-2 font-medium">{p.month}</td>
                      <td className="py-2 text-right font-mono">{formatCDF(p.pessimistic)}</td>
                      <td className="py-2 text-right font-mono font-semibold">{formatCDF(p.base)}</td>
                      <td className="py-2 text-right font-mono">{formatCDF(p.optimistic)}</td>
                      <td className="py-2 text-right font-mono text-xs text-[var(--color-muted-foreground)]">
                        {formatCDF(p.lower)} – {formatCDF(p.upper)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-[var(--color-border)] font-semibold">
                  <tr>
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right font-mono">{formatCDF(f.totals.pessimistic)}</td>
                    <td className="py-2 text-right font-mono">{formatCDF(f.totals.base)}</td>
                    <td className="py-2 text-right font-mono">{formatCDF(f.totals.optimistic)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Facteurs du modèle</CardTitle>
              <CardDescription>Variables qui déterminent la projection</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <KPICard label="Logements enregistrés" value={f.factors.registeredProperties} icon={Building2} />
              <KPICard label="Contrats actifs" value={f.factors.activeContracts} icon={FileText} />
              <KPICard label="Loyer moyen" value={formatCDF(f.factors.averageRent)} icon={Wallet} />
              <KPICard label="Taux de conformité" value={pct(f.factors.complianceRate)} icon={Gauge} />
              <KPICard
                label="Croissance mensuelle observée"
                value={pct(f.factors.monthlyGrowthRate * 100, 2)}
                subtitle={`impôt mensuel moyen ${formatCDF(f.factors.averageMonthlyTax)}`}
                icon={TrendingUp}
                valueClassName={f.factors.monthlyGrowthRate >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-destructive)]'}
              />
            </CardContent>
          </Card>

          <div className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-xs text-[var(--color-muted-foreground)]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Modèle explicable : régression linéaire sur les 12 derniers mois (70 %) mélangée au niveau moyen (30 %), pondérée par le taux de conformité. Les
              scénarios optimiste / pessimiste appliquent des écarts croissants avec l’horizon. Aucune donnée externe n’est utilisée.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
