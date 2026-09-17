import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Loader2, Smartphone, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';
import { PAYMENT_STATE_LABELS, type PaymentState } from '@/services/payment/stateMachine';
import type { PipelineStatus } from '@/types/payment';
import { getPaymentErrorMessage } from '@/utils/paymentErrors';
import { cn } from '@/lib/utils';

interface PaymentProcessingProps {
  paymentId: string;
  providerName?: string;
  providerMessage?: string;
  onTerminal: (paymentId: string, state: PaymentState, failureReason: string | null) => void;
  /** Delay before navigating away on success so the user sees the confirmation (ms). */
  successDelayMs?: number;
}

const FLOW: Array<{ states: PaymentState[]; label: string }> = [
  { states: ['validating'], label: 'Vérification du contrat et du montant' },
  { states: ['pending'], label: 'Demande envoyée à l’opérateur' },
  { states: ['processing', 'requires_action'], label: 'Confirmation sur votre téléphone' },
  { states: ['succeeded'], label: 'Paiement confirmé' },
];

const ORDER: PaymentState[] = ['draft', 'validating', 'pending', 'processing', 'requires_action', 'succeeded'];

function stepStatus(step: (typeof FLOW)[number], current: PaymentState | null): 'done' | 'active' | 'todo' {
  if (!current) return 'todo';
  const currentIdx = ORDER.indexOf(current);
  const stepIdx = Math.max(...step.states.map((s) => ORDER.indexOf(s)));
  if (current === 'succeeded') return 'done';
  if (step.states.includes(current)) return 'active';
  return currentIdx > stepIdx ? 'done' : 'todo';
}

const PIPELINE_LABELS: Record<keyof PipelineStatus, string> = {
  tax: 'Impôt calculé',
  ledger: 'Répartition bailleur / DGI',
  receipt: 'Reçu généré',
  notifications: 'Notifications envoyées',
  compliance: 'Score de conformité mis à jour',
  audit: 'Journal d’audit',
};

export function PaymentProcessing({ paymentId, providerName, providerMessage, onTerminal, successDelayMs = 1200 }: PaymentProcessingProps) {
  const { snapshot, state, isTerminal, isSuccess, error, realtimeConnected, elapsedSeconds, cancel, refresh } = usePaymentStatus(paymentId);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!snapshot || !isTerminal) return;
    const t = setTimeout(() => onTerminal(paymentId, snapshot.state, snapshot.failureReason), isSuccess ? successDelayMs : 600);
    return () => clearTimeout(t);
  }, [snapshot, isTerminal, isSuccess, onTerminal, paymentId, successDelayMs]);

  const canCancel = state === 'pending' || state === 'requires_action' || state === 'validating';

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancel('Annulé depuis l’écran de paiement');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-6 text-center" data-testid="payment-processing" data-state={state ?? 'loading'}>
      <motion.div
        animate={isSuccess ? { scale: [1, 1.15, 1] } : { scale: [1, 1.08, 1], opacity: [0.75, 1, 0.75] }}
        transition={{ repeat: isSuccess ? 0 : Infinity, duration: 1.6 }}
        className={cn('flex h-20 w-20 items-center justify-center rounded-full', isSuccess ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-[var(--color-kinshasa-blue)]')}
      >
        {isSuccess ? <CheckCircle2 className="h-10 w-10" /> : state === 'requires_action' || state === 'processing' ? <Smartphone className="h-9 w-9" /> : <Loader2 className="h-9 w-9 animate-spin" />}
      </motion.div>

      <div className="space-y-1">
        <p className="text-lg font-semibold">
          {isSuccess ? 'Paiement confirmé' : state === 'failed' || state === 'cancelled' || state === 'expired' ? PAYMENT_STATE_LABELS[state] : 'Traitement en cours…'}
        </p>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {isTerminal && !isSuccess && snapshot
            ? getPaymentErrorMessage(snapshot.failureReason)
            : providerMessage ?? (providerName ? `Confirmez le paiement ${providerName} sur votre téléphone.` : 'Confirmez le paiement sur votre téléphone.')}
        </p>
      </div>

      <ol className="w-full space-y-2 text-left" aria-label="Étapes du paiement">
        {FLOW.map((step) => {
          const status = stepStatus(step, state);
          return (
            <li key={step.label} className="flex items-center gap-3 text-sm">
              {status === 'done' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
              ) : status === 'active' ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--color-kinshasa-blue)]" aria-hidden="true" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-[var(--color-border)]" aria-hidden="true" />
              )}
              <span className={cn(status === 'todo' && 'text-[var(--color-muted-foreground)]', status === 'active' && 'font-medium')}>{step.label}</span>
            </li>
          );
        })}
      </ol>

      {isSuccess && snapshot && Object.keys(snapshot.pipeline).length > 0 && (
        <ul className="w-full space-y-1 rounded-lg border border-[var(--color-border)] p-3 text-left text-xs" aria-label="Traitements après paiement">
          {(Object.keys(PIPELINE_LABELS) as Array<keyof PipelineStatus>).map((key) => {
            const s = snapshot.pipeline[key];
            if (!s) return null;
            return (
              <li key={key} className="flex items-center justify-between">
                <span>{PIPELINE_LABELS[key]}</span>
                <Badge variant={s.status === 'done' ? 'success' : s.status === 'queued' || s.status === 'failed' ? 'warning' : 'neutral'}>
                  {s.status === 'done' ? 'OK' : s.status === 'queued' ? 'En file' : s.status}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex w-full items-center justify-between text-xs text-[var(--color-muted-foreground)]">
        <span className="flex items-center gap-1">
          {realtimeConnected ? <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" /> : <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />}
          {realtimeConnected ? 'Suivi en temps réel' : 'Vérification périodique'}
        </span>
        <span>{elapsedSeconds}s</span>
      </div>

      {error && error.code !== 'rate_limited' && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error.userMessage}
        </p>
      )}

      {!isTerminal && (
        <div className="flex w-full flex-col gap-2">
          <Button variant="outline" size="lg" className="w-full" onClick={() => void refresh()}>
            Vérifier maintenant
          </Button>
          {canCancel && (
            <Button variant="ghost" size="lg" className="w-full" loading={cancelling} onClick={() => void handleCancel()}>
              Annuler le paiement
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
