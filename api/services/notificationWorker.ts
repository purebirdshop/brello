// api/services/notificationWorker.ts
// Polls the notification_queue table for unprocessed events
// and dispatches them via notificationService.
// Called on a schedule — in production wire to a Vercel cron
// or Supabase Edge Function cron. For dev, call processQueue()
// manually or set a setInterval.

import { supabaseAdmin } from '../lib/supabase'
import {
  notifyLocationFollowers,
  notifyJobFairAnnounced,
  sendNotification,
} from './notificationService'

export async function processNotificationQueue(): Promise<void> {
  // Fetch unprocessed items, oldest first, max 20 at a time
  const { data: items, error } = await supabaseAdmin
    .from('notification_queue')
    .select('*')
    .is('processed_at', null)
    .is('error', null)
    .order('created_at', { ascending: true })
    .limit(20)

  if (error) {
    console.error('[notificationWorker] fetch error:', error)
    return
  }

  if (!items || items.length === 0) return

  console.log(`[notificationWorker] processing ${items.length} item(s)`)

  for (const item of items) {
    try {
      await dispatch(item)

      await supabaseAdmin
        .from('notification_queue')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', item.id)
    } catch (err: any) {
      console.error(`[notificationWorker] error on item ${item.id}:`, err)
      await supabaseAdmin
        .from('notification_queue')
        .update({ error: err.message ?? 'unknown error' })
        .eq('id', item.id)
    }
  }
}

async function dispatch(item: any): Promise<void> {
  const payload = item.payload

  switch (item.type) {
    case 'listing_posted': {
      // Get employer name for the notification body
      const { data: location } = await supabaseAdmin
        .from('employer_locations')
        .select('employer_profiles ( business_name )')
        .eq('id', payload.employer_location_id)
        .single()

      const employerName = (location as any)?.employer_profiles?.business_name ?? 'A business'

      await notifyLocationFollowers(
        payload.employer_location_id,
        payload.listing_id,
        payload.title,
        employerName
      )
      break
    }

    case 'job_fair_announced': {
      await notifyJobFairAnnounced(
        payload.fair_id,
        payload.name,
        payload.lat,
        payload.lng,
        10   // broadcast radius in miles
      )
      break
    }

    case 'job_fair_live': {
      await notifyJobFairAnnounced(
        payload.fair_id,
        payload.name,
        payload.lat,
        payload.lng,
        5   // tighter radius for live notification
      )
      break
    }

    // swap_available notifications are enqueued by the DB trigger
    // when a hunter's swap_status changes to 'available'.
    // The swap_notify_queue table holds the waiting hunters.
    case 'swap_available': {
      const { data: queue } = await supabaseAdmin
        .from('swap_notify_queue')
        .select(`
          requesting_hunter_id,
          hunter_profiles!swap_notify_queue_requesting_hunter_id_fkey (
            user_id
          )
        `)
        .eq('locked_hunter_id', payload.hunter_id)
        .not('notified_at', 'is', null)   // trigger already set notified_at

      for (const entry of (queue ?? [])) {
        const userId = (entry as any).hunter_profiles?.user_id
        if (userId) {
          await sendNotification({
            recipientUserId: userId,
            type:            'swap_available',
            referenceId:     payload.hunter_id,
          })
        }
      }
      break
    }

    default:
      console.warn(`[notificationWorker] unhandled type: ${item.type}`)
  }
}
