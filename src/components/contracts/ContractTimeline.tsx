import {
  CheckCircle2,
  Clock,
  FileText,
  PenLine,
  Send,
  Wallet,
  Calendar,
} from 'lucide-react';
import { cn, formatDateTime, formatCurrency } from '@/lib/utils';
import type { ContractWithRelations } from '@/services/contract/contractService';
import { getContractTerms } from '@/utils/contractUtils';

export interface TimelineEvent {
  id: string;
  label: string;
  date?: string | null;
  description?: string;
  icon: 'created' | 'sent' | 'signed_tenant' | 'signed_landlord' | 'active' | 'due' | 'payment';
  completed: boolean;
}

function getIcon(type: TimelineEvent['icon']) {
  switch (type) {
    case 'created':
      return FileText;
    case 'sent':
      return Send;
    case 'signed_tenant':
    case 'signed_landlord':
      return PenLine;
    case 'active':
      return CheckCircle2;
    case 'due':
      return Calendar;
    case 'payment':
      return Wallet;
    default:
      return Clock;
  }
}

export function buildContractTimeline(contract: ContractWithRelations): TimelineEvent[] {
  const terms = getContractTerms(contract);
  const lastPayment = contract.paiements?.find((p) => p.status === 'complete');

  const events: TimelineEvent[] = [
    {
      id: 'created',
      label: 'Créé',
      date: contract.created_at,
      completed: true,
      icon: 'created',
    },
    {
      id: 'sent',
      label: 'Envoyé au locataire',
      date: terms.sentToTenantAt,
      completed: !!terms.sentToTenantAt,
      icon: 'sent',
    },
    {
      id: 'signed_tenant',
      label: 'Signé par le locataire',
      date: contract.signed_by_locataire_at,
      completed: !!contract.signed_by_locataire_at,
      icon: 'signed_tenant',
    },
    {
      id: 'signed_landlord',
      label: 'Signé par le bailleur',
      date: contract.signed_by_bailleur_at,
      completed: !!contract.signed_by_bailleur_at,
      icon: 'signed_landlord',
    },
    {
      id: 'active',
      label: 'Actif depuis',
      date: contract.signed_at,
      completed: contract.status === 'actif',
      icon: 'active',
    },
  ];

  if (contract.status === 'actif') {
    const now = new Date();
    const day = Math.min(contract.payment_day, 28);
    let due = new Date(now.getFullYear(), now.getMonth(), day);
    if (due < now) due = new Date(now.getFullYear(), now.getMonth() + 1, day);

    events.push({
      id: 'due',
      label: 'Prochaine échéance',
      date: due.toISOString(),
      completed: false,
      icon: 'due',
    });
  }

  if (lastPayment) {
    events.push({
      id: 'payment',
      label: 'Dernier paiement',
      date: lastPayment.paid_at ?? lastPayment.created_at,
      description: formatCurrency(Number(lastPayment.montant), lastPayment.currency as 'CDF' | 'USD'),
      completed: true,
      icon: 'payment',
    });
  }

  return events;
}

interface ContractTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function ContractTimeline({ events, className }: ContractTimelineProps) {
  return (
    <ol className={cn('relative space-y-0', className)}>
      {events.map((event, index) => {
        const Icon = getIcon(event.icon);
        const isLast = index === events.length - 1;

        return (
          <li key={event.id} className="relative flex gap-4 pb-8">
            {!isLast && (
              <div
                className={cn(
                  'absolute left-[15px] top-8 h-full w-0.5',
                  event.completed ? 'bg-[var(--color-kinshasa-gold)]' : 'bg-[var(--color-border)]',
                )}
              />
            )}
            <div
              className={cn(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                event.completed
                  ? 'border-[var(--color-kinshasa-gold)] bg-[var(--color-kinshasa-gold)] text-white'
                  : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)]',
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-medium">{event.label}</p>
              {event.date && (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {formatDateTime(event.date)}
                </p>
              )}
              {event.description && (
                <p className="text-sm font-medium text-[var(--color-kinshasa-blue)]">
                  {event.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
