import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS } from './schema';

interface StepperProps {
  currentStep: number;
}

export function Stepper({ currentStep }: StepperProps) {
  return (
    <nav aria-label="Progression du formulaire" className="mb-8">
      <ol className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          return (
            <li key={step.id} className="relative flex flex-1 flex-col items-center">
              {index > 0 && (
                <div
                  className={cn(
                    'absolute left-0 right-1/2 top-4 h-0.5 -translate-y-1/2',
                    isCompleted ? 'bg-[var(--color-kinshasa-gold)]' : 'bg-[var(--color-border)]',
                  )}
                  style={{ width: '100%', marginLeft: '-50%' }}
                />
              )}
              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium',
                  isCompleted && 'border-[var(--color-kinshasa-gold)] bg-[var(--color-kinshasa-gold)] text-white',
                  isCurrent && 'border-[var(--color-kinshasa-blue)] bg-[var(--color-kinshasa-blue)] text-white',
                  !isCompleted && !isCurrent && 'border-[var(--color-border)] bg-white text-[var(--color-muted-foreground)]',
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step.id}
              </div>
              <span
                className={cn(
                  'mt-2 hidden text-xs sm:block',
                  isCurrent ? 'font-medium text-[var(--color-kinshasa-blue)]' : 'text-[var(--color-muted-foreground)]',
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
