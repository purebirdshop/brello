// mobile/hooks/useSwap.ts
// Full swap request lifecycle.
// Initiate, accept, decline, request extension, expire.
// Token deduction is deferred — only spent if no introduction
// is submitted during the swap window.

import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useCircleStore } from '../store/circleStore'
import { SWAP } from '@localloop/shared'

export function useSwap() {
  const { hunterProfile } = useAuthStore()
  const { setActiveSwap, activeSwap } = useCircleStore()

  // ── Request a swap ────────────────────────────
  // Called when a hunter taps "Request spot" on a circle
  // member's card in the NearbyCircleSheet.

  const requestSwap = useCallback(async (
    granterHunterId: string,
    listingId:       string,
    granterLat:      number,
    granterLng:      number,
  ) => {
    if (!hunterProfile) throw new Error('No hunter profile')

    const expiresAt = new Date(
      Date.now() + SWAP.DURATION_MINUTES * 60 * 1000
    ).toISOString()

    // Fuzz the granter location before storing
    const fuzzed = fuzzCoord(granterLat, granterLng)

    const { data, error } = await supabase
      .from('swap_requests')
      .insert({
        requester_id:        hunterProfile.id,
        granter_id:          granterHunterId,
        listing_id:          listingId,
        status:              'pending',
        granter_display_lat: fuzzed.lat,
        granter_display_lng: fuzzed.lng,
        expires_at:          expiresAt,
      })
      .select()
      .single()

    if (error) throw error

    // Lock the requester's swap status immediately
    await supabase
      .from('hunter_profiles')
      .update({ swap_status: 'swap_locked' })
      .eq('id', hunterProfile.id)

    return data
  }, [hunterProfile])

  // ── Accept a swap ─────────────────────────────
  // Called by the granter when they approve the request.

  const acceptSwap = useCallback(async (swapId: string) => {
    if (!hunterProfile) throw new Error('No hunter profile')

    const { data, error } = await supabase
      .from('swap_requests')
      .update({
        status:      'active',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', swapId)
      .eq('granter_id', hunterProfile.id)   // only granter can accept
      .select()
      .single()

    if (error) throw error
    setActiveSwap(data)
    return data
  }, [hunterProfile])

  // ── Decline a swap ────────────────────────────

  const declineSwap = useCallback(async (swapId: string) => {
    if (!hunterProfile) throw new Error('No hunter profile')

    await supabase
      .from('swap_requests')
      .update({ status: 'declined' })
      .eq('id', swapId)
      .or(`granter_id.eq.${hunterProfile.id},requester_id.eq.${hunterProfile.id}`)

    // Unlock requester
    await unlockRequester(swapId)
    setActiveSwap(null)
  }, [hunterProfile])

  // ── Request extension ─────────────────────────
  // Sends extension request — granter must approve within
  // SWAP.EXTENSION_APPROVAL_TIMEOUT_MINUTES or it auto-declines.

  const requestExtension = useCallback(async () => {
    if (!activeSwap) return

    await supabase
      .from('swap_requests')
      .update({ extension_requested_at: new Date().toISOString() })
      .eq('id', activeSwap.id)
  }, [activeSwap])

  // ── Approve extension ─────────────────────────

  const approveExtension = useCallback(async (swapId: string) => {
    const extended = new Date(
      Date.now() + SWAP.EXTENSION_MINUTES * 60 * 1000
    ).toISOString()

    const { data } = await supabase
      .from('swap_requests')
      .update({
        extension_approved_at: new Date().toISOString(),
        extended_expires_at:   extended,
      })
      .eq('id', swapId)
      .select()
      .single()

    if (data) setActiveSwap(data)
  }, [])

  // ── Decline extension ─────────────────────────

  const declineExtension = useCallback(async (swapId: string) => {
    await supabase
      .from('swap_requests')
      .update({ extension_declined_at: new Date().toISOString() })
      .eq('id', swapId)
  }, [])

  // ── Complete / expire a swap ──────────────────
  // Called when the timer reaches zero or after introduction submitted.
  // Deducts token only if no introduction was submitted.

  const completeSwap = useCallback(async (
    swapId:          string,
    introSubmitted:  boolean
  ) => {
    if (!hunterProfile) return

    const newStatus = introSubmitted ? 'completed' : 'expired'

    await supabase
      .from('swap_requests')
      .update({
        status:       newStatus,
        completed_at: new Date().toISOString(),
      })
      .eq('id', swapId)

    // Deduct token only if no intro was submitted
    if (!introSubmitted) {
      await supabase
        .from('swap_token_ledger')
        .update({
          daily_used:  supabase.rpc('increment', { inc: 1 }),  // handled server-side
          last_action: 'spent',
        })
        .eq('hunter_id', hunterProfile.id)
    } else {
      // Award circle points for completed swap
      await supabase.from('circle_point_logs').insert({
        hunter_id:    hunterProfile.id,
        reason:       'swap_completed',
        delta:        2,
        reference_id: swapId,
      })

      await supabase.rpc('increment_circle_points', {
        p_hunter_id: hunterProfile.id,
        p_delta:     2,
      })
    }

    // Unlock requester
    await unlockRequester(swapId)
    setActiveSwap(null)
  }, [hunterProfile])

  // ── Notify when available ─────────────────────
  // When a hunter taps a locked circle member.

  const notifyWhenAvailable = useCallback(async (
    lockedHunterId: string
  ) => {
    if (!hunterProfile) return

    await supabase.from('swap_notify_queue').upsert({
      requesting_hunter_id: hunterProfile.id,
      locked_hunter_id:     lockedHunterId,
      notified_at:          null,
    })
  }, [hunterProfile])

  return {
    requestSwap,
    acceptSwap,
    declineSwap,
    requestExtension,
    approveExtension,
    declineExtension,
    completeSwap,
    notifyWhenAvailable,
  }
}

// ── Helpers ───────────────────────────────────

async function unlockRequester(swapId: string) {
  const { data: swap } = await supabase
    .from('swap_requests')
    .select('requester_id')
    .eq('id', swapId)
    .single()

  if (swap?.requester_id) {
    await supabase
      .from('hunter_profiles')
      .update({ swap_status: 'available' })
      .eq('id', swap.requester_id)
  }
}

function fuzzCoord(lat: number, lng: number) {
  const FUZZ_DEG = 0.005   // ~0.35 miles
  const angle    = Math.random() * 2 * Math.PI
  const dist     = Math.random() * FUZZ_DEG
  return {
    lat: lat + dist * Math.cos(angle),
    lng: lng + dist * Math.sin(angle) / Math.cos((lat * Math.PI) / 180),
  }
}
