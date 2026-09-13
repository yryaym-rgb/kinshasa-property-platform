import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/config/supabase';
import { getCurrentPeriod } from '@/utils/dateUtils';
import type { Contrat, Paiement, Notification } from '@/types/database.types';
import type { User } from '@/types/database.types';

export interface TenantContractWithRelations extends Contrat {
  logement?: {
    id: string;
    code: string;
    address: string;
    commune: string;
    type: string;
    rooms: number | null;
    cover_image_url?: string | null;
  };
  bailleur?: {
    id: string;
    business_name: string | null;
    user?: { full_name: string; phone: string };
  };
}

export interface TenantDashboardData {
  profile: User;
  activeContracts: TenantContractWithRelations[];
  activeContract: TenantContractWithRelations | null;
  nextPayment: {
    amount: number;
    dueDate: string;
    daysRemaining: number;
    isOverdue: boolean;
    periode: string;
  } | null;
  recentPayments: Paiement[];
  recentNotifications: Notification[];
  recentActivity: Array<{
    id: string;
    type: 'payment' | 'contract' | 'receipt' | 'notification';
    title: string;
    description?: string;
    timestamp: string;
  }>;
}

function getNextDueDate(paymentDay: number): Date {
  const now = new Date();
  const due = new Date(now.getFullYear(), now.getMonth(), paymentDay);
  if (due < now) {
    due.setMonth(due.getMonth() + 1);
  }
  return due;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function useTenantDashboard() {
  const { user } = useAuth();

  return useSupabaseQuery<TenantDashboardData>({
    queryKey: ['tenant-dashboard', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Utilisateur non connecté');

      const [contractsRes, paymentsRes, notificationsRes, receiptsRes] = await Promise.all([
        supabase
          .from('contrats')
          .select(`
            *,
            logement:logements(id, code, address, commune, type, rooms),
            bailleur:bailleurs(id, business_name, user:users!bailleurs_user_id_fkey(full_name, phone))
          `)
          .eq('locataire_id', user.id)
          .eq('status', 'actif')
          .order('created_at', { ascending: false }),
        supabase
          .from('paiements')
          .select('*, contrat:contrats!inner(locataire_id)')
          .eq('contrat.locataire_id', user.id)
          .order('paid_at', { ascending: false })
          .limit(5),
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('recus')
          .select('*, contrat:contrats!inner(locataire_id)')
          .eq('contrat.locataire_id', user.id)
          .order('issued_at', { ascending: false })
          .limit(3),
      ]);

      if (contractsRes.error) throw new Error(contractsRes.error.message);

      const activeContracts = (contractsRes.data ?? []) as TenantContractWithRelations[];
      const activeContract = activeContracts[0] ?? null;
      const currentPeriod = getCurrentPeriod();

      let nextPayment: TenantDashboardData['nextPayment'] = null;
      if (activeContract) {
        const dueDate = getNextDueDate(activeContract.payment_day);
        const daysRemaining = daysBetween(new Date(), dueDate);
        const periodPaid = (paymentsRes.data ?? []).some(
          (p) => p.periode === currentPeriod && p.status === 'complete',
        );
        if (!periodPaid) {
          nextPayment = {
            amount: Number(activeContract.loyer_mensuel),
            dueDate: dueDate.toISOString(),
            daysRemaining,
            isOverdue: daysRemaining < 0,
            periode: currentPeriod,
          };
        }
      }

      const recentActivity: TenantDashboardData['recentActivity'] = [];

      for (const p of paymentsRes.data ?? []) {
        if (p.status === 'complete') {
          recentActivity.push({
            id: `payment-${p.id}`,
            type: 'payment',
            title: `Paiement reçu — ${Number(p.montant).toLocaleString('fr-CD')} FC`,
            timestamp: p.paid_at ?? p.created_at,
          });
        }
      }

      for (const r of receiptsRes.data ?? []) {
        recentActivity.push({
          id: `receipt-${r.id}`,
          type: 'receipt',
          title: 'Nouveau reçu disponible',
          description: r.code,
          timestamp: r.issued_at,
        });
      }

      if (activeContract?.signed_at) {
        recentActivity.push({
          id: `contract-${activeContract.id}`,
          type: 'contract',
          title: `Contrat signé — ${activeContract.logement?.type ?? 'Logement'} ${activeContract.logement?.rooms ? `${activeContract.logement.rooms} pièces` : ''}`,
          timestamp: activeContract.signed_at,
        });
      }

      recentActivity.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      return {
        profile: profile ?? user,
        activeContracts,
        activeContract,
        nextPayment,
        recentPayments: (paymentsRes.data ?? []) as Paiement[],
        recentNotifications: (notificationsRes.data ?? []) as Notification[],
        recentActivity: recentActivity.slice(0, 5),
      };
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}
