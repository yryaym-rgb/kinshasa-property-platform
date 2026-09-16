import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sessionStorageAdapter } from '@/lib/authStorage';
import type { Database } from '@/types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requises');
}

export type TypedSupabaseClient = SupabaseClient<Database>;

interface OfflineQueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  createdAt: string;
}

const OFFLINE_QUEUE_KEY = 'eloyer_offline_queue';

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
const statusListeners = new Set<(online: boolean) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    statusListeners.forEach((listener) => listener(true));
    void syncOfflineQueue();
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    statusListeners.forEach((listener) => listener(false));
  });
}

/** Exponential backoff retry wrapper */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError ?? new Error('Échec après plusieurs tentatives');
}

function getOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineQueueItem[]) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: OfflineQueueItem[]): void {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function queueOfflineOperation(
  table: string,
  operation: OfflineQueueItem['operation'],
  payload: Record<string, unknown>,
): void {
  const queue = getOfflineQueue();
  queue.push({
    id: crypto.randomUUID(),
    table,
    operation,
    payload,
    createdAt: new Date().toISOString(),
  });
  saveOfflineQueue(queue);
}

/** Sync pending offline operations when back online */
export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (!isOnline) return { synced: 0, failed: 0 };

  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: OfflineQueueItem[] = [];

  for (const item of queue) {
    try {
      await withRetry(async () => {
        const table = supabase.from(item.table as keyof Database['public']['Tables']);
        switch (item.operation) {
          case 'insert':
            await table.insert(item.payload as never);
            break;
          case 'update':
            await table.update(item.payload as never).eq('id', item.payload.id as string);
            break;
          case 'delete':
            await table.delete().eq('id', item.payload.id as string);
            break;
        }
      });
      synced++;
    } catch {
      failed++;
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  return { synced, failed };
}

export interface SupabaseStatus {
  online: boolean;
  pendingSyncCount: number;
  url: string;
}

export function getSupabaseStatus(): SupabaseStatus {
  return {
    online: isOnline,
    pendingSyncCount: getOfflineQueue().length,
    url: supabaseUrl,
  };
}

export function subscribeToOnlineStatus(listener: (online: boolean) => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export const supabase: TypedSupabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // "Se souvenir de moi" decides between localStorage and sessionStorage.
    storage: typeof window !== 'undefined' ? sessionStorageAdapter : undefined,
  },
  global: {
    fetch: async (url, options) => {
      if (!isOnline) {
        throw new Error('Connexion hors ligne. Vos modifications seront synchronisées à la reconnexion.');
      }
      return withRetry(() => fetch(url, options), 2, 500);
    },
  },
});

export default supabase;
