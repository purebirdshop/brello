// mobile/store/circleStore.ts
// All circle and swap state lives here.

import { create } from 'zustand'

export interface CircleMemberView {
  circle_member_id:    string
  hunter_profile_id:  string
  display_name:       string
  avatar_url:         string | null
  bio:                string | null
  swap_status:        'available' | 'swap_locked'
  quality_weight:     number
  completed_swaps:    number
  radius_miles:       number
  status:             'pending' | 'accepted' | 'removed'
  i_am_requester:     boolean   // true = I sent the request
}

export interface NearbyCircleMember {
  member_hunter_id: string
  display_name:     string
  avatar_url:       string | null
  swap_status:      'available' | 'swap_locked'
  distance_miles:   number
}

export interface ActiveSwap {
  id:                  string
  requester_id:        string
  granter_id:          string
  listing_id:          string
  status:              string
  granter_display_lat: number
  granter_display_lng: number
  expires_at:          string
  extended_expires_at: string | null
}

interface CircleState {
  members:            CircleMemberView[]
  pendingIncoming:    CircleMemberView[]   // requests I need to accept/decline
  pendingOutgoing:    CircleMemberView[]   // requests I sent, awaiting response
  nearbyForListing:   NearbyCircleMember[] // members near a specific listing
  activeSwap:         ActiveSwap | null
  loadingMembers:     boolean
  loadingNearby:      boolean

  setMembers:          (members: CircleMemberView[]) => void
  setPendingIncoming:  (members: CircleMemberView[]) => void
  setPendingOutgoing:  (members: CircleMemberView[]) => void
  setNearbyForListing: (members: NearbyCircleMember[]) => void
  setActiveSwap:       (swap: ActiveSwap | null) => void
  setLoadingMembers:   (v: boolean) => void
  setLoadingNearby:    (v: boolean) => void
  updateMemberStatus:  (circleId: string, status: CircleMemberView['status']) => void
}

export const useCircleStore = create<CircleState>((set) => ({
  members:           [],
  pendingIncoming:   [],
  pendingOutgoing:   [],
  nearbyForListing:  [],
  activeSwap:        null,
  loadingMembers:    false,
  loadingNearby:     false,

  setMembers:          (members)  => set({ members }),
  setPendingIncoming:  (members)  => set({ pendingIncoming: members }),
  setPendingOutgoing:  (members)  => set({ pendingOutgoing: members }),
  setNearbyForListing: (members)  => set({ nearbyForListing: members }),
  setActiveSwap:       (swap)     => set({ activeSwap: swap }),
  setLoadingMembers:   (v)        => set({ loadingMembers: v }),
  setLoadingNearby:    (v)        => set({ loadingNearby: v }),
  updateMemberStatus:  (id, status) =>
    set((s) => ({
      members: s.members.map((m) =>
        m.circle_member_id === id ? { ...m, status } : m
      ),
      pendingIncoming: s.pendingIncoming.filter((m) => m.circle_member_id !== id),
    })),
}))
