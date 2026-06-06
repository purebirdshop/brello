// api/routes/swaps.ts
// Swap request lifecycle endpoints.
// All state-changing swap operations go through the API
// so business rules (token deduction, locking, points)
// are enforced server-side and can't be bypassed by the client.

import { Router, Request, Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import { SWAP } from '@localloop/shared'
import {
  notifySwapRequest,
  notifySwapApproved,
  notifySwapDeclined,
  notifyExtensionRequest,
  notifyRadiusMilestone,
} from '../services/notificationService'

export const swapsRouter = Router()
swapsRouter.use(requireAuth)

// ── POST /swaps/request ───────────────────────
// Initiates a swap request. Locks the requester immediately.
// Sends a push notification to the granter (Phase 5).

swapsRouter.post('/request', async (req: Request, res: Response) => {
  const { userId, userClient } = req as AuthenticatedRequest
  const { granter_hunter_id, listing_id } = req.body

  if (!granter_hunter_id || !listing_id) {
    return res.status(400).json({ error: 'granter_hunter_id and listing_id required' })
  }

  // Get requester's hunter profile
  const { data: requester } = await supabaseAdmin
    .from('hunter_profiles')
    .select('id, swap_status')
    .eq('user_id', userId)
    .single()

  if (!requester) return res.status(404).json({ error: 'Hunter profile not found' })
  if (requester.swap_status === 'swap_locked') {
    return res.status(409).json({ error: 'You already have an active swap' })
  }

  // Verify granter is in requester's circle
  const { data: circleRel } = await supabaseAdmin
    .from('circle_members')
    .select('id')
    .or(
      `and(requester_id.eq.${requester.id},recipient_id.eq.${granter_hunter_id}),` +
      `and(requester_id.eq.${granter_hunter_id},recipient_id.eq.${requester.id})`
    )
    .eq('status', 'accepted')
    .single()

  if (!circleRel) {
    return res.status(403).json({ error: 'Granter is not in your circle' })
  }

  // Get granter's precise location (server resolves — never client)
  const { data: granter } = await supabaseAdmin
    .from('hunter_profiles')
    .select('current_lat, current_lng, swap_status')
    .eq('id', granter_hunter_id)
    .single()

  if (!granter) return res.status(404).json({ error: 'Granter not found' })
  if (granter.swap_status === 'swap_locked') {
    return res.status(409).json({ error: 'This person is currently swap-locked' })
  }
  if (!granter.current_lat || !granter.current_lng) {
    return res.status(422).json({ error: 'Granter location unavailable' })
  }

  // Fuzz granter location for storage
  const fuzzed = fuzzCoord(granter.current_lat, granter.current_lng)
  const expiresAt = new Date(Date.now() + SWAP.DURATION_MINUTES * 60_000).toISOString()

  // Create swap request
  const { data: swap, error: swapError } = await supabaseAdmin
    .from('swap_requests')
    .insert({
      requester_id:        requester.id,
      granter_id:          granter_hunter_id,
      listing_id,
      status:              'pending',
      granter_display_lat: fuzzed.lat,
      granter_display_lng: fuzzed.lng,
      expires_at:          expiresAt,
    })
    .select()
    .single()

  if (swapError) {
    return res.status(500).json({ error: 'Failed to create swap request' })
  }

  // Lock requester
  await supabaseAdmin
    .from('hunter_profiles')
    .update({ swap_status: 'swap_locked' })
    .eq('id', requester.id)

  // Notify granter
  const { data: requesterUser } = await supabaseAdmin
    .from('users').select('email').eq('id', userId).single()
  const granterUserRow = await supabaseAdmin
    .from('hunter_profiles').select('user_id').eq('id', granter_hunter_id).single()
  if (granterUserRow.data?.user_id) {
    const name = requesterUser?.email?.split('@')[0] ?? 'Someone'
    await notifySwapRequest(granterUserRow.data.user_id, name, swap.id)
  }

  return res.json({ swap })
})

// ── POST /swaps/:id/accept ────────────────────

swapsRouter.post('/:id/accept', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const swapId = req.params.id

  const { data: granterProfile } = await supabaseAdmin
    .from('hunter_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!granterProfile) return res.status(404).json({ error: 'Profile not found' })

  const { data: swap, error } = await supabaseAdmin
    .from('swap_requests')
    .update({ status: 'active', accepted_at: new Date().toISOString() })
    .eq('id', swapId)
    .eq('granter_id', granterProfile.id)
    .eq('status', 'pending')
    .select()
    .single()

  if (error || !swap) {
    return res.status(404).json({ error: 'Swap not found or already actioned' })
  }

  // Notify requester
  const requesterUserRow = await supabaseAdmin
    .from('hunter_profiles').select('user_id').eq('id', swap.requester_id).single()
  if (requesterUserRow.data?.user_id) {
    await notifySwapApproved(requesterUserRow.data.user_id, swap.id)
  }
  return res.json({ swap })
})

// ── POST /swaps/:id/decline ───────────────────

swapsRouter.post('/:id/decline', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const swapId = req.params.id

  const { data: profile } = await supabaseAdmin
    .from('hunter_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!profile) return res.status(404).json({ error: 'Profile not found' })

  const { data: swap } = await supabaseAdmin
    .from('swap_requests')
    .update({ status: 'declined' })
    .or(`granter_id.eq.${profile.id},requester_id.eq.${profile.id}`)
    .eq('id', swapId)
    .select()
    .single()

  if (!swap) return res.status(404).json({ error: 'Swap not found' })

  // Unlock requester
  await supabaseAdmin
    .from('hunter_profiles')
    .update({ swap_status: 'available' })
    .eq('id', swap.requester_id)

  // Notify requester
  const reqUserRow = await supabaseAdmin
    .from('hunter_profiles').select('user_id').eq('id', swap.requester_id).single()
  if (reqUserRow.data?.user_id) {
    await notifySwapDeclined(reqUserRow.data.user_id, swapId)
  }
  return res.json({ status: 'declined' })
})

// ── POST /swaps/:id/extend ────────────────────
// Granter approves an extension request.

swapsRouter.post('/:id/extend', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const swapId = req.params.id

  const { data: profile } = await supabaseAdmin
    .from('hunter_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!profile) return res.status(404).json({ error: 'Profile not found' })

  const extendedExpiry = new Date(
    Date.now() + SWAP.EXTENSION_MINUTES * 60_000
  ).toISOString()

  const { data: swap, error } = await supabaseAdmin
    .from('swap_requests')
    .update({
      extension_approved_at: new Date().toISOString(),
      extended_expires_at:   extendedExpiry,
    })
    .eq('id', swapId)
    .eq('granter_id', profile.id)
    .not('extension_requested_at', 'is', null)
    .select()
    .single()

  if (error || !swap) {
    return res.status(404).json({ error: 'Swap not found or no extension was requested' })
  }

  return res.json({ swap })
})

// ── POST /swaps/:id/complete ──────────────────
// Called when the timer expires server-side or intro is submitted.
// Handles token deduction and circle point award.

swapsRouter.post('/:id/complete', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const { intro_submitted } = req.body
  const swapId = req.params.id

  const { data: profile } = await supabaseAdmin
    .from('hunter_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!profile) return res.status(404).json({ error: 'Profile not found' })

  const newStatus = intro_submitted ? 'completed' : 'expired'

  const { data: swap, error } = await supabaseAdmin
    .from('swap_requests')
    .update({ status: newStatus, completed_at: new Date().toISOString() })
    .eq('id', swapId)
    .eq('requester_id', profile.id)
    .select()
    .single()

  if (error || !swap) return res.status(404).json({ error: 'Swap not found' })

  // Deduct token if no intro submitted
  if (!intro_submitted) {
    await supabaseAdmin
      .from('swap_token_ledger')
      .update({ last_action: 'spent' })
      .eq('hunter_id', profile.id)
  }

  // Award circle points if intro was submitted
  if (intro_submitted) {
    const POINTS = 2
    await supabaseAdmin.from('circle_point_logs').insert({
      hunter_id:    profile.id,
      reason:       'swap_completed',
      delta:        POINTS,
      reference_id: swapId,
    })
    await supabaseAdmin.rpc('increment_circle_points', {
      p_hunter_id: profile.id,
      p_delta:     POINTS,
    })
  }

  // Unlock requester
  await supabaseAdmin
    .from('hunter_profiles')
    .update({ swap_status: 'available' })
    .eq('id', profile.id)

  // Re-evaluate radius milestone and notify if crossed
  const radiusRes = await fetch(`${process.env.API_BASE_URL}/auth/radius`, {
    method:  'POST',
    headers: { Authorization: req.headers.authorization! },
  })
  const radiusData = await radiusRes.json()
  if (radiusData.milestone_hit) {
    await notifyRadiusMilestone(userId, radiusData.radius_miles)
  }

  return res.json({ status: newStatus })
})

// ── Helpers ───────────────────────────────────

function fuzzCoord(lat: number, lng: number) {
  const FUZZ_DEG = 0.005
  const angle    = Math.random() * 2 * Math.PI
  const dist     = Math.random() * FUZZ_DEG
  return {
    lat: lat + dist * Math.cos(angle),
    lng: lng + dist * Math.sin(angle) / Math.cos((lat * Math.PI) / 180),
  }
}
