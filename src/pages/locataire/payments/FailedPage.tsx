import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { SupportModal, useSupportModal } from '@/components/common/SupportModal';
import { Button } from '@/components/ui/Button';
import { getPaymentErrorMessage, isRetryableError, normalizeErrorCode } from '@/utils/paymentErrors';
import { ROUTES } from '@/config/routes';

export function FailedPage() {
  const [params] = useSearchParams();
  const reason = params.get('reason');
  const paymentId = params.get('id');
  const { open, openSupport, closeSupport } = useSupportModal();
  const code = normalizeErrorCode(reason);
  const retryable = isRetryableError(code) || code === 'user_cancelled' || code === 'insufficient_funds' || code === 'payment_expired';

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center" data-testid="payment-failed" data-reason={code}>
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="flex justify-center"
      >
        <XCircle className="h-20 w-20 text-[var(--color-destructive)]" />
      </motion.div>

      <PageHeader title={code === 'user_cancelled' ? 'Paiement annulé' : code === 'payment_expired' || code === 'provider_timeout' ? 'Paiement expiré' : 'Paiement échoué'} />

      <p className="text-[var(--color-muted-foreground)]" role="alert">{getPaymentErrorMessage(code)}</p>

      {paymentId && (
        <p className="font-mono text-sm text-[var(--color-muted-foreground)]">
          Référence : {paymentId.slice(0, 8).toUpperCase()}
        </p>
      )}

      <p className="text-xs text-[var(--color-muted-foreground)]">
        Aucun montant n’a été débité. Si votre opérateur vous a envoyé une confirmation, le paiement sera automatiquement rattaché à votre compte.
      </p>

      <div className="flex flex-col gap-3">
        <Link to={ROUTES.LOCATAIRE.PAYMENT_NEW}>
          <Button size="lg" className="w-full">{retryable ? 'Réessayer' : 'Nouveau paiement'}</Button>
        </Link>
        <Button variant="outline" size="lg" className="w-full" onClick={openSupport}>
          Contacter le support
        </Button>
        <Link to={ROUTES.LOCATAIRE.HOME}>
          <Button variant="ghost" size="lg" className="w-full">Retour à l&apos;accueil</Button>
        </Link>
      </div>

      <SupportModal open={open} onClose={closeSupport} />
    </div>
  );
}
