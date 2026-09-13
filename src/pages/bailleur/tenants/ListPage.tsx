import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Users } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { TableSkeleton } from '@/components/common/SkeletonLoaders';
import { TenantSearch } from '@/components/tenants/TenantSearch';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Select, CommuneSelect } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTenants } from '@/hooks/useTenants';
import { formatPhone, getInitials } from '@/lib/utils';
import { ROUTES } from '@/config/routes';
import type { DataTableColumn } from '@/types';
import type { TenantWithContract } from '@/hooks/useTenants';

export function TenantsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [commune, setCommune] = useState('all');
  const [status, setStatus] = useState<'all' | 'a_jour' | 'en_retard'>('all');

  const { data: tenants = [], isLoading } = useTenants({
    search,
    commune: commune === 'all' ? undefined : commune,
    status,
  });

  const columns: DataTableColumn<TenantWithContract>[] = [
    {
      key: 'avatar',
      header: '',
      render: (row) => (
        row.avatar_url ? (
          <img src={row.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-kinshasa-blue)] text-xs text-white">
            {getInitials(row.full_name)}
          </div>
        )
      ),
    },
    { key: 'full_name', header: 'Nom', sortable: true },
    {
      key: 'phone',
      header: 'Téléphone',
      render: (row) => formatPhone(row.phone),
    },
    {
      key: 'logement',
      header: 'Logement',
      render: (row) => (
        <div>
          <p className="text-sm">{row.logement_address}</p>
          <p className="font-mono text-xs text-[var(--color-muted-foreground)]">{row.logement_code}</p>
        </div>
      ),
    },
    {
      key: 'contract',
      header: 'Contrat',
      render: (row) => <span className="font-mono text-xs">{row.contract_code}</span>,
    },
    {
      key: 'payment_status',
      header: 'Statut paiement',
      render: (row) => (
        <Badge variant={row.payment_status === 'a_jour' ? 'success' : 'danger'}>
          {row.payment_status === 'a_jour' ? 'À jour' : 'En retard'}
        </Badge>
      ),
    },
  ];

  const exportCsv = () => {
    const headers = ['Nom', 'Téléphone', 'Logement', 'Contrat', 'Loyer', 'Statut'];
    const rows = tenants.map((t) => [
      t.full_name,
      t.phone,
      t.logement_address,
      t.contract_code,
      t.loyer_mensuel,
      t.payment_status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'locataires.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locataires"
        subtitle={`${tenants.length} locataire(s)`}
        actions={
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={exportCsv}>
            Exporter CSV
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <TenantSearch value={search} onChange={setSearch} />
        <CommuneSelect
          value={commune === 'all' ? '' : commune}
          onValueChange={(v) => setCommune(v || 'all')}
          placeholder="Toutes les communes"
        />
        <Select
          options={[
            { value: 'all', label: 'Tous les statuts' },
            { value: 'a_jour', label: 'À jour' },
            { value: 'en_retard', label: 'En retard' },
          ]}
          value={status}
          onValueChange={(v) => setStatus(v as typeof status)}
        />
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : tenants.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="Aucun locataire"
          description="Les locataires apparaîtront ici une fois vos contrats créés."
        />
      ) : (
        <DataTable
          columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
          data={tenants as unknown as Record<string, unknown>[]}
          onRowClick={(row) => {
            navigate(ROUTES.BAILLEUR.TENANT_DETAIL.replace(':id', String(row.id)));
          }}
          getRowId={(row) => String(row.id)}
        />
      )}
    </div>
  );
}
