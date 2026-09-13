import { create } from 'zustand';

interface OfflineQueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  createdAt: string;
}

interface OfflineState {
  isOnline: boolean;
  pendingQueue: OfflineQueueItem[];
  lastSyncAt: string | null;
  setOnline: (online: boolean) => void;
  addToQueue: (item: Omit<OfflineQueueItem, 'id' | 'createdAt'>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  setLastSyncAt: (timestamp: string) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingQueue: [],
  lastSyncAt: null,
  setOnline: (online) => set({ isOnline: online }),
  addToQueue: (item) =>
    set((state) => ({
      pendingQueue: [
        ...state.pendingQueue,
        { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ],
    })),
  removeFromQueue: (id) =>
    set((state) => ({
      pendingQueue: state.pendingQueue.filter((item) => item.id !== id),
    })),
  clearQueue: () => set({ pendingQueue: [] }),
  setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),
}));
