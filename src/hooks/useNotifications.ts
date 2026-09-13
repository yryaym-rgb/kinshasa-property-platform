import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useSupabaseMutation } from '@/hooks/useSupabaseMutation';
import { supabase } from '@/config/supabase';

export function useNotifications(limit?: number) {
  const { user } = useAuth();

  return useSupabaseQuery({
    queryKey: ['notifications', user?.id, limit],
    queryFn: async () => {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

export function useMarkNotificationRead() {
  const { user } = useAuth();

  return useSupabaseMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user?.id ?? '');
      if (error) throw new Error(error.message);
    },
    invalidateKeys: [['notifications']],
  });
}

export function useLandlordDashboard() {
  const bailleurId = useBailleurId();

  return useSupabaseQuery({
    queryKey: ['landlord-dashboard', bailleurId],
    queryFn: async () => {
      if (!bailleurId) throw new Error('Profil bailleur non trouvé');
      const { getLandlordDashboardStats, getRecentPayments } = await import(
        '@/services/property/propertyService'
      );
      const [stats, recentPayments] = await Promise.all([
        getLandlordDashboardStats(bailleurId),
        getRecentPayments(bailleurId, 5),
      ]);
      return { stats, recentPayments };
    },
    enabled: !!bailleurId,
    staleTime: 60_000,
  });
}

function useBailleurId() {
  const { user } = useAuth();
  return user?.bailleur?.id;
}
