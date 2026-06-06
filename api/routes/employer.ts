// api/routes/employer.ts
// Employer-side endpoints:
//   GET  /employer/profile          — get own employer profile
//   POST /employer/profile          — create employer profile
//   GET  /employer/locations        — list own locations
//   POST /employer/locations        — add a location
//   PUT  /employer/locations/:id    — update a location
//   GET  /employer/listings         — all listings across employer's locations
//   POST /employer/listings         — create a listing (draft)
//   PUT  /employer/listings/:id     — update listing
//   POST /employer/listings/:id/publish — set status = active (requires preview)
//   DELETE /employer/listings/:id   — soft delete

import { Router, Request, Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import { fuzzLocation } from '../lib/geo'
import { notifyLocationFollowers } from '../services/notificationService'

export const employerRouter = Router()
employerRouter.use(requireAuth)

// ── Helper: verify employer membership ───────

async function getEmployerProfile(userId: string) {
  // Check if user has an employer profile directly
  const { data: direct } = await supabaseAdmin
    .from('employer_profiles')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single()

  if (direct) return { profile: direct, role: 'owner' as const }

  // Check via employer_members
  const { data: membership } = await supabaseAdmin
    .from('employer_members')
    .select('employer_id, role, employer_profiles(*)')
    .eq('user_id', userId)
    .single()

  if (membership) {
    return {
      profile: (membership as any).employer_profiles,
      role:    membership.role as 'owner' | 'hr_admin' | 'viewer',
    }
  }

  return null
}

// ── GET /employer/profile ─────────────────────

employerRouter.get('/profile', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const emp = await getEmployerProfile(userId)
  if (!emp) return res.status(404).json({ error: 'No employer profile found' })
  return res.json({ profile: emp.profile, role: emp.role })
})

// ── POST /employer/profile ────────────────────

employerRouter.post('/profile', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const { business_name, description, website, logo_url } = req.body

  if (!business_name?.trim()) {
    return res.status(400).json({ error: 'business_name required' })
  }

  // Create employer profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('employer_profiles')
    .insert({
      user_id:       userId,
      business_name: business_name.trim(),
      description:   description?.trim() ?? null,
      website:       website?.trim() ?? null,
      logo_url:      logo_url ?? null,
    })
    .select()
    .single()

  if (profileError) return res.status(500).json({ error: profileError.message })

  // Create owner membership
  await supabaseAdmin.from('employer_members').insert({
    employer_id: profile.id,
    user_id:     userId,
    role:        'owner',
  })

  // Create free subscription
  await supabaseAdmin.from('employer_subscriptions').insert({
    employer_id: profile.id,
    tier:        'free',
    status:      'active',
  })

  // Update user role to 'employer' (or 'both' if already hunter)
  const { data: userRow } = await supabaseAdmin
    .from('users').select('role').eq('id', userId).single()

  const newRole = userRow?.role === 'hunter' ? 'both' : 'employer'
  await supabaseAdmin.from('users').update({ role: newRole }).eq('id', userId)

  return res.json({ profile })
})

// ── GET /employer/locations ───────────────────

employerRouter.get('/locations', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const emp = await getEmployerProfile(userId)
  if (!emp) return res.status(403).json({ error: 'No employer profile' })

  const { data } = await supabaseAdmin
    .from('employer_locations')
    .select('*')
    .eq('employer_id', emp.profile.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  return res.json({ locations: data ?? [] })
})

// ── POST /employer/locations ──────────────────

employerRouter.post('/locations', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const emp = await getEmployerProfile(userId)
  if (!emp || emp.role === 'viewer') {
    return res.status(403).json({ error: 'Insufficient permissions' })
  }

  const { name, address, lat, lng } = req.body
  if (!name || !address || lat == null || lng == null) {
    return res.status(400).json({ error: 'name, address, lat, lng required' })
  }

  // Fuzz for display
  const fuzzed = fuzzLocation(lat, lng)

  const { data, error } = await supabaseAdmin
    .from('employer_locations')
    .insert({
      employer_id:  emp.profile.id,
      name:         name.trim(),
      address:      address.trim(),
      lat,
      lng,
      display_lat:  fuzzed.lat,
      display_lng:  fuzzed.lng,
      display_mode: 'zip_centroid',
      is_active:    true,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ location: data })
})

// ── PUT /employer/locations/:id ───────────────

