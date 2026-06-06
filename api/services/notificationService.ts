// api/services/notificationService.ts
// Single entry point for all outbound push notifications.
// Every notification is:
//   1. Sent via Expo Push API
//   2. Logged to notification_logs table
// Never call the Expo API directly from routes — always go through here.

import { supabaseAdmin } from '../lib/supabase'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export type NotificationType =
  | 'swap_request'
  | 'swap_approved'
  | 'swap_declined'
  | 'swap_expiring'
  | 'swap_extension_request'
  | 'swap_available'
  | 'introduction_received'
  | 'listing_posted'
  | 'job_fair_announced'
  | 'job_fair_live'
  | 'circle_request'
  | 'radius_milestone'

interface SendOptions {
  recipientUserId: string
  type:            NotificationType
  referenceId?:    string
  data?:           Record<string, any>
}

interface NotificationContent {
  title: string
  body:  string
  sound: 'default' | null
  badge?: number
}

// ── Content templates ─────────────────────────

const CONTENT: Record<NotificationType, NotificationContent> = {
  swap_request: {
    title: 'Spot request ⇄',
    body:  'Someone in your circle wants to borrow your location.',
    sound: 'default',
  },
  swap_approved: {
    title: 'Spot approved ✓',
    body:  'Your spot request was approved. Check the map.',
    sound: 'default',
  },
  swap_declined: {
    title: 'Spot declined',
    body:  'Your spot request was declined.',
    sound: null,
  },
  swap_expiring: {
    title: '⏱ Spot expiring soon',
    body:  'Your location swap expires in 2 minutes.',
    sound: 'default',
  },
  swap_extension_request: {
    title: '⏱ More time requested',
    body:  'Someone is asking to extend their spot. Approve?',
    sound: 'default',
  },
  swap_available: {
    title: '🟢 They\'re available',
    body:  'A circle member you were waiting on is now free.',
    sound: 'default',
  },
  introduction_received: {
    title: '🎬 New introduction',
    body:  'Someone introduced themselves for your listing.',
    sound: 'default',
  },
  listing_posted: {
    title: '💼 New listing nearby',
    body:  'A business you follow just posted a new opening.',
    sound: 'default',
  },
  job_fair_announced: {
    title: '🎪 Job fair coming',
    body:  'A LocalLoop pop-up job fair is coming to your area!',
    sound: 'default',
  },
  job_fair_live: {
    title: '🎪 Job fair is live!',
    body:  'A job fair near you just went live. Tap to explore.',
    sound: 'default',
  },
  circle_request: {
    title: '👥 Circle request',
    body:  'Someone wants to join your circle.',
    sound: 'default',
  },
  radius_milestone: {
    title: '◎ Radius expanded!',
    body:  'Your circle grew enough to unlock a bigger radius.',
    sound: 'default',
  },
}

// ── Main send function ────────────────────────

export async function sendNotification(opts: SendOptions): Promise<void> {
  const { recipientUserId, type, referenceId, data } = opts

  // Get push token for this user
  const { data: sessions } = await supabaseAdmin
    .from('device_sessions')
    .select('push_token, platform')
    .eq('user_id', recipientUserId)
    .not('push_token', 'is', null)

  // Log to notification_logs regardless of push delivery
  await supabaseAdmin.from('notification_logs').insert({
    recipient_user_id: recipientUserId,
    type,
    channel:           sessions && sessions.length > 0 ? 'push' : 'in_app',
    reference_id:      referenceId ?? null,
    sent_at:           new Date().toISOString(),
  })

  if (!sessions || sessions.length === 0) return

  const content = CONTENT[type]

  // Send to all registered devices for this user
  const messages = sessions
    .filter((s: any) => !!s.push_token)
    .map((s: any) => ({
      to:    s.push_token,
      sound: content.sound,
      title: content.title,
      body:  content.body,
      data:  { type, reference_id: referenceId, ...data },
      channelId: resolveAndroidChannel(type),
    }))

  if (messages.length === 0) return

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    })

    if (!response.ok) {
      console.error('[notificationService] Expo push error:', await response.text())
    }
  } catch (err) {
    console.error('[notificationService] fetch error:', err)
  }
}

