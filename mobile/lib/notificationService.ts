// mobile/lib/notificationService.ts
// Handles push token registration, permission requests,
// and incoming notification routing. Call bootstrapNotifications()
// once after auth is confirmed.

import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'
import { useAuthStore } from '../store/authStore'

// How notifications behave while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
})

// ── Bootstrap ─────────────────────────────────
// Call once after the user is authenticated.
// Requests permission, registers the push token,
// and wires the foreground/tap listeners.

export async function bootstrapNotifications(
  onNotificationTap: (notification: Notifications.Notification) => void
) {
  if (!Device.isDevice) {
    console.log('[notifications] Push not available on simulator')
    return
  }

  const token = await registerPushToken()
  if (!token) return

  // Foreground notification listener
  Notifications.addNotificationReceivedListener((notification) => {
    console.log('[notifications] received:', notification.request.content.data)
  })

  // Tap / interaction listener — routes to correct screen
  Notifications.addNotificationResponseReceivedListener((response) => {
    onNotificationTap(response.notification)
  })
}

// ── Register push token ───────────────────────

export async function registerPushToken(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[notifications] Permission denied')
    return null
  }

  // Android channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:           'LocalLoop',
      importance:     Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:     '#16a34a',
    })
    await Notifications.setNotificationChannelAsync('swaps', {
      name:           'Spot requests',
      importance:     Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:     '#f59e0b',
    })
    await Notifications.setNotificationChannelAsync('jobs', {
      name:           'New listings',
      importance:     Notifications.AndroidImportance.DEFAULT,
      lightColor:     '#16a34a',
    })
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  })

  const token = tokenData.data
  await upsertDeviceSession(token)
  return token
}

// ── Upsert device session ─────────────────────

async function upsertDeviceSession(pushToken: string) {
  const user = useAuthStore.getState().user
  if (!user) return

  const platform = Platform.OS as 'ios' | 'android' | 'web'

  await supabase.from('device_sessions').upsert(
    {
      user_id:      user.id,
      push_token:   pushToken,
      platform,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,platform' }
  )
}

// ── Notification tap router ───────────────────
// Returns a route string for expo-router based on
// the notification's data payload.

export function resolveNotificationRoute(
  notification: Notifications.Notification
): string | null {
  const data = notification.request.content.data as Record<string, any>

  switch (data?.type) {
    case 'swap_request':
    case 'swap_approved':
    case 'swap_declined':
    case 'swap_expiring':
    case 'swap_extension_request':
    case 'swap_available':
      return '/tabs/circle'

    case 'introduction_received':
      return data.listing_id ? `/listings/${data.listing_id}` : '/tabs/listings'

    case 'listing_posted':
      return '/tabs/map'

    case 'job_fair_announced':
    case 'job_fair_live':
      return '/tabs/map'

    case 'circle_request':
      return '/tabs/circle'

    case 'radius_milestone':
      return '/tabs/circle'

    default:
      return null
  }
}
