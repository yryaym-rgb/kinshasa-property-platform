import { useEffect, useRef } from 'react';
import { supabase } from '@/config/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeSubscriptionOptions<T extends Record<string, unknown>> {
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: T) => void;
  enabled?: boolean;
}

export function useRealtimeSubscription<T extends Record<string, unknown>>({
  table,
  filter,
  event = '*',
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeSubscriptionOptions<T>) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime:${table}${filter ? `:${filter}` : ''}`;
    const channel = supabase.channel(channelName);

    channel.on(
      'postgres_changes',
      {
        event,
        schema: 'public',
        table,
        ...(filter ? { filter } : {}),
      },
      (payload: RealtimePostgresChangesPayload<T>) => {
        const record = (payload.new ?? payload.old) as T;
        switch (payload.eventType) {
          case 'INSERT':
            onInsert?.(record);
            break;
          case 'UPDATE':
            onUpdate?.(record);
            break;
          case 'DELETE':
            onDelete?.(record);
            break;
        }
      },
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [table, filter, event, enabled, onInsert, onUpdate, onDelete]);

  return channelRef;
}
