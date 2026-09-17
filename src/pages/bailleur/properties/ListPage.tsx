import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { PropertyGrid } from '@/components/properties/PropertyGrid';
import { PropertyList } from '@/components/properties/PropertyList';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, CommuneSelect } from '@/components/ui/Select';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useProperties, useArchiveProperty } from '@/hooks/useProperties';
import { ROUTES } from '@/config/routes';
import { PROPERTY_TYPES } from '@/config/app.config';
import { KINSHASA_COMMUNES } from '@/config/communes';
import type { PropertyStatus } from '@/types';

type ViewMode = 'grid' | 'table';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: 'occupe', label: 'En location' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'maintenance', label: 'En travaux' },
];

export function PropertiesListPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('property-view-mode', 'grid');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [commune, setCommune] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'loyer_mensuel' | 'address'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading } = useProperties(
    { page, pageSize: 12 },
    {
      status: status === 'all' ? 'all' : status as PropertyStatus,
      commune: commune === 'all' ? 'all' : commune as typeof KINSHASA_COMMUNES[number],
      type: type === 'all' ? 'all' : type as typeof PROPERTY_TYPES[number],
      search: search || undefined,
      sortBy,
      sortOrder,
    },
  );

  const archiveMutation = useArchiveProperty();

  const properties = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes logements"
        subtitle={`${data?.total ?? 0} bien(s) enregistré(s)`}
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => navigate(ROUTES.BAILLEUR.PROPERTY_NEW)}>
            Ajouter un logement
          </Button>
        }
      />

      <div className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            placeholder="Rechercher par code ou adresse..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="lg:max-w-xs"
          />
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onValueChange={(v) => { setStatus(v); setPage(1); }}
            placeholder="Statut"
          />
          <CommuneSelect
            value={commune === 'all' ? '' : commune}
            onValueChange={(v) => { setCommune(v || 'all'); setPage(1); }}
            placeholder="Commune"
          />
          <Select
            options={[
              { value: 'all', label: 'Tous les types' },
              ...PROPERTY_TYPES.filter((t) => t !== 'Entrepôt').map((t) => ({ value: t, label: t })),
            ]}
            value={type}
            onValueChange={(v) => { setType(v); setPage(1); }}
            placeholder="Type"
          />
          <Select
            options={[
              { value: 'created_at-desc', label: 'Plus récents' },
              { value: 'loyer_mensuel-asc', label: 'Prix croissant' },
              { value: 'loyer_mensuel-desc', label: 'Prix décroissant' },
              { value: 'address-asc', label: 'Adresse A-Z' },
            ]}
            value={`${sortBy}-${sortOrder}`}
            onValueChange={(v) => {
              const [field, order] = v.split('-') as [typeof sortBy, typeof sortOrder];
              setSortBy(field);
              setSortOrder(order);
            }}
            placeholder="Tri"
          />
          <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`rounded p-2 ${viewMode === 'grid' ? 'bg-[var(--color-muted)]' : ''}`}
              aria-label="Vue grille"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded p-2 ${viewMode === 'table' ? 'bg-[var(--color-muted)]' : ''}`}
              aria-label="Vue tableau"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <PropertyGrid
          properties={properties}
          loading={isLoading}
          onEdit={(p) => navigate(ROUTES.BAILLEUR.PROPERTY_EDIT.replace(':id', p.id))}
          onCreateContract={() => navigate(ROUTES.BAILLEUR.CONTRACTS)}
          onArchive={(p) => archiveMutation.mutate(p.id)}
        />
      ) : (
        <PropertyList properties={properties} loading={isLoading} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Précédent
          </Button>
          <span className="text-sm text-[var(--color-muted-foreground)]">
            Page {page} sur {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Suivant
          </Button>
        </div>
      )}

      <Link
        to={ROUTES.BAILLEUR.PROPERTY_NEW}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-kinshasa-gold)] shadow-lg md:hidden"
        aria-label="Ajouter un logement"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
