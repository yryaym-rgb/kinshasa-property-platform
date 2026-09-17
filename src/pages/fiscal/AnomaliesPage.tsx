import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Building2, CheckCircle2, CreditCard, FileText, Filter, RefreshCw, ShieldAlert, User, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/common/SkeletonLoaders';
import { useAnomalies, useAnomalyActions } from '@/hooks/useTaxes';
import { formatDateTime } from '@/lib/utils';
import {
  ANOMALY_SEVERITY_LABELS,
  ANOMALY_STATUS_LABELS,
  ANOMALY_TYPE_LABELS,
  type Anomaly,
  type AnomalyFilters,
  type AnomalySeverity,
  type AnomalyStatus,
  type AnomalyType,
} from '@/types/tax';
import type { SelectOption } from '@/types';

const SEVERITY_VARIANT: Record<AnomalySeverity, BadgeProps['variant']> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};
const STATUS_VARIANT: Record<AnomalyStatus, BadgeProps['variant']> = {
  detected: 'warning',
  reviewed: 'info',
  escalated: 'danger',
  dismissed: 'neutral',
};
const SEVERITY_ORDER: Record<AnomalySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'open', label: 'Ouvertes (détectées + escaladées)' },
  { value: 'detected', label: 'Détectées' },
  { value: 'reviewed', label: 'Examinées' },
  { value: 'escalated', label: 'Escaladées' },
  { value: 'dismissed', label: 'Écartées' },
  { value: 'all', label: 'Toutes' },
];
const SEVERITY_OPTIONS: SelectOption[] = [{ value: 'all', label: 'Toutes sévérités' }, ...Object.entries(ANOMALY_SEVERITY_LABELS).map(([value, label]) => ({ value, label }))];
const TYPE_OPTIONS: SelectOption[] = [{ value: 'all', label: 'Tous les types' }, ...Object.entries(ANOMALY_TYPE_LABELS).map(([value, label]) => ({ value, label }))];

function signalsOf(anomaly: Anomaly): Array<[string, string]> {
  const raw = anomaly.signaux;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
}

