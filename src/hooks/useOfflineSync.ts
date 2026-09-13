import { useEffect, useCallback } from 'react';
import { syncOfflineQueue, subscribeToOnlineStatus } from '@/config/supabase';
import { useOfflineStore } from '@/stores/offline.store';
import { toastSuccess, toastInfo } from '@/components/ui/Toast';

export function useOfflineSync() {
  const { isOnline, pendingQueue, setOnline, setLastSyncAt, clearQueue } = useOfflineStore();

  useEffect(() => {
    const unsubscribe = subscribeToOnlineStatus((online) => {
      setOnline(online);
      if (online) {
        toastInfo('Connexion rétablie. Synchronisation en cours...');
      }
    });
    return unsubscribe;
  }, [setOnline]);

  const sync = useCallback(async () => {
    if (!isOnline) return { synced: 0, failed: 0 };
    const result = await syncOfflineQueue();
    if (result.synced > 0) {
      toastSuccess(`${result.synced} modification(s) synchronisée(s)`);
      setLastSyncAt(new Date().toISOString());
    }
    if (result.failed === 0 && pendingQueue.length === 0) {
      clearQueue();
    }
    return result;
  }, [isOnline, pendingQueue.length, setLastSyncAt, clearQueue]);

  useEffect(() => {
    if (isOnline) {
      void sync();
    }
  }, [isOnline, sync]);

  return { isOnline, pendingQueue, sync };
}
