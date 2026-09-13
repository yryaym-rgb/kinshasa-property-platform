import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Building2, Users, FileText, CreditCard } from 'lucide-react';
import { formatCDF } from '@/lib/utils';

const KPIS = [
  { label: 'Biens enregistrés', value: '12', icon: Building2, change: '+2' },
  { label: 'Locataires actifs', value: '8', icon: Users, change: '+1' },
  { label: 'Contrats actifs', value: '8', icon: FileText, change: '0' },
  { label: 'Recettes du mois', value: formatCDF(4850000), icon: CreditCard, change: '+12%' },
];

export function BailleurDashboard() {
  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble de votre portefeuille immobilier"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">
                  {kpi.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-[var(--color-muted-foreground)]" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-[var(--color-success)]">{kpi.change} ce mois</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function LocataireDashboard() {
  return (
    <div>
      <PageHeader title="Accueil" subtitle="Vos contrats et paiements" />
      <Card>
        <CardContent className="py-8 text-center text-[var(--color-muted-foreground)]">
          Bienvenue sur eLoyer Kinshasa. Vos contrats et paiements apparaîtront ici.
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminDashboard() {
  return (
    <div>
      <PageHeader title="Administration" subtitle="Vue d'ensemble de la plateforme" />
      <Card>
        <CardContent className="py-8 text-center text-[var(--color-muted-foreground)]">
          Tableau de bord administrateur — analytics et recettes fiscales.
        </CardContent>
      </Card>
    </div>
  );
}

export function FiscalDashboard() {
  return (
    <div>
      <PageHeader title="Tableau de bord fiscal" subtitle="Mobilisation des recettes" />
      <Card>
        <CardContent className="py-8 text-center text-[var(--color-muted-foreground)]">
          Tableau de bord agent fiscal — déclarations et rapprochements.
        </CardContent>
      </Card>
    </div>
  );
}

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <Card>
        <CardContent className="py-12 text-center text-[var(--color-muted-foreground)]">
          Cette section sera disponible dans la Phase 2.
        </CardContent>
      </Card>
    </div>
  );
}
