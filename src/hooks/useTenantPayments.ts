import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { paymentService } from '@/services/payment/paymentService';

export interface PaymentFilters {
  year?: number | 'all';
  status?: 'all' | 'reussi' | 'en_attente' | 'echoue';
  search?: string;
}

export function useTenantPayments(filters: PaymentFilters = {}) {
  const { user } = useAuth();

  return useSupabaseQuery({
    queryKey: ['tenant-payments', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      const payments = await paymentService.getPaymentsForTenant(user.id, filters);

      const year = filters.year && filters.year !== 'all' ? filters.year : new Date().getFullYear();
      const yearPayments = payments.filter((p) => {
        if (filters.year === 'all') return true;
        return p.periode.startsWith(String(year));
      });

      const completed = yearPayments.filter((p) => p.status === 'complete');
      const totalPaid = completed.reduce((sum, p) => sum + Number(p.montant), 0);
      const lastPayment = completed[0];

      return {
        payments,
        summary: {
          totalPaid,
          count: yearPayments.length,
          lastPaymentDate: lastPayment?.paid_at ?? null,
        },
      };
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

export function usePaymentDetail(paymentId?: string) {
  const { user } = useAuth();

  return useSupabaseQuery({
    queryKey: ['tenant-payment', paymentId],
    queryFn: async () => {
      if (!paymentId) throw new Error('Paiement introuvable');
      const payment = await paymentService.getPaymentById(paymentId);
      return payment;
    },
    enabled: !!user?.id && !!paymentId,
  });
}
