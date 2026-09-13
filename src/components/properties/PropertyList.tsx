import { useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/ui/DataTable';
import { PropertyStatusBadge } from '@/components/properties/PropertyStatusBadge';
import { formatCDF } from '@/lib/utils';
import { formatPropertyAddress, formatPropertyTypeLabel } from '@/utils/propertyUtils';
import { ROUTES } from '@/config/routes';
import type { Logement } from '@/types/database.types';
import type { DataTableColumn } from '@/types';

const columns: DataTableColumn<Logement>[] = [
  {
    key: 'code',
    header: 'Code',
    render: (row) => <span className="font-mono text-xs">{row.code}</span>,
  },
  {
    key: 'address',
    header: 'Adresse',
    render: (row) => formatPropertyAddress(row),
  },
  {
    key: 'type',
    header: 'Type',
    render: (row) => formatPropertyTypeLabel(row.type, row.rooms),
  },
  {
    key: 'loyer_mensuel',
    header: 'Loyer',
    sortable: true,
    render: (row) => (
      <span className="font-semibold text-[var(--color-kinshasa-gold)]">
        {formatCDF(Number(row.loyer_mensuel))}
      </span>
    ),
  },
  {
    key: 'commune',
    header: 'Commune',
  },
  {
    key: 'status',
    header: 'Statut',
    render: (row) => <PropertyStatusBadge status={row.status} />,
  },
];

interface PropertyListProps {
  properties: Logement[];
  loading?: boolean;
}

export function PropertyList({ properties, loading }: PropertyListProps) {
  const navigate = useNavigate();
  const tableData = properties as unknown as Record<string, unknown>[];

  return (
    <DataTable
      columns={columns as DataTableColumn<Record<string, unknown>>[]}
      data={tableData}
      loading={loading}
      emptyTitle="Aucun logement"
      emptyDescription="Ajoutez votre premier logement pour commencer."
      pageSize={12}
      onRowClick={(row) => {
        navigate(ROUTES.BAILLEUR.PROPERTY_DETAIL.replace(':id', String(row.id)));
      }}
      getRowId={(row) => String(row.id)}
    />
  );
}
