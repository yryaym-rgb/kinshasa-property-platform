import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Download, Edit, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { DetailPageSkeleton } from '@/components/common/SkeletonLoaders';
import { ContactSheet } from '@/components/common/ContactSheet';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ContractStatusBadge } from '@/components/ui/Badge';
import { PaymentStatusBadge } from '@/components/payments/PaymentStatusBadge';
import { DataTable } from '@/components/ui/DataTable';
import { useTenantContractDetail } from '@/hooks/useTenantContracts';
import { formatCDF, formatDate, formatPhone } from '@/lib/utils';
import { ROUTES } from '@/config/routes';
import type { DataTableColumn } from '@/types';

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useTenantContractDetail(id);
  const [contactOpen, setContactOpen] = useState(false);
  const [showModifyForm, setShowModifyForm] = useState(false);
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [formMessage, setFormMessage] = useState('');

  if (isLoading) return <DetailPageSkeleton />;

  if (error || !data?.contract) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-destructive)]">{error?.message ?? 'Contrat introuvable'}</p>
        <Button className="mt-4" onClick={() => refetch()}>Réessayer</Button>
      </div>
    );
  }

  const { contract, payments } = data;
  const logement = contract.logement as {
    code: string; address: string; commune: string; type: string; rooms: number | null;
  };
  const bailleur = contract.bailleur as {
    business_name: string | null;
    user?: { full_name: string; phone: string; email?: string };
  };
  const bailleurName = bailleur?.user?.full_name ?? bailleur?.business_name ?? 'Bailleur';

  const paymentColumns: DataTableColumn<Record<string, unknown>>[] = [
    { key: 'periode', header: 'Période' },
    { key: 'montant', header: 'Montant', render: (row) => formatCDF(Number(row.montant)) },
    { key: 'status', header: 'Statut', render: (row) => <PaymentStatusBadge status={row.status as string} /> },
    { key: 'paid_at', header: 'Date', render: (row) => row.paid_at ? formatDate(row.paid_at as string) : '—' },
  ];

  const terms = (contract.terms as Record<string, string>) ?? {};

  const handleFormSubmit = (type: 'modify' | 'problem') => {
    const subject = type === 'modify' ? 'Demande de modification de contrat' : 'Signalement de problème';
    window.open(`mailto:${bailleur?.user?.email ?? 'support@eloyer.cd'}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(formMessage)}`);
    setFormMessage('');
    setShowModifyForm(false);
    setShowProblemForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(ROUTES.LOCATAIRE.CONTRACTS)} className="rounded-lg p-2 hover:bg-[var(--color-muted)]">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <PageHeader title={`Contrat ${contract.code}`} />
        <ContractStatusBadge status={contract.status} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Bailleur</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{bailleurName}</p>
            {bailleur?.user?.phone && (
              <div className="flex items-center gap-2">
                <span className="text-sm">{formatPhone(bailleur.user.phone)}</span>
                <button type="button" onClick={() => setContactOpen(true)} className="rounded-full bg-[var(--color-muted)] p-1.5">
                  <Phone className="h-4 w-4 text-[var(--color-kinshasa-blue)]" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Logement</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <p className="font-medium">{logement?.type}{logement?.rooms ? ` ${logement.rooms} pièces` : ''}</p>
            <p className="text-sm">{logement?.address}, {logement?.commune}</p>
            <p className="font-mono text-xs text-[var(--color-muted-foreground)]">{logement?.code}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Conditions du contrat</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-[var(--color-border)]">
                <td className="py-2 text-[var(--color-muted-foreground)]">Loyer mensuel</td>
                <td className="py-2 text-right font-medium">{formatCDF(Number(contract.loyer_mensuel))}</td>
              </tr>
              <tr className="border-b border-[var(--color-border)]">
                <td className="py-2 text-[var(--color-muted-foreground)]">Dépôt de garantie</td>
                <td className="py-2 text-right">{contract.depot_garantie ? formatCDF(Number(contract.depot_garantie)) : '—'}</td>
              </tr>
              <tr className="border-b border-[var(--color-border)]">
                <td className="py-2 text-[var(--color-muted-foreground)]">Date de début</td>
                <td className="py-2 text-right">{formatDate(contract.date_debut)}</td>
              </tr>
              <tr className="border-b border-[var(--color-border)]">
                <td className="py-2 text-[var(--color-muted-foreground)]">Date de fin</td>
                <td className="py-2 text-right">{contract.date_fin ? formatDate(contract.date_fin) : '—'}</td>
              </tr>
              <tr>
                <td className="py-2 text-[var(--color-muted-foreground)]">Jour de paiement</td>
                <td className="py-2 text-right">Le {contract.payment_day} de chaque mois</td>
              </tr>
              {Object.entries(terms).map(([key, value]) => (
                <tr key={key} className="border-t border-[var(--color-border)]">
                  <td className="py-2 text-[var(--color-muted-foreground)]">{key}</td>
                  <td className="py-2 text-right">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historique des paiements</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={paymentColumns}
            data={payments as Record<string, unknown>[]}
            emptyTitle="Aucun paiement pour ce contrat"
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" leftIcon={<Download className="h-4 w-4" />}>
          Télécharger le contrat PDF
        </Button>
        <Button variant="outline" leftIcon={<Edit className="h-4 w-4" />} onClick={() => setShowModifyForm(true)}>
          Demander une modification
        </Button>
        <Button variant="outline" leftIcon={<AlertTriangle className="h-4 w-4" />} onClick={() => setShowProblemForm(true)}>
          Signaler un problème
        </Button>
      </div>

      {(showModifyForm || showProblemForm) && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <textarea
              value={formMessage}
              onChange={(e) => setFormMessage(e.target.value)}
              rows={4}
              placeholder={showModifyForm ? 'Décrivez la modification souhaitée...' : 'Décrivez le problème...'}
              className="w-full rounded-lg border border-[var(--color-border)] p-3 text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={() => handleFormSubmit(showModifyForm ? 'modify' : 'problem')}>Envoyer</Button>
              <Button variant="ghost" onClick={() => { setShowModifyForm(false); setShowProblemForm(false); }}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ContactSheet
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        name={bailleurName}
        phone={bailleur?.user?.phone ?? ''}
      />
    </div>
  );
}
