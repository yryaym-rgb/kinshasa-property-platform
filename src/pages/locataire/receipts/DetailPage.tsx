import { useParams, Link } from 'react-router-dom';
import { Download, Mail, MessageCircle, Printer, Shield } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { DetailPageSkeleton } from '@/components/common/SkeletonLoaders';
import { ReceiptPreview } from '@/components/payments/ReceiptPreview';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { receiptService } from '@/services/receipt/receiptService';
import { taxService } from '@/services/tax/taxService';
import type { TaxCalculationResult } from '@/services/tax/taxService';
import { ROUTES } from '@/config/routes';

export function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useSupabaseQuery({
    queryKey: ['receipt-detail', id],
    queryFn: async () => {
      if (!id) throw new Error('Reçu introuvable');
      const receipt = await receiptService.getReceiptById(id);
      if (!receipt) throw new Error('Reçu introuvable');
      return receipt;
    },
    enabled: !!id,
  });

  if (isLoading) return <DetailPageSkeleton />;

  if (error || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-destructive)]">{error?.message ?? 'Reçu introuvable'}</p>
        <Button className="mt-4" onClick={() => refetch()}>Réessayer</Button>
      </div>
    );
  }

  const paiement = data.paiement;
  const logement = data.contrat?.logement as { type?: string; rooms?: number | null } | undefined;
  const taxCalc = (data.metadata as { tax_calculation?: TaxCalculationResult })?.tax_calculation
    ?? (paiement?.tax_calculation as unknown as TaxCalculationResult)
    ?? taxService.calculateTax({ rentAmount: Number(paiement?.montant ?? data.montant), paymentMethod: 'mobile_money' });

  const propertyLabel = logement
    ? `${logement.type}${logement.rooms ? ` ${logement.rooms} pièces` : ''}`
    : 'Logement';

  const shareWhatsApp = () => {
    const text = `Reçu eLoyer ${data.code} — ${data.montant} ${data.currency}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const shareEmail = () => {
    window.open(`mailto:?subject=Reçu eLoyer ${data.code}&body=Voici mon reçu de paiement: ${data.code}`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={`Reçu ${data.code}`} subtitle="Détail du reçu de paiement" />

      <ReceiptPreview
        data={{
          code: data.code,
          issuedAt: data.issued_at,
          tenantName: user?.full_name ?? 'Locataire',
          propertyLabel,
          breakdown: taxCalc,
          paymentMethod: paiement?.provider ?? paiement?.method ?? '—',
          providerReference: paiement?.provider_transaction_id ?? undefined,
          paymentReference: paiement?.reference,
        }}
        showQr
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Button variant="outline" onClick={shareWhatsApp} className="flex-col gap-1 h-auto py-3">
          <MessageCircle className="h-5 w-5" />
          <span className="text-xs">WhatsApp</span>
        </Button>
        <Button variant="outline" onClick={shareEmail} className="flex-col gap-1 h-auto py-3">
          <Mail className="h-5 w-5" />
          <span className="text-xs">E-mail</span>
        </Button>
        <Button variant="outline" onClick={() => receiptService.downloadReceiptPdf(data.id)} className="flex-col gap-1 h-auto py-3">
          <Download className="h-5 w-5" />
          <span className="text-xs">PDF</span>
        </Button>
        <Button variant="outline" onClick={handlePrint} className="flex-col gap-1 h-auto py-3">
          <Printer className="h-5 w-5" />
          <span className="text-xs">Imprimer</span>
        </Button>
      </div>

      <a
        href={`/verifier/recu/${data.code}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <Button variant="secondary" className="w-full" leftIcon={<Shield className="h-4 w-4" />}>
          Vérifier l&apos;authenticité
        </Button>
      </a>

      <Link to={ROUTES.LOCATAIRE.RECEIPTS}>
        <Button variant="ghost" className="w-full">← Retour aux reçus</Button>
      </Link>
    </div>
  );
}
