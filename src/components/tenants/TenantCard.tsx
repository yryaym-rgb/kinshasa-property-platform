import { Link } from 'react-router-dom';
import { Phone, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCDF, formatPhone, getInitials } from '@/lib/utils';
import { ROUTES } from '@/config/routes';
import type { TenantWithContract } from '@/hooks/useTenants';

interface TenantCardProps {
  tenant: TenantWithContract;
}

export function TenantCard({ tenant }: TenantCardProps) {
  const detailUrl = ROUTES.BAILLEUR.TENANT_DETAIL.replace(':id', tenant.id);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {tenant.avatar_url ? (
            <img src={tenant.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-kinshasa-blue)] text-white font-medium">
              {getInitials(tenant.full_name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <Link to={detailUrl} className="font-medium hover:underline">{tenant.full_name}</Link>
            <p className="text-sm text-[var(--color-muted-foreground)]">{formatPhone(tenant.phone)}</p>
            <p className="mt-1 text-sm">{tenant.logement_address}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={tenant.payment_status === 'a_jour' ? 'success' : 'danger'}>
                {tenant.payment_status === 'a_jour' ? 'À jour' : 'En retard'}
              </Badge>
              <span className="text-sm font-medium text-[var(--color-kinshasa-gold)]">
                {formatCDF(tenant.loyer_mensuel)}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <a href={`tel:${tenant.phone}`} className="rounded p-2 hover:bg-[var(--color-muted)]" aria-label="Appeler">
              <Phone className="h-4 w-4" />
            </a>
            <a
              href={`https://wa.me/${tenant.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-2 hover:bg-[var(--color-muted)]"
              aria-label="WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
