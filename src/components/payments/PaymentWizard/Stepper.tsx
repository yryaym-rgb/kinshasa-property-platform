import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Contrat' },
  { id: 2, label: 'Montant' },
  { id: 3, label: 'Méthode' },
  { id: 4, label: 'Confirmation' },
];

interface StepperProps {
  currentStep: number;
}

export function Stepper({ currentStep }: StepperProps) {
  return (
    <nav aria-label="Étapes du paiement" className="mb-6">
      <ol className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <li key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                    isCompleted && 'bg-[var(--color-success)] text-white',
                    isCurrent && 'bg-[var(--color-kinshasa-gold)] text-[var(--color-secondary-foreground)]',
                    !isCompleted && !isCurrent && 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span
                  className={cn(
                    'hidden text-[10px] sm:block',
                    isCurrent ? 'font-medium text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-0.5 flex-1',
                    isCompleted ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]',
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
