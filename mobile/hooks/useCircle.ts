// mobile/hooks/useCircle.ts
// Loads circle members, pending requests, and active swap.
// Subscribes to Supabase Realtime for live swap status updates.

import { useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useCircleStore, CircleMemberView } from '../store/circleStore'

export function useCircle() {
  const { hunterProfile } = useAuthStore()
  const {
    setMembers,
    setPendingIncoming,
    setPendingOutgoing,
    setActiveSwap,
    setLoadingMembers,
    updateMemberStatus,
  } = useCircleStore()

  const fetchCircle = useCallback(async () => {
    if (!hunterProfile?.id) return
    setLoadingMembers(true)

    try {
      // Fetch all circle relationships for this hunter
      const { data, error } = await supabase
        .from('circle_members')
        .select(`
          id,
          requester_id,
          recipient_id,
          status,
          quality_weight,
          completed_swaps,
          requester:hunter_profiles!circle_members_requester_id_fkey (
            id, display_name, avatar_url, bio, swap_status, radius_miles
          ),
          recipient:hunter_profiles!circle_members_recipient_id_fkey (
            id, display_name, avatar_url, bio, swap_status, radius_miles
          )
        `)
        .or(`requester_id.eq.${hunterProfile.id},recipient_id.eq.${hunterProfile.id}`)

      if (error) throw error

      const accepted:  CircleMemberView[] = []
      const incoming:  CircleMemberView[] = []
      const outgoing:  CircleMemberView[] = []

      for (const row of (data ?? [])) {
        const iAmRequester = row.requester_id === hunterProfile.id
        const other = iAmRequester
          ? (row.recipient as any)
          : (row.requester as any)

        if (!other) continue

        const view: CircleMemberView = {
          circle_member_id:   row.id,
          hunter_profile_id:  other.id,
          display_name:       other.display_name,
          avatar_url:         other.avatar_url,
          bio:                other.bio,
          swap_status:        other.swap_status,
          quality_weight:     row.quality_weight,
          completed_swaps:    row.completed_swaps,
          radius_miles:       other.radius_miles,
          status:             row.status,
          i_am_requester:     iAmRequester,
        }

        if (row.status === 'accepted') {
          accepted.push(view)
        } else if (row.status === 'pending') {
          if (iAmRequester) outgoing.push(view)
          else              incoming.push(view)
        }
      }

      setMembers(accepted)
      setPendingIncoming(incoming)
      setPendingOutgoing(outgoing)
    } catch (err) {
      console.error('[useCircle] fetch error:', err)
    } finally {
      setLoadingMembers(false)
    }
  }, [hunterProfile?.id])

  const fetchActiveSwap = useCallback(async () => {
    if (!hunterProfile?.id) return

    const { data } = await supabase
      .from('swap_requests')
      .select('*')
      .or(`requester_id.eq.${hunterProfile.id},granter_id.eq.${hunterProfile.id}`)
      .eq('status', 'active')
      .maybeSingle()

    setActiveSwap(data ?? null)
  }, [hunterProfile?.id])

  // Initial load
  useEffect(() => {
    fetchCircle()
    fetchActiveSwap()
  }, [hunterProfile?.id])

  // Realtime: circle_members changes
  useEffect(() => {
    if (!hunterProfile?.id) return

    const channel = supabase
      .channel(`circle:${hunterProfile.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'circle_members',
          filter: `requester_id=eq.${hunterProfile.id}`,
        },
        () => fetchCircle()
      )
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'circle_members',
          filter: `recipient_id=eq.${hunterProfile.id}`,
        },
        () => fetchCircle()
      )
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'swap_requests',
          filter: `requester_id=eq.${hunterProfile.id}`,
        },
        () => fetchActiveSwap()
      )
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'swap_requests',
          filter: `granter_id=eq.${hunterProfile.id}`,
        },
        () => fetchActiveSwap()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [hunterProfile?.id])

  return { fetchCircle, fetchActiveSwap }
}