function AnomalyCard({ anomaly, onAction }: { anomaly: Anomaly; onAction: (a: Anomaly, statut: AnomalyStatus) => void }) {
  const severity = anomaly.severite as AnomalySeverity;
  const statut = anomaly.statut as AnomalyStatus;
  const signals = signalsOf(anomaly);
  const closed = statut === 'reviewed' || statut === 'dismissed';

  return (
    <Card className={severity === 'critical' && !closed ? 'border-red-300 dark:border-red-900/60' : undefined} data-testid="anomaly-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={SEVERITY_VARIANT[severity] ?? 'neutral'} className="gap-1">
                <ShieldAlert className="h-3 w-3" /> {ANOMALY_SEVERITY_LABELS[severity] ?? anomaly.severite}
              </Badge>
              <Badge variant={STATUS_VARIANT[statut] ?? 'neutral'}>{ANOMALY_STATUS_LABELS[statut] ?? anomaly.statut}</Badge>
              <span className="text-xs text-[var(--color-muted-foreground)]">{ANOMALY_TYPE_LABELS[anomaly.type as AnomalyType] ?? anomaly.type}</span>
            </div>
            <h3 className="mt-2 font-heading text-base font-semibold">{anomaly.titre}</h3>
            {anomaly.description && <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{anomaly.description}</p>}
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)]">Détectée le {formatDateTime(anomaly.detected_at)}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-[var(--color-muted)]/60 p-3 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">Entités liées</p>
            <ul className="space-y-1.5">
              {anomaly.bailleur && (
                <li className="flex items-center gap-2">
                  <User className="h-4 w-4 text-[var(--color-kinshasa-blue)]" />
                  <span className="truncate">
                    {anomaly.bailleur.business_name ?? anomaly.bailleur.user?.full_name ?? 'Bailleur'}
                    {anomaly.bailleur.user?.commune ? ` · ${anomaly.bailleur.user.commune}` : ''}
                  </span>
                </li>
              )}
              {anomaly.logement && (
                <li className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[var(--color-kinshasa-blue)]" />
                  <span className="truncate">
                    <span className="font-mono text-xs">{anomaly.logement.code}</span> — {anomaly.logement.address}, {anomaly.logement.commune}
                  </span>
                </li>
              )}
              {anomaly.contrat && (
                <li className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[var(--color-kinshasa-blue)]" />
                  <span className="font-mono text-xs">{anomaly.contrat.code}</span>
                </li>
              )}
              {anomaly.paiement && (
                <li className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[var(--color-kinshasa-blue)]" />
                  <span className="font-mono text-xs">{anomaly.paiement.reference}</span>
                </li>
              )}
              {!anomaly.bailleur && !anomaly.logement && !anomaly.contrat && !anomaly.paiement && <li className="text-[var(--color-muted-foreground)]">—</li>}
            </ul>
          </div>
          <div className="rounded-lg bg-[var(--color-muted)]/60 p-3 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">Signaux / preuves</p>
            {signals.length === 0 ? (
              <p className="text-[var(--color-muted-foreground)]">Aucun signal détaillé.</p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {signals.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="font-mono text-xs text-[var(--color-muted-foreground)]">{k}</dt>
                    <dd className="truncate font-mono text-xs">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        {anomaly.action_suggeree && (
          <p className="flex items-start gap-2 text-sm">
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-kinshasa-gold)]" />
            <span>
              <span className="font-medium">Action suggérée : </span>
              {anomaly.action_suggeree}
            </span>
          </p>
        )}

        {anomaly.commentaire && (
          <p className="rounded-lg border border-[var(--color-border)] p-3 text-sm text-[var(--color-muted-foreground)]">
            <span className="font-medium text-[var(--color-foreground)]">Commentaire : </span>
            {anomaly.commentaire}
            {anomaly.traite_at ? ` (${formatDateTime(anomaly.traite_at)})` : ''}
          </p>
        )}

        {!closed && (
          <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
            <Button size="sm" variant="outline" onClick={() => onAction(anomaly, 'reviewed')}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Marquer examinée
            </Button>
            {statut !== 'escalated' && (
              <Button size="sm" variant="danger" onClick={() => onAction(anomaly, 'escalated')}>
                <AlertTriangle className="mr-1.5 h-4 w-4" /> Escalader
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onAction(anomaly, 'dismissed')}>
              <XCircle className="mr-1.5 h-4 w-4" /> Écarter
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AnomaliesPage() {
  const [statut, setStatut] = useState<string>('open');
  const [severite, setSeverite] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [pending, setPending] = useState<{ anomaly: Anomaly; statut: AnomalyStatus } | null>(null);
  const [comment, setComment] = useState('');

  const filters: AnomalyFilters = useMemo(
    () => ({
      statut: statut as AnomalyFilters['statut'],
      severite: severite === 'all' ? undefined : (severite as AnomalySeverity),
      type: type === 'all' ? undefined : type,
    }),
    [statut, severite, type],
  );

  const anomalies = useAnomalies(filters);
  const { updateStatus, detect } = useAnomalyActions();

  const sorted = useMemo(
    () => [...(anomalies.data ?? [])].sort((a, b) => (SEVERITY_ORDER[a.severite as AnomalySeverity] ?? 9) - (SEVERITY_ORDER[b.severite as AnomalySeverity] ?? 9)),
    [anomalies.data],
  );

  const counts = useMemo(() => {
    const c: Record<AnomalySeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const a of anomalies.data ?? []) {
      const s = a.severite as AnomalySeverity;
      if (s in c) c[s] += 1;
    }
    return c;
  }, [anomalies.data]);

  const confirm = () => {
    if (!pending) return;
    updateStatus.mutate({ id: pending.anomaly.id, statut: pending.statut, commentaire: comment.trim() || undefined }, { onSettled: () => setPending(null) });
    setComment('');
  };

  return (
    <div className="space-y-6" data-testid="anomalies-page">
      <PageHeader
        title="Anomalies fiscales"
        subtitle="Signaux détectés automatiquement sur les déclarations, les biens et les paiements"
        actions={
          <Button variant="outline" onClick={() => detect.mutate(undefined)} loading={detect.isPending} data-testid="run-detection">
            <RefreshCw className="mr-2 h-4 w-4" /> Lancer la détection
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {(Object.keys(SEVERITY_ORDER) as AnomalySeverity[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeverite(severite === s ? 'all' : s)}
            className={`rounded-lg border p-4 text-left transition-colors ${severite === s ? 'border-[var(--color-kinshasa-blue)] bg-[var(--color-accent)]' : 'border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)]'}`}
          >
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">{ANOMALY_SEVERITY_LABELS[s]}</p>
            <p className="mt-1 font-heading text-2xl font-bold">{counts[s]}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-[var(--color-muted-foreground)]" />
        <Select options={STATUS_OPTIONS} value={statut} onValueChange={setStatut} className="w-64" />
        <Select options={SEVERITY_OPTIONS} value={severite} onValueChange={setSeverite} className="w-44" />
        <Select options={TYPE_OPTIONS} value={type} onValueChange={setType} className="w-64" />
        <span className="ml-auto text-sm text-[var(--color-muted-foreground)]">{sorted.length} anomalie(s)</span>
      </div>

      {anomalies.isLoading ? (
        <TableSkeleton rows={4} />
      ) : anomalies.error ? (
        <div className="py-12 text-center">
          <p className="text-[var(--color-destructive)]">{anomalies.error.message}</p>
          <Button className="mt-4" onClick={() => void anomalies.refetch()}>
            Réessayer
          </Button>
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8" />}
          title="Aucune anomalie"
          description="Aucun signal ne correspond aux filtres. Lancez la détection pour analyser les données les plus récentes."
          actionLabel="Lancer la détection"
          onAction={() => detect.mutate(undefined)}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {sorted.map((a) => (
            <AnomalyCard key={a.id} anomaly={a} onAction={(anomaly, next) => setPending({ anomaly, statut: next })} />
          ))}
        </div>
      )}

      <Modal
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending ? `Marquer comme « ${ANOMALY_STATUS_LABELS[pending.statut]} »` : undefined}
        description={pending?.anomaly.titre}
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium" htmlFor="anomaly-comment">
            Commentaire (facultatif)
          </label>
          <textarea
            id="anomaly-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            placeholder="Contexte, décision, référence de dossier…"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPending(null)}>
              Annuler
            </Button>
            <Button onClick={confirm} loading={updateStatus.isPending}>
              Confirmer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
