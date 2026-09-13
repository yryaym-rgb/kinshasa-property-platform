import { Calendar, MapPin, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { ContractStatusBadge } from '@/components/contracts/ContractStatusBadge';
import { formatCurrency, formatDate, getInitials, truncate } from '@/lib/utils';
import type { ContractWithRelations } from '@/services/contract/contractService';

interface ContractCardProps {
  contract: ContractWithRelations;
  onClick?: () => void;
}

export function ContractCard({ contract, onClick }: ContractCardProps) {
  const tenant = contract.locataire;
  const property = contract.logement;

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {tenant?.avatar_url ? (
              <img src={tenant.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-kinshasa-blue)] text-sm text-white">
                {getInitials(tenant?.full_name ?? '?')}
              </div>
            )}
            <div>
              <p className="font-medium">{tenant?.full_name ?? '—'}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{contract.code}</p>
            </div>
          </div>
          <ContractStatusBadge status={contract.status} />
        </div>

        <div className="mt-3 space-y-1.5 text-sm text-[var(--color-muted-foreground)]">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{truncate(property?.address ?? '—', 40)}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="font-mono text-xs">{property?.code}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>
              {formatDate(contract.date_debut)} —{' '}
              {contract.date_fin ? formatDate(contract.date_fin) : 'En cours'}
            </span>
          </div>
        </div>

        <p className="mt-3 text-lg font-bold">
          {formatCurrency(Number(contract.loyer_mensuel), contract.currency as 'CDF' | 'USD')}
          <span className="text-sm font-normal text-[var(--color-muted-foreground)]"> / mois</span>
        </p>
      </CardContent>
    </Card>
  );
}
