import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { SupportModal, useSupportModal } from '@/components/common/SupportModal';
import { Button } from '@/components/ui/Button';
import { getFailureMessage } from '@/services/payment/types';
import { ROUTES } from '@/config/routes';

export function FailedPage() {
  const [params] = useSearchParams();
  const reason = params.get('reason');
  const paymentId = params.get('id');
  const { open, openSupport, closeSupport } = useSupportModal();

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="flex justify-center"
      >
        <XCircle className="h-20 w-20 text-[var(--color-destructive)]" />
      </motion.div>

      <PageHeader title="Paiement échoué" />

      <p className="text-[var(--color-muted-foreground)]">{getFailureMessage(reason)}</p>

      {paymentId && (
        <p className="font-mono text-sm text-[var(--color-muted-foreground)]">
          Référence : {paymentId.slice(0, 8).toUpperCase()}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Link to={ROUTES.LOCATAIRE.PAYMENT_NEW}>
          <Button size="lg" className="w-full">Réessayer</Button>
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
