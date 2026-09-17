import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { DetailPageSkeleton } from '@/components/common/SkeletonLoaders';
import { ReceiptPreview } from '@/components/payments/ReceiptPreview';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';
import { receiptService } from '@/services/receipt/receiptService';
import { estimateBreakdown, type TaxBreakdown } from '@/services/tax/taxService';
import { paymentService } from '@/services/payment/paymentService';
import { ROUTES } from '@/config/routes';

export function SuccessPage() {
  const [params] = useSearchParams();
  const paymentId = params.get('id');
  const { user } = useAuth();

  // Realtime: the receipt / authoritative tax appear when the pipeline finishes.
  const { snapshot } = usePaymentStatus(paymentId, { timeoutMs: 120_000 });
  const receiptReady = Boolean(snapshot?.receiptId);

  const { data, isLoading } = useSupabaseQuery({
    queryKey: ['payment-success', paymentId, snapshot?.receiptId ?? 'pending'],
    queryFn: async () => {
      if (!paymentId) throw new Error('Paiement introuvable');
      const [receipt, payment] = await Promise.all([
        receiptService.waitForReceipt(paymentId, { attempts: receiptReady ? 1 : 4, intervalMs: 1500 }),
        paymentService.getPaymentById(paymentId),
      ]);
      return { receipt, payment };
    },
    enabled: !!paymentId,
  });

  useEffect(() => {
    if (data?.receipt && user?.email) {
      void receiptService.sendReceiptEmail(data.receipt.id, user.email);
    }
  }, [data?.receipt, user?.email]);

  if (isLoading && !data) return <DetailPageSkeleton />;
  if (!data?.payment) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-destructive)]">Paiement introuvable</p>
        <Link to={ROUTES.LOCATAIRE.HOME}><Button className="mt-4">Retour à l&apos;accueil</Button></Link>
      </div>
    );
  }

  const { receipt, payment } = data;
  const logement = receipt?.contrat?.logement as { type?: string; rooms?: number | null } | undefined;
  const authoritative = (receipt?.metadata as { tax_calculation?: TaxBreakdown } | null)?.tax_calculation
    ?? (payment.tax_calculation as unknown as TaxBreakdown | null);
  const taxCalc: TaxBreakdown = authoritative
    ?? { ...estimateBreakdown({ rentAmount: Number(payment.montant), paymentMethod: 'mobile_money' }), estimated: true };

  const propertyLabel = logement
    ? `${logement.type}${logement.rooms ? ` ${logement.rooms} pièces` : ''}`
    : 'Logement';

  return (
    <div className="mx-auto max-w-lg space-y-6" data-testid="payment-success">
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        >
          <CheckCircle className="h-20 w-20 text-[var(--color-success)]" />
        </motion.div>
        <PageHeader
          title="Votre paiement a été enregistré avec succès !"
          className="mt-4"
        />
      </div>

      {receipt ? (
        <ReceiptPreview
          data={{
            code: receipt.code,
            issuedAt: receipt.issued_at,
            tenantName: user?.full_name ?? 'Locataire',
            propertyLabel,
            breakdown: taxCalc,
            paymentMethod: payment.provider ?? payment.method ?? 'Mobile Money',
            providerReference: payment.provider_transaction_id ?? undefined,
            paymentReference: payment.reference,
          }}
        />
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-muted-foreground)]" role="status">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Votre reçu est en cours de génération (calcul de l’impôt, répartition, archivage). Il apparaîtra ici dans quelques secondes.
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          className="w-full"
          disabled={!receipt}
          onClick={() => receipt && receiptService.downloadReceiptPdf(receipt.id)}
        >
          Télécharger le reçu PDF
        </Button>
        <Link to={ROUTES.LOCATAIRE.RECEIPTS}>
          <Button variant="outline" size="lg" className="w-full">Voir tous mes reçus</Button>
        </Link>
        <Link to={ROUTES.LOCATAIRE.HOME}>
          <Button variant="ghost" size="lg" className="w-full">Retour à l&apos;accueil</Button>
        </Link>
      </div>
    </div>
  );
}
