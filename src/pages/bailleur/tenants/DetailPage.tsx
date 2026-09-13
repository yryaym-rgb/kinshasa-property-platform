import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, MessageCircle, Mail } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { DetailPageSkeleton } from '@/components/common/SkeletonLoaders';
import { Timeline } from '@/components/common/Timeline';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ContractStatusBadge, PaymentStatusBadge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { useTenantDetail } from '@/hooks/useTenants';
import { formatCDF, formatPhone, formatDate, getInitials } from '@/lib/utils';
import { ROUTES } from '@/config/routes';
import type { DataTableColumn } from '@/types';

const NOTES_KEY_PREFIX = 'eloyer_tenant_notes_';

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useTenantDetail(id);
  const [notes, setNotes] = useState(() => {
    if (!id) return '';
    return localStorage.getItem(`${NOTES_KEY_PREFIX}${id}`) ?? '';
  });

  if (isLoading) return <DetailPageSkeleton />;

  if (error || !data?.contract) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-destructive)]">{error?.message ?? 'Locataire introuvable'}</p>
        <Button className="mt-4" onClick={() => refetch()}>Réessayer</Button>
      </div>
    );
  }

  const { contract, payments } = data;
  const locataire = contract.locataire as {
    full_name: string;
    phone: string;
    email: string | null;
    avatar_url: string | null;
    commune: string | null;
  };
  const logement = contract.logement as {
    code: string;
    address: string;
    commune: string;
    type: string;
    rooms: number | null;
  };

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

  const timelineItems = payments.slice(0, 5).map((p) => ({
    id: p.id,
    title: `Paiement ${p.periode}`,
    description: formatCDF(Number(p.montant)),
    timestamp: p.paid_at ? formatDate(p.paid_at) : undefined,
    status: p.status === 'complete' ? 'completed' as const : 'upcoming' as const,
  }));

  const saveNotes = () => {
    if (id) localStorage.setItem(`${NOTES_KEY_PREFIX}${id}`, notes);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.BAILLEUR.TENANTS)} aria-label="Retour">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title={locataire.full_name} subtitle="Profil locataire" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="p-6 text-center">
            {locataire.avatar_url ? (
              <img src={locataire.avatar_url} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-kinshasa-blue)] text-2xl text-white">
                {getInitials(locataire.full_name)}
              </div>
            )}
            <h2 className="mt-4 text-xl font-bold">{locataire.full_name}</h2>
            <p className="text-sm text-[var(--color-muted-foreground)]">{formatPhone(locataire.phone)}</p>
            {locataire.email && <p className="text-sm text-[var(--color-muted-foreground)]">{locataire.email}</p>}
            {locataire.commune && <p className="mt-1 text-sm">{locataire.commune}</p>}

            <div className="mt-4 flex justify-center gap-2">
              <a href={`tel:${locataire.phone}`}>
                <Button variant="outline" size="sm" leftIcon={<Phone className="h-4 w-4" />}>Appeler</Button>
              </a>
              <a href={`sms:${locataire.phone}`}>
                <Button variant="outline" size="sm" leftIcon={<MessageCircle className="h-4 w-4" />}>SMS</Button>
              </a>
              <a href={`https://wa.me/${locataire.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">WhatsApp</Button>
              </a>
              {locataire.email && (
                <a href={`mailto:${locataire.email}`}>
                  <Button variant="outline" size="sm" leftIcon={<Mail className="h-4 w-4" />} />
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contrat actuel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono">{contract.code}</span>
                <ContractStatusBadge status={contract.status} />
              </div>
              <p>{logement.type} {logement.rooms ? `${logement.rooms} pièces` : ''} — {logement.address}</p>
              <p className="font-mono text-xs text-[var(--color-muted-foreground)]">{logement.code}</p>
              <p>Période: {formatDate(contract.date_debut)} — {contract.date_fin ? formatDate(contract.date_fin) : 'En cours'}</p>
              <p className="text-lg font-bold text-[var(--color-kinshasa-gold)]">
                {formatCDF(Number(contract.loyer_mensuel))}/mois
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique des paiements</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={paymentColumns}
                data={payments as unknown as Record<string, unknown>[]}
                emptyTitle="Aucun paiement"
                pageSize={10}
              />
            </CardContent>
          </Card>

          {timelineItems.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Activité récente</CardTitle></CardHeader>
              <CardContent>
                <Timeline items={timelineItems} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Notes privées</CardTitle></CardHeader>
            <CardContent>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Notes visibles uniquement par vous..."
                className="w-full rounded-lg border border-[var(--color-border)] p-3 text-sm"
              />
              <Button className="mt-2" size="sm" onClick={saveNotes}>Enregistrer les notes</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
