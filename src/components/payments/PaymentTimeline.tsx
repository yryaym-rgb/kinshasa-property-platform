import { Timeline } from '@/components/common/Timeline';
import { CheckCircle, Clock, Loader2 } from 'lucide-react';

export type PaymentTimelineStep =
  | 'initiated'
  | 'provider_confirmed'
  | 'tax_calculated'
  | 'receipt_generated'
  | 'notifications_sent';

const STEPS: Array<{ id: PaymentTimelineStep; title: string }> = [
  { id: 'initiated', title: 'Paiement initié' },
  { id: 'provider_confirmed', title: 'Confirmé par le fournisseur' },
  { id: 'tax_calculated', title: 'Impôt calculé' },
  { id: 'receipt_generated', title: 'Reçu généré' },
  { id: 'notifications_sent', title: 'Notifications envoyées' },
];

interface PaymentTimelineProps {
  currentStep: PaymentTimelineStep;
}

export function PaymentTimeline({ currentStep }: PaymentTimelineProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  const items = STEPS.map((step, index) => {
    let status: 'completed' | 'current' | 'upcoming' = 'upcoming';
    if (index < currentIndex) status = 'completed';
    else if (index === currentIndex) status = 'current';

    const icon =
      status === 'completed'
        ? <CheckCircle className="h-4 w-4" />
        : status === 'current'
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Clock className="h-4 w-4" />;

    return {
      id: step.id,
      title: step.title,
      status,
      icon,
    };
  });

  return <Timeline items={items} />;
}
