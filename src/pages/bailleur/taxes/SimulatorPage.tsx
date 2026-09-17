import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calculator, Download, Info, Scale } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CommuneSelect, Select } from '@/components/ui/Select';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { toastError, toastSuccess } from '@/components/ui/Toast';
import { TaxBreakdownTable } from '@/components/tax/TaxBreakdownTable';
import { UnderstandTaxesPanel } from '@/components/tax/UnderstandTaxesPanel';
import { useTaxSimulation } from '@/hooks/useTaxes';
import { fiscalPdf } from '@/services/pdf/fiscalPdf';
import { estimateBreakdown, isCommercialType } from '@/services/tax/taxService';
import { formatCDF } from '@/lib/utils';
import { PROPERTY_TYPES } from '@/config/app.config';
import { ROUTES } from '@/config/routes';
import type { SimulationResult, TypeContribuable } from '@/types/tax';
import type { SelectOption } from '@/types';

const TYPE_OPTIONS: SelectOption[] = PROPERTY_TYPES.map((t) => ({ value: t, label: t }));
const CONTRIBUABLE_OPTIONS: SelectOption[] = [
  { value: 'personne_physique', label: 'Personne physique' },
  { value: 'personne_morale', label: 'Personne morale (société)' },
];

function pct(fraction: number): string {
  return `${(fraction * 100).toLocaleString('fr-CD', { maximumFractionDigits: 2 })} %`;
}

