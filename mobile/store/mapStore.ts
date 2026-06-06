// mobile/store/mapStore.ts
// All map-related state. Separate from authStore to keep
// concerns clean. Map, listings, and business layer all live here.

import { create } from 'zustand'

export type MapLayer = 'jobs' | 'businesses'

export interface ListingPin {
  id:                   string
  title:                string
  description:          string
  listing_type:         string
  tags:                 string[]
  posted_at:            string | null
  employer_location_id: string
  location_name:        string
  display_lat:          number
  display_lng:          number
  employer_name:        string
  employer_logo:        string | null
  distance_miles:       number
}

export interface BusinessPin {
  id:             string
  employer_id:    string
  name:           string
  address:        string
  display_lat:    number
  display_lng:    number
  follower_count: number
  employer_name:  string
  employer_logo:  string | null
  distance_miles: number
  is_followed:    boolean
}

interface MapState {
  // Current layer shown on the map
  activeLayer:       MapLayer
  // Job listing pins within radius
  listingPins:       ListingPin[]
  // Business pins within discovery radius
  businessPins:      BusinessPin[]
  // Currently selected pin (drives bottom sheet)
  selectedListingId: string | null
  selectedBusinessId: string | null
  // Loading states
  loadingListings:   boolean
  loadingBusinesses: boolean
  // Whether the map has been centered on the user yet
  mapReady:          boolean
  // Followed location ids for the current session
  followedLocationIds: Set<string>

  // Actions
  setActiveLayer:        (layer: MapLayer) => void
  setListingPins:        (pins: ListingPin[]) => void
  setBusinessPins:       (pins: BusinessPin[]) => void
  setSelectedListing:    (id: string | null) => void
  setSelectedBusiness:   (id: string | null) => void
  setLoadingListings:    (v: boolean) => void
  setLoadingBusinesses:  (v: boolean) => void
  setMapReady:           (v: boolean) => void
  addFollow:             (locationId: string) => void
  removeFollow:          (locationId: string) => void
  setFollowedIds:        (ids: string[]) => void
}

export const useMapStore = create<MapState>((set) => ({
  activeLayer:        'jobs',
  listingPins:        [],
  businessPins:       [],
  selectedListingId:  null,
  selectedBusinessId: null,
  loadingListings:    false,
  loadingBusinesses:  false,
  mapReady:           false,
  followedLocationIds: new Set(),

  setActiveLayer:       (layer)  => set({ activeLayer: layer, selectedListingId: null, selectedBusinessId: null }),
  setListingPins:       (pins)   => set({ listingPins: pins }),
  setBusinessPins:      (pins)   => set({ businessPins: pins }),
  setSelectedListing:   (id)     => set({ selectedListingId: id, selectedBusinessId: null }),
  setSelectedBusiness:  (id)     => set({ selectedBusinessId: id, selectedListingId: null }),
  setLoadingListings:   (v)      => set({ loadingListings: v }),
  setLoadingBusinesses: (v)      => set({ loadingBusinesses: v }),
  setMapReady:          (v)      => set({ mapReady: v }),
  addFollow:            (id)     => set((s) => ({ followedLocationIds: new Set([...s.followedLocationIds, id]) })),
  removeFollow:         (id)     => set((s) => {
    const next = new Set(s.followedLocationIds)
    next.delete(id)
    return { followedLocationIds: next }
  }),
  setFollowedIds:       (ids)    => set({ followedLocationIds: new Set(ids) }),
}))
