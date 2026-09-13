import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
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

export function SuccessPage() {
  const [params] = useSearchParams();
  const paymentId = params.get('id');
  const { user } = useAuth();

  const { data, isLoading } = useSupabaseQuery({
    queryKey: ['payment-success', paymentId],
    queryFn: async () => {
      if (!paymentId) throw new Error('Paiement introuvable');
      const receipt = await receiptService.getReceiptByPaymentId(paymentId);
      return receipt;
    },
    enabled: !!paymentId,
  });

  useEffect(() => {
    if (data && user?.email) {
      void receiptService.sendReceiptEmail(data.id, user.email);
    }
  }, [data, user?.email]);

  if (isLoading) return <DetailPageSkeleton />;
  if (!data) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-destructive)]">Reçu introuvable</p>
        <Link to={ROUTES.LOCATAIRE.HOME}><Button className="mt-4">Retour à l&apos;accueil</Button></Link>
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

  return (
    <div className="mx-auto max-w-lg space-y-6">
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

      <ReceiptPreview
        data={{
          code: data.code,
          issuedAt: data.issued_at,
          tenantName: user?.full_name ?? 'Locataire',
          propertyLabel,
          breakdown: taxCalc,
          paymentMethod: paiement?.provider ?? paiement?.method ?? 'Mobile Money',
          providerReference: paiement?.provider_transaction_id ?? undefined,
          paymentReference: paiement?.reference,
        }}
      />

      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          className="w-full"
          onClick={() => receiptService.downloadReceiptPdf(data.id)}
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
