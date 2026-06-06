// mobile/hooks/useNotifications.ts
// Fetches the notification log for the current user,
// subscribes to new notifications via Supabase Realtime,
// and provides mark-read helpers.

import { useEffect, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore, NotificationLogItem } from '../store/notificationStore'
import { resolveNotificationRoute } from '../lib/notificationService'

// Human-readable notification content derived from type
function enrichNotification(raw: any): NotificationLogItem {
  const map: Record<string, { title: string; body: string; icon: string }> = {
    swap_request:           { icon: '⇄', title: 'Spot request',          body: 'Someone in your circle wants to borrow your location.' },
    swap_approved:          { icon: '✓', title: 'Spot approved',          body: 'Your spot request was approved. Your map has moved.' },
    swap_declined:          { icon: '✕', title: 'Spot declined',          body: 'Your spot request was declined.' },
    swap_expiring:          { icon: '⏱', title: 'Spot expiring soon',     body: 'Your location swap expires in 2 minutes.' },
    swap_extension_request: { icon: '⏱', title: 'More time requested',   body: 'Someone is asking for more time with your location.' },
    swap_available:         { icon: '🟢', title: 'They\'re available',    body: 'A circle member you were waiting on is now free.' },
    introduction_received:  { icon: '🎬', title: 'New introduction',      body: 'Someone introduced themselves for your listing.' },
    listing_posted:         { icon: '💼', title: 'New listing nearby',    body: 'A business you follow just posted a new opening.' },
    job_fair_announced:     { icon: '🎪', title: 'Job fair coming',       body: 'A LocalLoop pop-up job fair is coming to your area.' },
    job_fair_live:          { icon: '🎪', title: 'Job fair is live!',     body: 'A job fair near you just went live. Tap to explore.' },
    circle_request:         { icon: '👥', title: 'Circle request',        body: 'Someone wants to join your circle.' },
    radius_milestone:       { icon: '◎', title: 'Radius expanded!',       body: 'Your circle grew enough to unlock a bigger radius.' },
  }

  const content = map[raw.type] ?? { icon: '🔔', title: 'Notification', body: '' }

  return {
    ...raw,
    ...content,
  }
}

export function useNotifications() {
  const router  = useRouter()
  const { user } = useAuthStore()
  const { setItems, markRead, markAllRead, setLoading } = useNotificationStore()

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .eq('recipient_user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setItems((data ?? []).map(enrichNotification))
    } catch (err) {
      console.error('[useNotifications] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Mark a single notification read
  const handleMarkRead = useCallback(async (id: string) => {
    markRead(id)
    await supabase
      .from('notification_logs')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
  }, [])

  // Mark all read
  const handleMarkAllRead = useCallback(async () => {
    if (!user) return
    markAllRead()
    await supabase
      .from('notification_logs')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_user_id', user.id)
      .is('read_at', null)
  }, [user?.id])

  // Handle a notification tap — resolves route and navigates
  const handleNotificationTap = useCallback((notification: any) => {
    const route = resolveNotificationRoute(notification)
    if (route) router.push(route as any)
  }, [])

  // Initial load
  useEffect(() => {
    fetchNotifications()
  }, [user?.id])

  // Realtime: new notifications
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notification_logs',
          filter: `recipient_user_id=eq.${user.id}`,
        },
        () => fetchNotifications()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  return {
    fetchNotifications,
    handleMarkRead,
    handleMarkAllRead,
    handleNotificationTap,
  }
}
