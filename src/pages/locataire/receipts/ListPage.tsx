import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { PropertyGridSkeleton } from '@/components/common/SkeletonLoaders';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { receiptService } from '@/services/receipt/receiptService';
import { formatCDF, formatDate } from '@/lib/utils';
import { ROUTES } from '@/config/routes';

export function ReceiptsListPage() {
  const { user } = useAuth();
  const [year, setYear] = useState<number | 'all'>('all');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const { data: receipts = [], isLoading, error, refetch } = useSupabaseQuery({
    queryKey: ['tenant-receipts', user?.id, year, propertyFilter, minAmount, maxAmount],
    queryFn: async () => {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      return receiptService.getReceiptsForTenant(user.id, {
        year: year === 'all' ? undefined : year,
        propertyCode: propertyFilter || undefined,
        minAmount: minAmount ? Number(minAmount) : undefined,
        maxAmount: maxAmount ? Number(maxAmount) : undefined,
      });
    },
    enabled: !!user?.id,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Mes reçus" subtitle="Tous vos reçus de paiement" />

      <div className="flex flex-wrap gap-3">
        <select
          value={String(year)}
          onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
          aria-label="Année"
        >
          <option value="all">Toutes les années</option>
          {[2023, 2024, 2025].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <input
          type="text"
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          placeholder="Code logement..."
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <input
          type="number"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          placeholder="Montant min"
          className="w-28 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <input
          type="number"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          placeholder="Montant max"
          className="w-28 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />
      </div>

      {isLoading ? (
        <PropertyGridSkeleton />
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-[var(--color-destructive)]">{error.message}</p>
          <Button className="mt-4" onClick={() => refetch()}>Réessayer</Button>
        </div>
      ) : receipts.length === 0 ? (
        <EmptyState title="Aucun reçu" description="Vos reçus apparaîtront ici après chaque paiement." />
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {receipts.map((r) => {
            const logement = r.contrat?.logement as { code?: string; type?: string } | undefined;
            return (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <p className="font-mono text-xs font-medium">{r.code}</p>
                  <p className="text-lg font-bold text-[var(--color-kinshasa-gold)]">{formatCDF(Number(r.montant))}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">{formatDate(r.issued_at)}</p>
                  <p className="truncate text-xs">{logement?.type} — {logement?.code}</p>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => receiptService.downloadReceiptPdf(r.id)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Link to={`${ROUTES.LOCATAIRE.RECEIPTS}/${r.id}`} className="flex-1">
                      <Button variant="primary" size="sm" className="w-full">
                        <Eye className="h-3.5 w-3.5" /> Voir
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
