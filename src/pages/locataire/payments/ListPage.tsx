import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Search, Wallet, Hash, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { TableSkeleton } from '@/components/common/SkeletonLoaders';
import { PaymentStatusBadge } from '@/components/payments/PaymentStatusBadge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { KPICard } from '@/components/common/KPICard';
import { useTenantPayments } from '@/hooks/useTenantPayments';
import { receiptService } from '@/services/receipt/receiptService';
import { formatCDF, formatDate } from '@/lib/utils';
import { ROUTES } from '@/config/routes';
import type { DataTableColumn } from '@/types';

const YEARS = [2023, 2024, 2025];

export function PaymentsListPage() {
  const [year, setYear] = useState<number | 'all'>(2025);
  const [status, setStatus] = useState<'all' | 'reussi' | 'en_attente' | 'echoue'>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch } = useTenantPayments({ year, status, search });

  const payments = data?.payments ?? [];
  const summary = data?.summary;

  const columns: DataTableColumn<Record<string, unknown>>[] = [
    {
      key: 'paid_at',
      header: 'Date',
      render: (row) => (row.paid_at ? formatDate(row.paid_at as string) : formatDate(row.created_at as string)),
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
      key: 'method',
      header: 'Moyen',
      render: (row) => String(row.method),
    },
    {
      key: 'reference',
      header: 'Référence',
      render: (row) => <span className="font-mono text-xs">{row.reference as string}</span>,
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
        const recu = row.recu as { id?: string; code?: string }[] | { id?: string; code?: string } | null;
        const r = Array.isArray(recu) ? recu[0] : recu;
        if (!r?.id) return '—';
        return (
          <button
            type="button"
            onClick={() => receiptService.downloadReceiptPdf(r.id!)}
            className="text-[var(--color-kinshasa-blue)] hover:underline"
            aria-label="Télécharger le reçu"
          >
            <Download className="h-4 w-4" />
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Mes paiements" subtitle="Historique de vos paiements de loyer" />
        <Link to={ROUTES.LOCATAIRE.PAYMENT_NEW}>
          <Button>Nouveau paiement</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={String(year)}
          onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
          aria-label="Année"
        >
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          <option value="all">Tous</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
          aria-label="Statut"
        >
          <option value="all">Tous</option>
          <option value="reussi">Réussi</option>
          <option value="en_attente">En attente</option>
          <option value="echoue">Échoué</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Référence ou code logement..."
            className="w-full rounded-lg border border-[var(--color-border)] py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard label="Total payé cette année" value={formatCDF(summary?.totalPaid ?? 0)} icon={Wallet} />
        <KPICard label="Nombre de paiements" value={summary?.count ?? 0} icon={Hash} />
        <KPICard
          label="Dernier paiement"
          value={summary?.lastPaymentDate ? formatDate(summary.lastPaymentDate) : '—'}
          icon={Calendar}
        />
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-[var(--color-destructive)]">{error.message}</p>
          <Button className="mt-4" onClick={() => refetch()}>Réessayer</Button>
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          title="Aucun paiement pour le moment"
          description="Vos paiements de loyer apparaîtront ici."
          actionLabel="Effectuer un paiement"
          onAction={() => { window.location.href = ROUTES.LOCATAIRE.PAYMENT_NEW; }}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <DataTable columns={columns} data={payments as Record<string, unknown>[]} />
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {payments.map((p) => {
              const contrat = p.contrat as { logement?: { code?: string } };
              const recu = p.recu as { id?: string }[] | { id?: string } | null;
              const recuId = Array.isArray(recu) ? recu[0]?.id : recu?.id;
              return (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{formatCDF(Number(p.montant))}</p>
                        <p className="font-mono text-xs text-[var(--color-muted-foreground)]">{contrat?.logement?.code}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          {p.paid_at ? formatDate(p.paid_at) : formatDate(p.created_at)}
                        </p>
                      </div>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span>{p.method}</span>
                      {recuId && (
                        <button
                          type="button"
                          onClick={() => receiptService.downloadReceiptPdf(recuId)}
                          className="flex items-center gap-1 text-[var(--color-kinshasa-blue)]"
                        >
                          <Download className="h-3.5 w-3.5" /> Reçu
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Button variant="outline" className="w-full sm:w-auto">
        Télécharger le relevé annuel PDF
      </Button>
    </div>
  );
}
