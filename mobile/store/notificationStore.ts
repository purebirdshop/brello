// mobile/store/notificationStore.ts

import { create } from 'zustand'

export interface NotificationLogItem {
  id:           string
  type:         string
  channel:      string
  reference_id: string | null
  read_at:      string | null
  sent_at:      string
  // enriched client-side
  title:        string
  body:         string
  icon:         string
}

interface NotificationState {
  items:       NotificationLogItem[]
  unreadCount: number
  loading:     boolean

  setItems:       (items: NotificationLogItem[]) => void
  markRead:       (id: string) => void
  markAllRead:    () => void
  setLoading:     (v: boolean) => void
  setUnreadCount: (n: number) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items:       [],
  unreadCount: 0,
  loading:     false,

  setItems:       (items)  => set({ items, unreadCount: items.filter((i) => !i.read_at).length }),
  markRead:       (id)     => set((s) => ({
    items:       s.items.map((i) => i.id === id ? { ...i, read_at: new Date().toISOString() } : i),
    unreadCount: Math.max(0, s.unreadCount - 1),
  })),
  markAllRead:    ()       => set((s) => ({
    items:       s.items.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })),
    unreadCount: 0,
  })),
  setLoading:     (v)      => set({ loading: v }),
  setUnreadCount: (n)      => set({ unreadCount: n }),
}))
