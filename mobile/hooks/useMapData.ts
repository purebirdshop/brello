// mobile/hooks/useMapData.ts
// Fetches listings and business locations from Supabase
// whenever the hunter's position or radius changes.
// Debounced so rapid location updates don't spam the DB.

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useMapStore } from '../store/mapStore'

const DEBOUNCE_MS = 800

export function useMapData() {
  const { hunterProfile } = useAuthStore()
  const {
    activeLayer,
    setListingPins,
    setBusinessPins,
    setLoadingListings,
    setLoadingBusinesses,
    setFollowedIds,
  } = useMapStore()

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchListings = useCallback(async (
    lat: number,
    lng: number,
    radius: number
  ) => {
    setLoadingListings(true)
    try {
      const { data, error } = await supabase.rpc('listings_near_point', {
        lat,
        lng,
        radius_miles: radius,
        limit_count:  100,
      })

      if (error) throw error
      setListingPins(data ?? [])
    } catch (err) {
      console.error('[useMapData] listings fetch error:', err)
    } finally {
      setLoadingListings(false)
    }
  }, [])

  const fetchBusinesses = useCallback(async (
    lat: number,
    lng: number,
    radius: number
  ) => {
    setLoadingBusinesses(true)
    try {
      // Businesses use a wider discovery radius (radius + 2 miles)
      const { data, error } = await supabase.rpc('locations_near_point', {
        lat,
        lng,
        radius_miles: radius + 2,
        limit_count:  80,
      })

      if (error) throw error

      // Fetch followed location ids for this hunter
      if (hunterProfile?.id) {
        const { data: follows } = await supabase
          .from('location_follows')
          .select('employer_location_id')
          .eq('hunter_id', hunterProfile.id)

        const followedIds = (follows ?? []).map((f: any) => f.employer_location_id)
        setFollowedIds(followedIds)

        const followedSet = new Set(followedIds)
        setBusinessPins(
          (data ?? []).map((b: any) => ({
            ...b,
            is_followed: followedSet.has(b.id),
          }))
        )
      } else {
        setBusinessPins(data ?? [])
      }
    } catch (err) {
      console.error('[useMapData] businesses fetch error:', err)
    } finally {
      setLoadingBusinesses(false)
    }
  }, [hunterProfile?.id])

  // Re-fetch whenever location or radius changes, debounced
  useEffect(() => {
    if (!hunterProfile?.current_lat || !hunterProfile?.current_lng) return

    const { current_lat, current_lng, radius_miles } = hunterProfile

    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(() => {
      if (activeLayer === 'jobs') {
        fetchListings(current_lat, current_lng, radius_miles)
      } else {
        fetchBusinesses(current_lat, current_lng, radius_miles)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [
    hunterProfile?.current_lat,
    hunterProfile?.current_lng,
    hunterProfile?.radius_miles,
    activeLayer,
  ])

  // Prefetch both layers on first load
  useEffect(() => {
    if (!hunterProfile?.current_lat || !hunterProfile?.current_lng) return
    const { current_lat, current_lng, radius_miles } = hunterProfile
    fetchListings(current_lat, current_lng, radius_miles)
    fetchBusinesses(current_lat, current_lng, radius_miles)
  }, []) // intentionally only on mount
}
