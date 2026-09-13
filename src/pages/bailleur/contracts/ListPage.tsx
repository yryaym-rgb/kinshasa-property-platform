import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  Bell,
  Download,
  FileText,
  MoreVertical,
  Plus,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { TableSkeleton } from '@/components/common/SkeletonLoaders';
import { ContractStatusBadge } from '@/components/contracts/ContractStatusBadge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select, CommuneSelect } from '@/components/ui/Select';
import { DateRangePicker } from '@/components/ui/DatePicker';
import { useContracts } from '@/hooks/useContracts';
import { useProperties } from '@/hooks/useProperties';
import {
  formatCurrency,
  formatDate,
  formatPhone,
  getInitials,
  truncate,
} from '@/lib/utils';
import { getNextPaymentDue } from '@/utils/contractUtils';
import { ROUTES } from '@/config/routes';
import type { DataTableColumn } from '@/types';
import type { ContractWithRelations } from '@/services/contract/contractService';

const STATUS_OPTIONS = [
  { value: 'actif', label: 'Actif' },
  { value: 'all', label: 'Tous' },
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'en_attente_signature', label: 'En attente de signature' },
  { value: 'expire', label: 'Expiré' },
  { value: 'resilie', label: 'Résilié' },
];

export function ContractsListPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('actif');
  const [commune, setCommune] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [search, setSearch] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selectedIds] = useState<Set<string>>(new Set());

  const filters = useMemo(
    () => ({
      status,
      commune: commune || undefined,
      propertyId: propertyId || undefined,
      search: search || undefined,
      dateStart: dateStart || undefined,
      dateEnd: dateEnd || undefined,
    }),
    [status, commune, propertyId, search, dateStart, dateEnd],
  );

  const { contracts, stats, loading } = useContracts(undefined, filters);
  const { data: propertiesData } = useProperties({ pageSize: 100 });

  const propertyOptions = [
    { value: '', label: 'Tous les logements' },
    ...(propertiesData?.data ?? []).map((p) => ({
      value: p.id,
      label: `${p.code} — ${truncate(p.address, 30)}`,
    })),
  ];

  const exportCsv = (ids?: string[]) => {
    const rows = ids
      ? contracts.filter((c) => ids.includes(c.id))
      : contracts;
    const headers = ['Code', 'Locataire', 'Logement', 'Loyer', 'Début', 'Fin', 'Statut'];
    const csvRows = rows.map((c) => [
      c.code,
      c.locataire?.full_name ?? '',
      c.logement?.code ?? '',
      c.loyer_mensuel,
      c.date_debut,
      c.date_fin ?? '',
      c.status,
    ]);
    const csv = [headers, ...csvRows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contrats.csv';
    a.click();
  };

  const columns: DataTableColumn<ContractWithRelations>[] = [
    {
      key: 'locataire',
      header: 'Locataire',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.locataire?.avatar_url ? (
            <img src={row.locataire.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-kinshasa-blue)] text-xs text-white">
              {getInitials(row.locataire?.full_name ?? '?')}
            </div>
          )}
          <div>
            <p className="font-medium">{row.locataire?.full_name ?? '—'}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {row.locataire?.phone ? formatPhone(row.locataire.phone) : '—'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'logement',
      header: 'Logement',
      render: (row) => (
        <div>
          <p className="font-mono text-xs">{row.logement?.code}</p>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {truncate(row.logement?.address ?? '—', 35)}
          </p>
        </div>
      ),
    },
    {
      key: 'loyer_mensuel',
      header: 'Loyer mensuel',
      sortable: true,
      render: (row) => (
        <span className="font-bold">
          {formatCurrency(Number(row.loyer_mensuel), row.currency as 'CDF' | 'USD')}
        </span>
      ),
    },
    {
      key: 'date_debut',
      header: 'Début',
      sortable: true,
      render: (row) => formatDate(row.date_debut),
    },
    {
      key: 'date_fin',
      header: 'Fin',
      render: (row) => (row.date_fin ? formatDate(row.date_fin) : '—'),
    },
    {
      key: 'echeance',
      header: 'Prochaine échéance',
      render: (row) => {
        if (row.status !== 'actif') return '—';
        const { date, daysRemaining } = getNextPaymentDue(row.payment_day);
        return (
          <div>
            <p className="text-sm">{formatDate(date.toISOString())}</p>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                daysRemaining <= 5
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {daysRemaining}j
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => <ContractStatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="sm" aria-label="Actions">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="z-50 min-w-[180px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-lg">
              <DropdownMenu.Item
                className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
                onSelect={() => navigate(ROUTES.BAILLEUR.CONTRACT_DETAIL.replace(':id', row.id))}
              >
                Voir
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
                onSelect={() =>
                  navigate(ROUTES.BAILLEUR.CONTRACT_EDIT.replace(':id', row.id))
                }
              >
                Modifier
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
                onSelect={() => row.pdf_url && window.open(row.pdf_url, '_blank')}
              >
                Télécharger PDF
              </DropdownMenu.Item>
              <DropdownMenu.Item className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]">
                Envoyer rappel
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />
              <DropdownMenu.Item className="cursor-pointer rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                Résilier
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contrats"
        subtitle={`${contracts.length} contrat(s)`}
        actions={
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => navigate(ROUTES.BAILLEUR.CONTRACT_NEW)}
          >
            Créer un contrat
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contrats actifs" value={String(stats?.activeCount ?? 0)} />
        <StatCard
          label="Revenu mensuel"
          value={formatCurrency(stats?.monthlyRevenue ?? 0)}
          highlight
        />
        <StatCard label="Expirent dans 30 jours" value={String(stats?.expiringIn30Days ?? 0)} />
        <StatCard label="Impayés" value={String(stats?.unpaidCount ?? 0)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Input
          placeholder="Rechercher par nom ou code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="lg:col-span-2"
        />
        <Select options={STATUS_OPTIONS} value={status} onValueChange={setStatus} />
        <CommuneSelect value={commune} onValueChange={setCommune} placeholder="Toutes les communes" />
        <Select
          options={propertyOptions}
          value={propertyId}
          onValueChange={setPropertyId}
        />
      </div>

      <DateRangePicker
        startDate={dateStart}
        endDate={dateEnd}
        onStartChange={setDateStart}
        onEndChange={setDateEnd}
        label="Période (début / fin)"
      />

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3">
          <span className="text-sm font-medium">{selectedIds.size} sélectionné(s)</span>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => exportCsv(Array.from(selectedIds))}
          >
            Exporter CSV
          </Button>
          <Button variant="outline" size="sm" leftIcon={<Bell className="h-4 w-4" />}>
            Envoyer rappels
          </Button>
          <Button variant="outline" size="sm" leftIcon={<Archive className="h-4 w-4" />}>
            Archiver
          </Button>
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : contracts.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="Aucun contrat pour le moment"
          description="Créez votre premier contrat de bail pour commencer à gérer vos locataires."
          actionLabel="Créer un contrat"
          onAction={() => navigate(ROUTES.BAILLEUR.CONTRACT_NEW)}
        />
      ) : (
        <DataTable
          columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
          data={contracts as unknown as Record<string, unknown>[]}
          selectable
          onRowClick={(row) =>
            navigate(ROUTES.BAILLEUR.CONTRACT_DETAIL.replace(':id', String(row.id)))
          }
          getRowId={(row) => String(row.id)}
        />
      )}
    </div>
  );
}
