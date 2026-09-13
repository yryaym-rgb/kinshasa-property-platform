import { Link } from 'react-router-dom';
import { FileText, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { PropertyGridSkeleton } from '@/components/common/SkeletonLoaders';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ContractStatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTenantContracts } from '@/hooks/useTenantContracts';
import { formatCDF, formatDate } from '@/lib/utils';
import { ROUTES } from '@/config/routes';

export function ContractsListPage() {
  const { data: contracts = [], isLoading, error, refetch } = useTenantContracts();

  if (isLoading) return <PropertyGridSkeleton />;

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-destructive)]">{error.message}</p>
        <Button className="mt-4" onClick={() => refetch()}>Réessayer</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mes contrats" subtitle="Vos contrats de location" />

      {contracts.length === 0 ? (
        <EmptyState
          title="Aucun contrat"
          description="Vous n'avez pas encore de contrat de location."
          icon={<FileText className="h-12 w-12" />}
        />
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => {
            const logement = c.logement;
            return (
              <Link key={c.id} to={`${ROUTES.LOCATAIRE.CONTRACTS}/${c.id}`}>
                <Card className="transition-colors hover:border-[var(--color-kinshasa-gold)]">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{logement?.type}{logement?.rooms ? ` ${logement.rooms} pièces` : ''}</p>
                        <ContractStatusBadge status={c.status} />
                      </div>
                      <p className="text-sm text-[var(--color-muted-foreground)]">{logement?.address}</p>
                      <p className="mt-1 text-sm font-medium text-[var(--color-kinshasa-gold)]">
                        {formatCDF(Number(c.loyer_mensuel))}/mois
                      </p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        Depuis {formatDate(c.date_debut)}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[var(--color-muted-foreground)]" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
