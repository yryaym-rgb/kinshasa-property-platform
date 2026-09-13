import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Download,
  FileText,
  Mail,
  MessageSquare,
  MoreVertical,
  Phone,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { DetailPageSkeleton } from '@/components/common/SkeletonLoaders';
import { ContractStatusBadge } from '@/components/contracts/ContractStatusBadge';
import { ContractTimeline, buildContractTimeline } from '@/components/contracts/ContractTimeline';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { PaymentStatusBadge } from '@/components/ui/Badge';
import { FileUpload } from '@/components/ui/FileUpload';
import { useContract } from '@/hooks/useContract';
import {
  useTerminateContract,
  useSendContractInvitation,
  useUpdateContract,
} from '@/hooks/useContracts';
import {
  formatCurrency,
  formatDate,
  formatPhone,
  getInitials,
  normalizePhone,
} from '@/lib/utils';
import { getContractTerms, getPaymentFrequencyLabel } from '@/utils/contractUtils';
import { ROUTES } from '@/config/routes';
import type { DataTableColumn } from '@/types';
import type { Paiement } from '@/types/database.types';

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contract, loading, error, refetch } = useContract(id);
  const terminateMutation = useTerminateContract();
  const sendMutation = useSendContractInvitation();
  const updateMutation = useUpdateContract(id);

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateReason, setTerminateReason] = useState('');
  const [notes, setNotes] = useState('');
  const [conditionsExpanded, setConditionsExpanded] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);

  if (loading) return <DetailPageSkeleton />;

  if (error || !contract) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-destructive)]">{error?.message ?? 'Contrat introuvable'}</p>
        <Button className="mt-4" onClick={() => refetch()}>Réessayer</Button>
      </div>
    );
  }

  const terms = getContractTerms(contract);
  const timelineEvents = buildContractTimeline(contract);
  const payments = contract.paiements ?? [];

  const totalPaid = payments
    .filter((p) => p.status === 'complete')
    .reduce((sum, p) => sum + Number(p.montant), 0);
  const totalExpected = Number(contract.loyer_mensuel) * Math.max(payments.length, 1);
  const balance = totalExpected - totalPaid;

  const canEdit =
    contract.status === 'brouillon' ||
    (contract.status === 'actif' && payments.filter((p) => p.status === 'complete').length === 0);

  const handleTerminate = async () => {
    if (!id || !terminateReason) return;
    await terminateMutation.mutateAsync({ id, reason: terminateReason });
    setTerminateOpen(false);
    refetch();
  };

  const handleSaveNotes = async () => {
    await updateMutation.mutateAsync({ notesInternes: notes });
    setNotesDirty(false);
  };

  const paymentColumns: DataTableColumn<Paiement>[] = [
    {
      key: 'periode',
      header: 'Période',
      render: (row) => row.periode,
    },
    {
      key: 'montant',
      header: 'Montant',
      render: (row) => formatCurrency(Number(row.montant), row.currency as 'CDF' | 'USD'),
    },
    {
      key: 'method',
      header: 'Méthode',
      render: (row) => row.method,
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => <PaymentStatusBadge status={row.status} />,
    },
    {
      key: 'paid_at',
      header: 'Date',
      render: (row) => (row.paid_at ? formatDate(row.paid_at) : '—'),
    },
  ];

  const contactButtons = (phone: string, name: string) => {
    const normalized = normalizePhone(phone);
    const waPhone = normalized.replace('+', '');
    const linkClass =
      'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-muted)]';
    return (
      <div className="mt-3 flex gap-2">
        <a href={`tel:${normalized}`} className={linkClass} aria-label={`Appeler ${name}`}>
          <Phone className="h-4 w-4" />
        </a>
        <a href={`sms:${normalized}`} className={linkClass} aria-label={`SMS ${name}`}>
          <MessageSquare className="h-4 w-4" />
        </a>
        <a
          href={`https://wa.me/${waPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          aria-label={`WhatsApp ${name}`}
        >
          <Mail className="h-4 w-4" />
        </a>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={contract.code}
        subtitle={`Contrat de bail — ${contract.logement?.address ?? ''}`}
        showBack
        onBack={() => navigate(ROUTES.BAILLEUR.CONTRACTS)}
        actions={
          <div className="flex items-center gap-2">
            <ContractStatusBadge status={contract.status} />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                  Actions
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="z-50 min-w-[200px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-lg">
                  <DropdownMenu.Item
                    className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
                    onSelect={() => contract.pdf_url && window.open(contract.pdf_url, '_blank')}
                  >
                    <Download className="mr-2 inline h-4 w-4" />
                    Télécharger PDF
                  </DropdownMenu.Item>
                  {canEdit && (
                    <DropdownMenu.Item
                      className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
                      onSelect={() =>
                        navigate(ROUTES.BAILLEUR.CONTRACT_EDIT.replace(':id', contract.id))
                      }
                    >
                      Modifier
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Item
                    className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
                    onSelect={() => sendMutation.mutate(contract.id)}
                  >
                    Envoyer un rappel
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
                    onSelect={() =>
                      navigate(`${ROUTES.BAILLEUR.CONTRACT_NEW}?renewFrom=${contract.id}`)
                    }
                  >
                    Renouveler
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />
                  <DropdownMenu.Item
                    className="cursor-pointer rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    onSelect={() => setTerminateOpen(true)}
                  >
                    Résilier
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bailleur</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {contract.bailleur?.user?.full_name ?? contract.bailleur?.business_name ?? '—'}
            </p>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {contract.bailleur?.user?.phone ? formatPhone(contract.bailleur.user.phone) : '—'}
            </p>
            {contract.bailleur?.user?.email && (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {contract.bailleur.user.email}
              </p>
            )}
            {contract.bailleur?.tax_id && (
              <p className="text-sm">NIF : {contract.bailleur.tax_id}</p>
            )}
            {contract.bailleur?.user?.phone &&
              contactButtons(contract.bailleur.user.phone, contract.bailleur.user.full_name)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Locataire</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {contract.locataire?.avatar_url ? (
                <img
                  src={contract.locataire.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-kinshasa-blue)] text-white">
                  {getInitials(contract.locataire?.full_name ?? '?')}
                </div>
              )}
              <div>
                <p className="font-medium">{contract.locataire?.full_name ?? '—'}</p>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {contract.locataire?.phone ? formatPhone(contract.locataire.phone) : '—'}
                </p>
              </div>
            </div>
            {contract.locataire?.email && (
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                {contract.locataire.email}
              </p>
            )}
            <p className="mt-1 text-xs">
              Pièce d&apos;identité :{' '}
              <span
                className={
                  contract.locataire?.kyc_status === 'verified'
                    ? 'text-green-600'
                    : 'text-amber-600'
                }
              >
                {contract.locataire?.kyc_status === 'verified' ? 'Vérifiée' : 'En attente'}
              </span>
            </p>
            {contract.locataire?.phone &&
              contactButtons(contract.locataire.phone, contract.locataire.full_name)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Logement</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate(ROUTES.BAILLEUR.PROPERTY_DETAIL.replace(':id', contract.logement_id))
            }
          >
            Voir le détail
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {contract.logement?.photos?.[0] && (
              <img
                src={contract.logement.photos[0]}
                alt=""
                className="h-20 w-28 rounded-lg object-cover"
              />
            )}
            <div>
              <p className="font-mono text-sm">{contract.logement?.code}</p>
              <p className="font-medium">{contract.logement?.address}</p>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {contract.logement?.commune}
              </p>
              <p className="mt-1 font-bold">
                {formatCurrency(
                  Number(contract.logement?.loyer_mensuel ?? contract.loyer_mensuel),
                  contract.currency as 'CDF' | 'USD',
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Termes du contrat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="py-2 font-medium">Date de début</td>
                  <td className="py-2">{formatDate(contract.date_debut)}</td>
                  <td className="py-2 font-medium">Date de fin</td>
                  <td className="py-2">
                    {contract.date_fin ? formatDate(contract.date_fin) : '—'}
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="py-2 font-medium">Loyer mensuel</td>
                  <td className="py-2 font-bold">
                    {formatCurrency(Number(contract.loyer_mensuel), contract.currency as 'CDF' | 'USD')}
                  </td>
                  <td className="py-2 font-medium">Charges</td>
                  <td className="py-2">
                    {formatCurrency(terms.chargesMensuelles ?? 0, contract.currency as 'CDF' | 'USD')}
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="py-2 font-medium">Dépôt de garantie</td>
                  <td className="py-2">
                    {formatCurrency(
                      Number(contract.depot_garantie ?? 0),
                      contract.currency as 'CDF' | 'USD',
                    )}
                  </td>
                  <td className="py-2 font-medium">Fréquence</td>
                  <td className="py-2">
                    {getPaymentFrequencyLabel(terms.paymentFrequency ?? 'mensuel')}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-medium">Jour d&apos;échéance</td>
                  <td className="py-2" colSpan={3}>Le {contract.payment_day} de chaque mois</td>
                </tr>
              </tbody>
            </table>
          </div>
          {terms.conditionsParticulieres && (
            <div className="mt-4">
              <button
                type="button"
                className="text-sm font-medium text-[var(--color-kinshasa-blue)]"
                onClick={() => setConditionsExpanded(!conditionsExpanded)}
              >
                Conditions particulières {conditionsExpanded ? '▲' : '▼'}
              </button>
              {conditionsExpanded && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-muted-foreground)]">
                  {terms.conditionsParticulieres}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Historique des paiements</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(ROUTES.BAILLEUR.PAYMENTS)}
          >
            Voir tous les paiements
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <StatCard label="Total payé" value={formatCurrency(totalPaid, contract.currency as 'CDF' | 'USD')} />
            <StatCard label="Total attendu" value={formatCurrency(totalExpected, contract.currency as 'CDF' | 'USD')} />
            <StatCard
              label="Solde"
              value={formatCurrency(balance, contract.currency as 'CDF' | 'USD')}
              highlight={balance > 0}
            />
          </div>
          <DataTable
            columns={paymentColumns as unknown as DataTableColumn<Record<string, unknown>>[]}
            data={payments as unknown as Record<string, unknown>[]}
            emptyTitle="Aucun paiement"
            emptyDescription="Les paiements apparaîtront ici une fois enregistrés."
            getRowId={(row) => String(row.id)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contract.pdf_url ? (
            <a
              href={contract.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] p-3 hover:bg-[var(--color-muted)]"
            >
              <FileText className="h-5 w-5 text-[var(--color-kinshasa-blue)]" />
              <span>Contrat PDF — {contract.code}</span>
              <Download className="ml-auto h-4 w-4" />
            </a>
          ) : (
            <p className="text-sm text-[var(--color-muted-foreground)]">PDF non généré</p>
          )}
          {terms.addendums?.map((doc, i) => (
            <a
              key={i}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] p-3 hover:bg-[var(--color-muted)]"
            >
              <FileText className="h-5 w-5" />
              <span>{doc.name}</span>
              <Download className="ml-auto h-4 w-4" />
            </a>
          ))}
          <FileUpload
            label="Ajouter un document"
            accept="pdf"
            folder={`contracts/${contract.id}`}
            onUpload={() => refetch()}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chronologie</CardTitle>
          </CardHeader>
          <CardContent>
            <ContractTimeline events={timelineEvents} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes internes</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="min-h-[120px] w-full rounded-lg border border-[var(--color-input)] p-3 text-sm"
              placeholder="Notes privées visibles uniquement par vous..."
              value={notes || contract.notes_internes || ''}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesDirty(true);
              }}
            />
            <Button
              className="mt-3"
              size="sm"
              disabled={!notesDirty}
              onClick={() => void handleSaveNotes()}
            >
              Enregistrer
            </Button>
          </CardContent>
        </Card>
      </div>

      <Modal
        open={terminateOpen}
        onOpenChange={setTerminateOpen}
        title="Résilier le contrat"
        description="Cette action est irréversible. Le logement sera remis en statut disponible."
      >
        <div className="space-y-4 p-4">
          <Input
            label="Motif de résiliation"
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
            placeholder="Indiquez la raison de la résiliation..."
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTerminateOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={terminateReason.length < 5}
              onClick={() => void handleTerminate()}
            >
              Confirmer la résiliation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
