// mobile/hooks/useNearbyCircle.ts
// Fetches circle members who are physically near a given
// employer location. Drives the "People in my circle near
// this listing" bottom sheet.

import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useCircleStore } from '../store/circleStore'

export function useNearbyCircle() {
  const { hunterProfile }    = useAuthStore()
  const { setNearbyForListing, setLoadingNearby } = useCircleStore()

  const fetchNearby = useCallback(async (
    employerLocationId: string,
    proximityMiles:     number = 3.0
  ) => {
    if (!hunterProfile?.id) return

    setLoadingNearby(true)

    try {
      const { data, error } = await supabase.rpc(
        'circle_members_near_location',
        {
          hunter_profile_id:    hunterProfile.id,
          employer_location_id: employerLocationId,
          proximity_miles:      proximityMiles,
        }
      )

      if (error) throw error
      setNearbyForListing(data ?? [])
    } catch (err) {
      console.error('[useNearbyCircle] error:', err)
      setNearbyForListing([])
    } finally {
      setLoadingNearby(false)
    }
  }, [hunterProfile?.id])

  const clearNearby = useCallback(() => {
    setNearbyForListing([])
  }, [])

  return { fetchNearby, clearNearby }
}
