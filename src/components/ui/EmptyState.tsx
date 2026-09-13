import { Building2, CreditCard, FileText, Inbox } from 'lucide-react';
import { Button } from './Button';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
        {icon ?? <Inbox className="h-8 w-8" />}
      </div>
      <h3 className="font-heading text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-[var(--color-muted-foreground)]">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function NoPropertiesEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={<Building2 className="h-8 w-8" />}
      title="Aucun bien enregistré"
      description="Commencez par enregistrer votre premier logement sur la plateforme eLoyer Kinshasa."
      actionLabel="Ajouter un bien"
      onAction={onAction}
    />
  );
}

export function NoPaymentsEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={<CreditCard className="h-8 w-8" />}
      title="Aucun paiement"
      description="Les paiements de loyer apparaîtront ici une fois effectués."
      actionLabel="Effectuer un paiement"
      onAction={onAction}
    />
  );
}

export function NoContractsEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={<FileText className="h-8 w-8" />}
      title="Aucun contrat"
      description="Créez un contrat de location pour commencer à gérer vos locataires."
      actionLabel="Créer un contrat"
      onAction={onAction}
    />
  );
}
