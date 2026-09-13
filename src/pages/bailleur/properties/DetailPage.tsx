import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, MoreVertical, MapPin, Download, Share2,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tabs from '@radix-ui/react-tabs';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DetailPageSkeleton } from '@/components/common/SkeletonLoaders';
import { PropertyStatusBadge } from '@/components/properties/PropertyStatusBadge';
import { PropertyQRCode } from '@/components/properties/PropertyQRCode';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { PaymentStatusBadge, ContractStatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useProperty, usePropertyContracts, usePropertyPayments } from '@/hooks/useProperty';
import { useArchiveProperty } from '@/hooks/useProperties';
import { formatCDF, formatDate } from '@/lib/utils';
import {
  getPropertyMetadata,
  getPropertyCoordinates,
  formatPropertyAddress,
  formatPropertyTypeLabel,
  PROPERTY_AMENITIES,
} from '@/utils/propertyUtils';
import { ROUTES } from '@/config/routes';
import type { DataTableColumn } from '@/types';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('info');
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const { data: property, isLoading, error, refetch } = useProperty(id);
  const { data: contracts = [] } = usePropertyContracts(id);
  const { data: payments = [] } = usePropertyPayments(id);
  const archiveMutation = useArchiveProperty();

  if (isLoading) return <DetailPageSkeleton />;

  if (error || !property) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-destructive)]">{error?.message ?? 'Logement introuvable'}</p>
        <Button className="mt-4" onClick={() => refetch()}>Réessayer</Button>
      </div>
    );
  }

  const meta = getPropertyMetadata(property);
  const coords = getPropertyCoordinates(property);
  const photos = property.photos ?? [];

  const totalCollected = payments
    .filter((p) => p.status === 'complete')
    .reduce((sum, p) => sum + Number(p.montant), 0);
  const outstanding = payments
    .filter((p) => p.status !== 'complete')
    .reduce((sum, p) => sum + Number(p.montant), 0);
  const thisMonth = payments.filter((p) => {
    const d = new Date(p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((sum, p) => sum + Number(p.montant), 0);

  const contractColumns: DataTableColumn<Record<string, unknown>>[] = [
    {
      key: 'locataire',
      header: 'Locataire',
      render: (row) => {
        const loc = row.locataire as { full_name?: string };
        return loc?.full_name ?? '—';
      },
    },
    {
      key: 'period',
      header: 'Période',
      render: (row) => `${formatDate(row.date_debut as string)} — ${row.date_fin ? formatDate(row.date_fin as string) : 'En cours'}`,
    },
    {
      key: 'loyer',
      header: 'Loyer',
      render: (row) => formatCDF(Number(row.loyer_mensuel)),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => <ContractStatusBadge status={row.status as string} />,
    },
  ];

  const paymentColumns: DataTableColumn<Record<string, unknown>>[] = [
    { key: 'periode', header: 'Période' },
    {
      key: 'montant',
      header: 'Montant',
      render: (row) => formatCDF(Number(row.montant)),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => <PaymentStatusBadge status={row.status as string} />,
    },
    {
      key: 'paid_at',
      header: 'Date',
      render: (row) => (row.paid_at ? formatDate(row.paid_at as string) : '—'),
    },
  ];

  const exportCsv = () => {
    const headers = ['Période', 'Montant', 'Statut', 'Date'];
    const rows = payments.map((p) => [
      p.periode,
      p.montant,
      p.status,
      p.paid_at ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paiements-${property.code}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.BAILLEUR.PROPERTIES)} aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl font-bold">{formatPropertyTypeLabel(property.type, property.rooms)}</h1>
              <PropertyStatusBadge status={property.status} />
            </div>
            <p className="font-mono text-sm text-[var(--color-muted-foreground)]">{property.code}</p>
          </div>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="outline" size="sm">
              <MoreVertical className="h-4 w-4" />
              Actions
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="z-50 min-w-[180px] rounded-lg border bg-white p-1 shadow-lg">
              <DropdownMenu.Item className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]" onSelect={() => navigate(ROUTES.BAILLEUR.PROPERTY_EDIT.replace(':id', property.id))}>
                Modifier
              </DropdownMenu.Item>
              <DropdownMenu.Item className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]" onSelect={() => navigate(ROUTES.BAILLEUR.CONTRACTS)}>
                Créer un contrat
              </DropdownMenu.Item>
              <DropdownMenu.Item className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]" onSelect={() => archiveMutation.mutate(property.id)}>
                Archiver
              </DropdownMenu.Item>
              <DropdownMenu.Item className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]">
                <Share2 className="mr-2 inline h-4 w-4" />Partager
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
              {[
                { id: 'info', label: 'Informations' },
                { id: 'contrats', label: 'Contrats' },
                { id: 'paiements', label: 'Paiements' },
                { id: 'photos', label: 'Photos' },
                { id: 'documents', label: 'Documents' },
              ].map((tab) => (
                <Tabs.Trigger
                  key={tab.id}
                  value={tab.id}
                  className="px-4 py-2 text-sm font-medium text-[var(--color-muted-foreground)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-kinshasa-blue)] data-[state=active]:text-[var(--color-kinshasa-blue)]"
                >
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="info" className="mt-6 space-y-6">
              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {photos.map((photo, i) => (
                    <button key={i} type="button" onClick={() => setLightboxPhoto(photo)} className="aspect-video overflow-hidden rounded-lg">
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <Card>
                <CardHeader><CardTitle className="text-base">Localisation</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>{formatPropertyAddress(property)}</p>
                  <p className="text-[var(--color-muted-foreground)]">
                    {meta.province ?? 'Kinshasa'} · {meta.ville ?? 'Kinshasa'} · {property.commune}
                    {property.quartier && ` · ${property.quartier}`}
                  </p>
                  {property.parcelle && <p>Parcelle: {property.parcelle}</p>}
                  {meta.immeuble && <p>Immeuble: {meta.immeuble}</p>}
                  {meta.appartement && <p>Appartement: {meta.appartement}</p>}
                  {coords && (
                    <p className="flex items-center gap-1 text-[var(--color-muted-foreground)]">
                      <MapPin className="h-4 w-4" />
                      {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </p>
                  )}
                  {coords && (
                    <div className="mt-3 h-48 overflow-hidden rounded-lg">
                      <MapContainer center={[coords.lat, coords.lng]} zoom={15} className="h-full w-full">
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[coords.lat, coords.lng]} icon={markerIcon} />
                      </MapContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base">Caractéristiques</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>Type: {property.type}</p>
                    <p>Pièces: {property.rooms ?? '—'}</p>
                    <p>Chambres: {meta.chambres ?? '—'}</p>
                    <p>Salles de bain: {meta.sallesDeBain ?? '—'}</p>
                    <p>Superficie: {property.surface_m2 ? `${property.surface_m2} m²` : '—'}</p>
                    <p>Étage: {meta.etage ?? '—'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Loyer</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p className="text-lg font-bold text-[var(--color-kinshasa-gold)]">
                      {formatCDF(Number(property.loyer_mensuel))}
                    </p>
                    <p>Charges: {formatCDF(meta.chargesMensuelles ?? 0)}</p>
                    <p>Dépôt: {formatCDF(meta.depotGarantie ?? 0)}</p>
                    <p>Échéance: le {meta.paymentDay ?? 5} de chaque mois</p>
                  </CardContent>
                </Card>
              </div>

              {(meta.amenities ?? []).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Équipements</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {PROPERTY_AMENITIES.filter((a) => meta.amenities?.includes(a)).map((a) => (
                        <span key={a} className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-xs">{a}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {property.description && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
                  <CardContent><p className="text-sm">{property.description}</p></CardContent>
                </Card>
              )}
            </Tabs.Content>

            <Tabs.Content value="contrats" className="mt-6">
              <div className="mb-4 flex justify-end">
                <Button size="sm" onClick={() => navigate(ROUTES.BAILLEUR.CONTRACTS)}>
                  Créer un contrat
                </Button>
              </div>
              {contracts.length === 0 ? (
                <EmptyState title="Aucun contrat" description="Créez un contrat pour ce logement." />
              ) : (
                <DataTable
                  columns={contractColumns}
                  data={contracts as unknown as Record<string, unknown>[]}
                  pageSize={10}
                />
              )}
            </Tabs.Content>

            <Tabs.Content value="paiements" className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Total perçu" value={formatCDF(totalCollected)} />
                <StatCard label="En attente" value={formatCDF(outstanding)} />
                <StatCard label="Ce mois" value={formatCDF(thisMonth)} highlight />
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={exportCsv}>
                  Exporter CSV
                </Button>
              </div>
              <DataTable
                columns={paymentColumns}
                data={payments as unknown as Record<string, unknown>[]}
                emptyTitle="Aucun paiement"
              />
            </Tabs.Content>

            <Tabs.Content value="photos" className="mt-6">
              {photos.length === 0 ? (
                <EmptyState title="Aucune photo" description="Ajoutez des photos via la modification du logement." />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((photo, i) => (
                    <img key={i} src={photo} alt="" className="aspect-square rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </Tabs.Content>

            <Tabs.Content value="documents" className="mt-6">
              <EmptyState title="Documents" description="Téléversez titre de propriété, permis, etc. via la modification." />
            </Tabs.Content>
          </Tabs.Root>
        </div>

        <PropertyQRCode code={property.code} />
      </div>

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxPhoto(null)}
          role="dialog"
          aria-label="Aperçu photo"
        >
          <img src={lightboxPhoto} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
