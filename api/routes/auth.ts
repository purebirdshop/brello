// api/routes/auth.ts
// Auth-adjacent endpoints:
//   POST /auth/provision   — called by Supabase webhook on new signup
//                            as a server-side fallback to the mobile
//                            authService.provisionNewUserIfNeeded()
//   POST /auth/radius      — recalculates and saves radius after
//                            circle_points changes

import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import { RADIUS } from '@localloop/shared'
import { Request, Response } from 'express'

export const authRouter = Router()

// ── POST /auth/provision ─────────────────────
// Supabase Auth webhook calls this after a new user signs up.
// Mirrors the mobile-side provisionNewUserIfNeeded() but runs
// server-side so it works even if the app crashes mid-onboarding.

authRouter.post('/provision', async (req: Request, res: Response) => {
  const webhookSecret = req.headers['x-webhook-secret']
  if (webhookSecret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { record } = req.body   // Supabase sends { type, record, old_record }
  if (!record?.id || !record?.email) {
    return res.status(400).json({ error: 'Missing user record' })
  }

  const userId = record.id
  const email  = record.email

  // Idempotent — safe to call multiple times
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', userId)
    .single()

  if (existing) {
    return res.json({ status: 'already_provisioned' })
  }

  // 1. users row
  await supabaseAdmin.from('users').insert({
    id:    userId,
    email,
    role:  'hunter',
  })

  // 2. hunter_profile
  const displayName =
    record.raw_user_meta_data?.full_name ??
    record.raw_user_meta_data?.name ??
    email.split('@')[0]

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('hunter_profiles')
    .insert({
      user_id:       userId,
      display_name:  displayName,
      avatar_url:    record.raw_user_meta_data?.avatar_url ?? null,
      radius_miles:  RADIUS.BASE_MILES,
      circle_points: 0,
    })
    .select()
    .single()

  if (profileError) {
    console.error('[auth/provision] hunter_profile error:', profileError)
    return res.status(500).json({ error: 'Profile creation failed' })
  }

  // 3. onboarding_state
  await supabaseAdmin.from('onboarding_states').insert({
    user_id:         userId,
    current_step:    'profile',
    completed_steps: ['email', 'verify'],
  })

  // 4. swap_token_ledger
  await supabaseAdmin.from('swap_token_ledger').insert({
    hunter_id:  profile.id,
    balance:    0,
    daily_used: 0,
    daily_cap:  null,
  })

  // 5. Founder circle connection
  const founderUserId = process.env.FOUNDER_USER_ID
  if (founderUserId && founderUserId !== userId) {
    const { data: founderProfile } = await supabaseAdmin
      .from('hunter_profiles')
      .select('id')
      .eq('user_id', founderUserId)
      .single()

    if (founderProfile) {
      await supabaseAdmin.from('circle_members').insert({
        requester_id:   founderProfile.id,
        recipient_id:   profile.id,
        status:         'accepted',
        quality_weight: 0.5,
      })

      await supabaseAdmin.from('circle_point_logs').insert({
        hunter_id: profile.id,
        reason:    'member_verified',
        delta:     1,
      })

      await supabaseAdmin
        .from('hunter_profiles')
        .update({ circle_points: 1 })
        .eq('id', profile.id)
    }
  }

  return res.json({ status: 'provisioned', hunterId: profile.id })
})

// ── POST /auth/radius ────────────────────────
// Recalculates the hunter's radius after circle_points change.
// Called by circle service after any point-earning event.

authRouter.post(
  '/radius',
  requireAuth,
  async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('hunter_profiles')
      .select('id, circle_points, radius_miles, role')
      .eq('user_id', userId)
      .single()

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Hunter profile not found' })
    }

    // Alpha/beta users get instant max radius — skip milestone calc
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (['alpha', 'beta'].includes(userRow?.role ?? '')) {
      await supabaseAdmin
        .from('hunter_profiles')
        .update({ radius_miles: RADIUS.MAX_MILES })
        .eq('id', profile.id)

      return res.json({ radius_miles: RADIUS.MAX_MILES, milestone_hit: false })
    }

    // Evaluate milestone
    const { data: milestoneResult } = await supabaseAdmin
      .rpc('evaluate_radius_milestone', { points: profile.circle_points })

    const newRadius = milestoneResult ?? RADIUS.BASE_MILES
    const milestoneHit = newRadius > profile.radius_miles

    if (milestoneHit) {
      await supabaseAdmin
        .from('hunter_profiles')
        .update({ radius_miles: newRadius })
        .eq('id', profile.id)
    }

    return res.json({
      radius_miles:  newRadius,
      milestone_hit: milestoneHit,
      circle_points: profile.circle_points,
    })
  }
)