// ── Batch helpers for common scenarios ────────

// Notify a granter that someone wants their spot
export async function notifySwapRequest(
  granterUserId: string,
  requesterName: string,
  swapId:        string
) {
  await sendNotification({
    recipientUserId: granterUserId,
    type:            'swap_request',
    referenceId:     swapId,
    data:            { requester_name: requesterName, swap_id: swapId },
  })
}

// Notify requester their swap was approved
export async function notifySwapApproved(
  requesterUserId: string,
  swapId:          string
) {
  await sendNotification({
    recipientUserId: requesterUserId,
    type:            'swap_approved',
    referenceId:     swapId,
    data:            { swap_id: swapId },
  })
}

// Notify requester their swap was declined
export async function notifySwapDeclined(
  requesterUserId: string,
  swapId:          string
) {
  await sendNotification({
    recipientUserId: requesterUserId,
    type:            'swap_declined',
    referenceId:     swapId,
  })
}

// Notify granter an extension was requested
export async function notifyExtensionRequest(
  granterUserId: string,
  swapId:        string
) {
  await sendNotification({
    recipientUserId: granterUserId,
    type:            'swap_extension_request',
    referenceId:     swapId,
    data:            { swap_id: swapId },
  })
}

// Notify hunter that a followed location posted a new listing
export async function notifyListingPosted(
  hunterUserId:    string,
  listingId:       string,
  listingTitle:    string,
  employerName:    string
) {
  await sendNotification({
    recipientUserId: hunterUserId,
    type:            'listing_posted',
    referenceId:     listingId,
    data:            {
      listing_id:    listingId,
      listing_title: listingTitle,
      employer_name: employerName,
    },
  })
}

// Notify all followers of a location that a listing was posted
export async function notifyLocationFollowers(
  employerLocationId: string,
  listingId:          string,
  listingTitle:       string,
  employerName:       string
) {
  const { data: follows } = await supabaseAdmin
    .from('location_follows')
    .select(`
      hunter_id,
      hunter_profiles!inner ( user_id )
    `)
    .eq('employer_location_id', employerLocationId)

  if (!follows || follows.length === 0) return

  // Send in parallel, max 50 at a time to avoid rate limits
  const chunks = chunkArray(follows, 50)
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map((follow: any) =>
        notifyListingPosted(
          follow.hunter_profiles.user_id,
          listingId,
          listingTitle,
          employerName
        )
      )
    )
  }
}

// Notify a hunter their radius just grew
export async function notifyRadiusMilestone(
  hunterUserId: string,
  newRadius:    number
) {
  await sendNotification({
    recipientUserId: hunterUserId,
    type:            'radius_milestone',
    data:            { new_radius: newRadius },
  })
}

// Notify all hunters near a job fair that it's been announced
export async function notifyJobFairAnnounced(
  fairId:   string,
  fairName: string,
  lat:      number,
  lng:      number,
  radiusMi: number = 10
) {
  // Find hunters within the fair's broadcast radius
  const { data: nearbyHunters } = await supabaseAdmin
    .rpc('hunters_near_point', {
      lat,
      lng,
      radius_miles: radiusMi,
    })

  if (!nearbyHunters || nearbyHunters.length === 0) return

  const chunks = chunkArray(nearbyHunters, 50)
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map((h: any) =>
        sendNotification({
          recipientUserId: h.user_id,
          type:            'job_fair_announced',
          referenceId:     fairId,
          data:            { fair_id: fairId, fair_name: fairName },
        })
      )
    )
  }
}

// ── Android channel routing ───────────────────

function resolveAndroidChannel(type: NotificationType): string {
  if (type.startsWith('swap')) return 'swaps'
  if (type === 'listing_posted' || type.startsWith('job_fair')) return 'jobs'
  return 'default'
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
