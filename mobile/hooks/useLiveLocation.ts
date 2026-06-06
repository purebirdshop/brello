// mobile/hooks/useLiveLocation.ts
// Watches device GPS and keeps hunter_profile.current_lat/lng
// in sync. Updates are throttled to avoid hammering the DB.
// Precise coordinates are stored server-side only —
// display coordinates are always fuzzed by the API/RPC layer.

import { useEffect, useRef } from 'react'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

const UPDATE_INTERVAL_MS    = 60_000   // update DB at most once per minute
const DISTANCE_THRESHOLD_M  = 200      // only update if moved >200 meters

export function useLiveLocation() {
  const { hunterProfile, setHunterProfile } = useAuthStore()
  const lastUpdateRef = useRef<number>(0)
  const lastLatRef    = useRef<number | null>(null)
  const lastLngRef    = useRef<number | null>(null)
  const subRef        = useRef<Location.LocationSubscription | null>(null)

  useEffect(() => {
    if (!hunterProfile?.id) return

    let mounted = true

    async function startWatching() {
      const { status } = await Location.getForegroundPermissionsAsync()
      if (status !== 'granted') return

      subRef.current = await Location.watchPositionAsync(
        {
          accuracy:            Location.Accuracy.Balanced,
          timeInterval:        30_000,   // poll every 30s
          distanceInterval:    100,      // or every 100m
        },
        async (loc) => {
          if (!mounted) return

          const { latitude, longitude } = loc.coords
          const now = Date.now()

          // Throttle: skip if not enough time or distance has passed
          const timePassed = now - lastUpdateRef.current >= UPDATE_INTERVAL_MS
          const distancePassed = lastLatRef.current === null || haversineMeter(
            lastLatRef.current, lastLngRef.current!,
            latitude, longitude
          ) >= DISTANCE_THRESHOLD_M

          if (!timePassed && !distancePassed) return

          lastUpdateRef.current = now
          lastLatRef.current    = latitude
          lastLngRef.current    = longitude

          const { data } = await supabase
            .from('hunter_profiles')
            .update({
              current_lat:         latitude,
              current_lng:         longitude,
              location_updated_at: new Date().toISOString(),
            })
            .eq('id', hunterProfile.id)
            .select()
            .single()

          if (data && mounted) setHunterProfile(data)
        }
      )
    }

    startWatching()

    return () => {
      mounted = false
      subRef.current?.remove()
    }
  }, [hunterProfile?.id])
}

// Inline Haversine in meters for the distance threshold check
function haversineMeter(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R     = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat  = toRad(lat2 - lat1)
  const dLng  = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