export function TaxSimulatorPage() {
  const navigate = useNavigate();
  const [typeLogement, setTypeLogement] = useState<string>('Appartement');
  const [commune, setCommune] = useState<string>('');
  const [montantBrut, setMontantBrut] = useState<number>(0);
  const [typeContribuable, setTypeContribuable] = useState<TypeContribuable>('personne_physique');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [exporting, setExporting] = useState(false);

  const simulation = useTaxSimulation();

  const canRun = montantBrut > 0 && !!commune && !!typeLogement && !simulation.isPending;

  /** Instant local estimate shown while the engine has not run yet. */
  const quickEstimate = useMemo(() => {
    if (montantBrut <= 0) return null;
    return estimateBreakdown({ rentAmount: montantBrut, taxRate: isCommercialType(typeLogement) ? 0.15 : 0.1 });
  }, [montantBrut, typeLogement]);

  const run = () => {
    if (!canRun) return;
    simulation.mutate(
      { montantBrut, typeLogement, commune, typeContribuable },
      {
        onSuccess: (data) => setResult(data),
      },
    );
  };

  const exportPdf = async () => {
    if (!result) return;
    setExporting(true);
    try {
      await fiscalPdf.exportSimulation(result);
      toastSuccess('Simulation exportée en PDF');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Export impossible');
    } finally {
      setExporting(false);
    }
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    const points = [
      ...result.scenarios.filter((s) => s.montantBrut < result.input.montantBrut),
      { label: 'Référence', montantBrut: result.input.montantBrut, result: result.base },
      ...result.scenarios.filter((s) => s.montantBrut > result.input.montantBrut),
    ];
    return points.map((p) => ({ name: p.label, loyer: p.montantBrut, impot: p.result.montantImpot, reference: p.label === 'Référence' }));
  }, [result]);

  const pendingRefs = result?.base.references.filter((r) => r.pendingValidation).length ?? 0;

  return (
    <div className="space-y-6" data-testid="tax-simulator">
      <PageHeader
        title="Simulateur fiscal"
        subtitle="Estimez l’impôt sur vos revenus locatifs avant de fixer un loyer — les règles appliquées sont celles du moteur fiscal officiel"
        showBack
        onBack={() => navigate(ROUTES.BAILLEUR.TAXES)}
        actions={
          <Button variant="outline" onClick={() => void exportPdf()} disabled={!result || exporting} data-testid="export-simulation">
            <Download className="mr-2 h-4 w-4" /> {exporting ? 'Génération…' : 'Exporter en PDF'}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-[var(--color-kinshasa-blue)]" /> Paramètres
            </CardTitle>
            <CardDescription>Décrivez le bien et le loyer envisagé</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select label="Type de logement" options={TYPE_OPTIONS} value={typeLogement} onValueChange={setTypeLogement} />
            <CommuneSelect label="Commune" value={commune} onValueChange={setCommune} />
            <CurrencyInput label="Loyer mensuel envisagé (CDF)" value={montantBrut} onChange={(v) => setMontantBrut(v)} showCurrencySelector={false} />
            <Select label="Type de contribuable" options={CONTRIBUABLE_OPTIONS} value={typeContribuable} onValueChange={(v) => setTypeContribuable(v as TypeContribuable)} />

            <Button className="w-full" size="lg" onClick={run} disabled={!canRun} loading={simulation.isPending} data-testid="run-simulation">
              <Calculator className="mr-2 h-4 w-4" /> Simuler
            </Button>

            {quickEstimate && !result && (
              <div className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-sm">
                <p className="flex items-center gap-2 text-[var(--color-muted-foreground)]">
                  <Info className="h-4 w-4" /> Estimation rapide (avant simulation)
                </p>
                <p className="mt-1 font-heading text-xl font-bold">{formatCDF(quickEstimate.taxAmount)}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  soit {pct(quickEstimate.taxRate)} du loyer — taux indicatif, remplacé par le calcul officiel après simulation.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {!result ? (
            <Card>
              <CardContent className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="rounded-full bg-[var(--color-accent)] p-4">
                  <Scale className="h-8 w-8 text-[var(--color-kinshasa-blue)]" />
                </div>
                <h3 className="mt-4 font-heading text-lg font-semibold">Aucune simulation pour l’instant</h3>
                <p className="mt-1 max-w-md text-sm text-[var(--color-muted-foreground)]">
                  Renseignez le type de bien, la commune et le loyer, puis lancez la simulation. Vous verrez l’impôt estimé, les règles appliquées et leurs
                  références légales, ainsi que des scénarios de loyer alternatifs.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3" data-testid="simulation-result">
                <StatCard label="Impôt mensuel estimé" value={formatCDF(result.base.montantImpot)} highlight description={result.base.exonere ? 'Exonéré' : `taux effectif ${pct(result.base.tauxEffectif)}`} />
                <StatCard label="Impôt annuel estimé" value={formatCDF(result.base.montantImpot * 12)} description="sur 12 loyers" />
                <StatCard label="Loyer net perçu" value={formatCDF(result.input.montantBrut)} description="le locataire paie loyer + impôt" />
              </div>

              {result.base.exonere && (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <Info className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>
                    <strong>Exonération.</strong> {result.base.motifExoneration ?? 'Aucun impôt n’est dû pour ce scénario.'}
                  </p>
                </div>
              )}

              {pendingRefs > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>
                    {pendingRefs} règle{pendingRefs > 1 ? 's' : ''} appliquée{pendingRefs > 1 ? 's' : ''} {pendingRefs > 1 ? 'sont' : 'est'} encore en attente de validation
                    juridique par la DGI. Le résultat est indicatif.
                  </p>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Scénarios de loyer</CardTitle>
                  <CardDescription>Impact d’une variation du loyer sur l’impôt mensuel</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={44} />
                        <Tooltip formatter={(v, name) => [formatCDF(Number(v)), name === 'impot' ? 'Impôt' : 'Loyer']} />
                        <Bar dataKey="impot" radius={[4, 4, 0, 0]}>
                          {chartData.map((d) => (
                            <Cell key={d.name} fill={d.reference ? '#0033a0' : '#94a3b8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                        <tr>
                          <th className="py-1">Scénario</th>
                          <th className="py-1 text-right">Loyer</th>
                          <th className="py-1 text-right">Impôt / mois</th>
                          <th className="py-1 text-right">Taux</th>
                          <th className="py-1 text-right">Impôt / an</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.map((d) => {
                          const point = d.reference ? result.base : result.scenarios.find((s) => s.label === d.name)?.result;
                          return (
                            <tr key={d.name} className={d.reference ? 'font-semibold' : ''}>
                              <td className="py-1">{d.name}</td>
                              <td className="py-1 text-right font-mono">{formatCDF(d.loyer)}</td>
                              <td className="py-1 text-right font-mono">{formatCDF(d.impot)}</td>
                              <td className="py-1 text-right font-mono">{point ? pct(point.tauxEffectif) : '—'}</td>
                              <td className="py-1 text-right font-mono">{formatCDF(d.impot * 12)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Règles appliquées et références légales</CardTitle>
                  <CardDescription>
                    Moteur fiscal v{result.base.calculationVersion} · {result.regles.length} règle{result.regles.length > 1 ? 's' : ''} applicable
                    {result.regles.length > 1 ? 's' : ''} à ce profil
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <TaxBreakdownTable detail={result.base.detail} references={result.base.references} baseImposable={result.base.baseImposable} montantImpot={result.base.montantImpot} />
                  {result.regles.length > 0 && (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {result.regles.map((r) => (
                        <li key={r.id} className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">{r.nom}</p>
                            <Badge variant={r.exonere ? 'success' : r.mode_application === 'cumulatif' ? 'warning' : 'info'}>
                              {r.exonere ? 'Exonération' : r.type_taux === 'fixe' ? formatCDF(Number(r.montant_fixe ?? 0)) : pct(Number(r.taux))}
                            </Badge>
                          </div>
                          {r.description && <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{r.description}</p>}
                          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                            {r.reference_legale}
                            {r.article_loi ? ` — ${r.article_loi}` : ''} · priorité {r.priorite}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <UnderstandTaxesPanel />
    </div>
  );
}
