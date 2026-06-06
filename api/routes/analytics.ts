// api/routes/analytics.ts
// Employer analytics endpoints:
//   GET /analytics/locations          — summary stats for all locations
//   GET /analytics/locations/:id      — 30-day snapshot series for one location
//   GET /analytics/locations/:id/intros — introduction status breakdown

import { Router, Request, Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'

export const analyticsRouter = Router()
analyticsRouter.use(requireAuth)

async function getEmployerId(userId: string): Promise<string | null> {
  const { data: direct } = await supabaseAdmin
    .from('employer_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (direct) return direct.id

  const { data: member } = await supabaseAdmin
    .from('employer_members')
    .select('employer_id')
    .eq('user_id', userId)
    .single()

  return member?.employer_id ?? null
}

// ── GET /analytics/locations ──────────────────
// Returns current snapshot for all locations.

analyticsRouter.get('/locations', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const employerId = await getEmployerId(userId)
  if (!employerId) return res.status(403).json({ error: 'No employer profile' })

  const { data: locations } = await supabaseAdmin
    .from('employer_locations')
    .select(`
      id,
      name,
      address,
      follower_count,
      is_active,
      job_listings(count)
    `)
    .eq('employer_id', employerId)
    .is('deleted_at', null)

  // Get today's snapshots
  const today = new Date().toISOString().split('T')[0]
  const { data: snapshots } = await supabaseAdmin
    .from('location_analytics_snapshots')
    .select('*')
    .in(
      'employer_location_id',
      (locations ?? []).map((l: any) => l.id)
    )
    .eq('snapshot_date', today)

  const snapshotMap = new Map(
    (snapshots ?? []).map((s: any) => [s.employer_location_id, s])
  )

  const result = (locations ?? []).map((loc: any) => {
    const snap = snapshotMap.get(loc.id)
    return {
      ...loc,
      today_new_intros:    snap?.new_intro_count      ?? 0,
      total_intros:        snap?.total_intro_count    ?? 0,
      active_listings:     snap?.active_listing_count ?? 0,
    }
  })

  return res.json({ locations: result })
})

// ── GET /analytics/locations/:id ─────────────
// Returns 30-day snapshot series for charts.

analyticsRouter.get('/locations/:id', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const employerId = await getEmployerId(userId)
  if (!employerId) return res.status(403).json({ error: 'No employer profile' })

  // Verify location belongs to employer
  const { data: loc } = await supabaseAdmin
    .from('employer_locations')
    .select('id, name')
    .eq('id', req.params.id)
    .eq('employer_id', employerId)
    .single()

  if (!loc) return res.status(404).json({ error: 'Location not found' })

  const { data: snapshots } = await supabaseAdmin
    .from('location_analytics_snapshots')
    .select('snapshot_date, follower_count, active_listing_count, new_intro_count, total_intro_count')
    .eq('employer_location_id', req.params.id)
    .gte('snapshot_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true })

  return res.json({ location: loc, snapshots: snapshots ?? [] })
})

// ── GET /analytics/locations/:id/intros ───────
// Returns introduction status breakdown for a location.

analyticsRouter.get('/locations/:id/intros', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const employerId = await getEmployerId(userId)
  if (!employerId) return res.status(403).json({ error: 'No employer profile' })

  const { data } = await supabaseAdmin
    .from('video_applications')
    .select('employer_status, status')
    .in(
      'listing_id',
      (await supabaseAdmin
        .from('job_listings')
        .select('id')
        .eq('employer_location_id', req.params.id)
        .is('deleted_at', null)
      ).data?.map((l: any) => l.id) ?? []
    )
    .is('deleted_at', null)

  const breakdown: Record<string, number> = {}
  for (const row of (data ?? [])) {
    const key = row.employer_status ?? 'new'
    breakdown[key] = (breakdown[key] ?? 0) + 1
  }

  return res.json({ breakdown, total: data?.length ?? 0 })
})
