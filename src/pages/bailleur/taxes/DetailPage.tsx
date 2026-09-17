import { useNavigate, useParams } from 'react-router-dom';
import { Building2, CalendarClock, CreditCard, History, Landmark, Scale } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { DetailPageSkeleton } from '@/components/common/SkeletonLoaders';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TaxBreakdownTable } from '@/components/tax/TaxBreakdownTable';
import { TaxStatusBadge } from '@/components/tax/TaxStatusBadge';
import { useTaxDetail } from '@/hooks/useTaxes';
import { formatCDF, formatDate, formatDateTime } from '@/lib/utils';
import { ROUTES } from '@/config/routes';
import type { CalculationDetail } from '@/types/tax';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function TaxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: impot, isLoading, error, refetch } = useTaxDetail(id);

  if (isLoading) return <DetailPageSkeleton />;

  if (error || !impot) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-destructive)]">{error?.message ?? 'Obligation introuvable'}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate(ROUTES.BAILLEUR.TAXES)}>
            Retour
          </Button>
          <Button onClick={() => void refetch()}>Réessayer</Button>
        </div>
      </div>
    );
  }

  const detail = (impot.calcul?.detail_calcul ?? (impot.detail_calcul as CalculationDetail[] | null) ?? []) as CalculationDetail[];
  const taux = Number(impot.taux);
  const base = Number(impot.base_imposable ?? impot.contrat?.loyer_mensuel ?? 0);
  const overdue = impot.date_echeance ? new Date(impot.date_echeance) < new Date() && !['paye', 'exonere', 'annule'].includes(impot.status) : false;
  const recalculated = impot.recalcule_at && impot.montant_precedent !== null;

  return (
    <div className="space-y-6" data-testid="tax-detail">
      <PageHeader
        title={`Impôt — période ${impot.periode}`}
        subtitle={impot.contrat?.logement ? `${impot.contrat.logement.type} · ${impot.contrat.logement.address}, ${impot.contrat.logement.commune}` : undefined}
        showBack
        onBack={() => navigate(ROUTES.BAILLEUR.TAXES)}
        actions={<TaxStatusBadge status={impot.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Montant de l’impôt" value={formatCDF(Number(impot.montant))} highlight />
        <StatCard label="Base imposable" value={formatCDF(base)} description="loyer brut de la période" />
        <StatCard label="Taux effectif" value={`${(taux * 100).toLocaleString('fr-CD', { maximumFractionDigits: 2 })} %`} />
        <StatCard
          label="Échéance"
          value={impot.date_echeance ? formatDate(impot.date_echeance, 'dd MMM yyyy') : '—'}
          description={overdue ? 'En retard' : impot.paid_at ? `Réglé le ${formatDate(impot.paid_at, 'dd MMM yyyy')}` : undefined}
          className={overdue ? 'border-[var(--color-destructive)]' : undefined}
        />
      </div>

      {recalculated && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
          <History className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Cet impôt a été recalculé le {formatDateTime(impot.recalcule_at!)} suite à une mise à jour des règles fiscales. Montant précédent :{' '}
            <strong>{formatCDF(Number(impot.montant_precedent))}</strong>.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-[var(--color-kinshasa-blue)]" /> Détail du calcul
            </CardTitle>
            <CardDescription>
              {impot.calcul ? `Moteur fiscal v${impot.calcul.calculation_version} · calculé le ${formatDateTime(impot.calcul.created_at)}` : `Calculé le ${formatDateTime(impot.calculated_at)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TaxBreakdownTable detail={detail} baseImposable={base} montantImpot={Number(impot.montant)} />
            {(impot.reference_legale ?? impot.regle?.reference_legale) && (
              <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">
                <span className="font-medium text-[var(--color-foreground)]">Référence légale : </span>
                {impot.reference_legale ?? impot.regle?.reference_legale}
                {impot.regle?.article_loi ? ` — ${impot.regle.article_loi}` : ''}
              </p>
            )}
            {impot.regle?.description && <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{impot.regle.description}</p>}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-[var(--color-kinshasa-blue)]" /> Paiement à l’origine
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-[var(--color-border)]">
              {impot.paiement ? (
                <>
                  <Row label="Référence" value={<span className="font-mono text-xs">{impot.paiement.reference}</span>} />
                  <Row label="Montant payé" value={formatCDF(Number(impot.paiement.montant))} />
                  <Row label="Moyen" value={impot.paiement.provider ?? '—'} />
                  <Row label="Date" value={impot.paiement.paid_at ? formatDateTime(impot.paiement.paid_at) : '—'} />
                </>
              ) : (
                <p className="py-2 text-sm text-[var(--color-muted-foreground)]">Obligation générée sans paiement associé.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-[var(--color-kinshasa-blue)]" /> Contrat et logement
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-[var(--color-border)]">
              {impot.contrat ? (
                <>
                  <Row label="Contrat" value={<span className="font-mono text-xs">{impot.contrat.code}</span>} />
                  <Row label="Loyer mensuel" value={formatCDF(Number(impot.contrat.loyer_mensuel))} />
                  <Row label="Logement" value={<span className="font-mono text-xs">{impot.contrat.logement?.code ?? '—'}</span>} />
                  <Row label="Type" value={impot.contrat.logement?.type ?? impot.type_logement ?? '—'} />
                  <Row label="Commune" value={impot.contrat.logement?.commune ?? impot.commune ?? '—'} />
                  <div className="pt-3">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(ROUTES.BAILLEUR.CONTRACT_DETAIL.replace(':id', impot.contrat!.id))}>
                      Voir le contrat
                    </Button>
                  </div>
                </>
              ) : (
                <p className="py-2 text-sm text-[var(--color-muted-foreground)]">Contrat introuvable.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Landmark className="h-4 w-4 text-[var(--color-kinshasa-blue)]" /> Reversement à la DGI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {impot.status === 'paye' ? (
                <p className="text-[var(--color-success)]">Impôt reversé à la DGI{impot.paid_at ? ` le ${formatDate(impot.paid_at, 'dd MMMM yyyy')}` : ''}.</p>
              ) : impot.status === 'exonere' ? (
                <p>Aucun impôt dû : cette période est exonérée.</p>
              ) : impot.status === 'annule' ? (
                <p>Obligation annulée (paiement remboursé).</p>
              ) : (
                <>
                  <p className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    À reverser au plus tard le {impot.date_echeance ? formatDate(impot.date_echeance, 'dd MMMM yyyy') : '15 du mois suivant'}.
                  </p>
                  {overdue && <Badge variant="danger">En retard</Badge>}
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    Sur eLoyer, l’impôt est retenu au moment du paiement du loyer et comptabilisé au crédit de la DGI. Le statut passe à « Payé » lors du rapprochement par l’administration.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