employerRouter.put('/locations/:id', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const emp = await getEmployerProfile(userId)
  if (!emp || emp.role === 'viewer') {
    return res.status(403).json({ error: 'Insufficient permissions' })
  }

  const { name, address, lat, lng, is_active } = req.body
  const updates: any = {}

  if (name)      updates.name      = name.trim()
  if (address)   updates.address   = address.trim()
  if (is_active !== undefined) updates.is_active = is_active

  if (lat != null && lng != null) {
    const fuzzed       = fuzzLocation(lat, lng)
    updates.lat        = lat
    updates.lng        = lng
    updates.display_lat = fuzzed.lat
    updates.display_lng = fuzzed.lng
  }

  const { data, error } = await supabaseAdmin
    .from('employer_locations')
    .update(updates)
    .eq('id', req.params.id)
    .eq('employer_id', emp.profile.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ location: data })
})

// ── GET /employer/listings ────────────────────

employerRouter.get('/listings', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const emp = await getEmployerProfile(userId)
  if (!emp) return res.status(403).json({ error: 'No employer profile' })

  const { data } = await supabaseAdmin
    .from('job_listings')
    .select(`
      *,
      employer_locations ( id, name, address )
    `)
    .in(
      'employer_location_id',
      // Sub-select location IDs for this employer
      (await supabaseAdmin
        .from('employer_locations')
        .select('id')
        .eq('employer_id', emp.profile.id)
        .is('deleted_at', null)
      ).data?.map((l: any) => l.id) ?? []
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return res.json({ listings: data ?? [] })
})

// ── POST /employer/listings ───────────────────

employerRouter.post('/listings', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const emp = await getEmployerProfile(userId)
  if (!emp || emp.role === 'viewer') {
    return res.status(403).json({ error: 'Insufficient permissions' })
  }

  const {
    employer_location_id,
    title,
    description,
    tags,
    listing_type,
    closes_at,
    resubmission_cap,
  } = req.body

  if (!employer_location_id || !title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'employer_location_id, title, description required' })
  }

  // Verify location belongs to this employer
  const { data: loc } = await supabaseAdmin
    .from('employer_locations')
    .select('id')
    .eq('id', employer_location_id)
    .eq('employer_id', emp.profile.id)
    .single()

  if (!loc) return res.status(403).json({ error: 'Location not found or access denied' })

  const { data: listing, error } = await supabaseAdmin
    .from('job_listings')
    .insert({
      employer_location_id,
      title:            title.trim(),
      description:      description.trim(),
      tags:             tags ?? [],
      listing_type:     listing_type ?? 'standard',
      status:           'draft',
      closes_at:        closes_at ?? null,
      resubmission_cap: resubmission_cap ?? null,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ listing })
})

// ── PUT /employer/listings/:id ────────────────

employerRouter.put('/listings/:id', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const emp = await getEmployerProfile(userId)
  if (!emp || emp.role === 'viewer') {
    return res.status(403).json({ error: 'Insufficient permissions' })
  }

  const allowed = ['title', 'description', 'tags', 'closes_at', 'resubmission_cap', 'listing_type']
  const updates: any = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }

  const { data, error } = await supabaseAdmin
    .from('job_listings')
    .update(updates)
    .eq('id', req.params.id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ listing: data })
})

// ── POST /employer/listings/:id/publish ───────
// Sets preview_approved_at + status = active.
// This fires the DB trigger that notifies followers.

employerRouter.post('/listings/:id/publish', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const emp = await getEmployerProfile(userId)
  if (!emp || emp.role === 'viewer') {
    return res.status(403).json({ error: 'Insufficient permissions' })
  }

  const now = new Date().toISOString()

  const { data: listing, error } = await supabaseAdmin
    .from('job_listings')
    .update({
      status:              'active',
      preview_approved_at: now,
      posted_at:           now,
    })
    .eq('id', req.params.id)
    .eq('status', 'draft')   // can only publish drafts
    .is('deleted_at', null)
    .select()
    .single()

  if (error || !listing) {
    return res.status(404).json({ error: 'Listing not found or already published' })
  }

  // DB trigger (trg_listing_active_notify) fires automatically
  // to enqueue follower notifications.

  return res.json({ listing })
})

// ── DELETE /employer/listings/:id ─────────────

employerRouter.delete('/listings/:id', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const emp = await getEmployerProfile(userId)
  if (!emp || emp.role === 'viewer') {
    return res.status(403).json({ error: 'Insufficient permissions' })
  }

  await supabaseAdmin
    .from('job_listings')
    .update({ deleted_at: new Date().toISOString(), status: 'closed' })
    .eq('id', req.params.id)
    .is('deleted_at', null)

  return res.json({ status: 'deleted' })
})
