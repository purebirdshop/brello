// api/routes/introductions.ts
// Handles the full introduction lifecycle:
//   POST /introductions/upload-url     — get Mux direct upload URL
//   POST /introductions                — submit introduction record
//   GET  /introductions/history        — hunter's own history
//   GET  /introductions/listing/:id    — employer view of a listing's intros
//   POST /introductions/:id/view       — employer marks viewed
//   POST /introductions/:id/status     — employer sets status
//   POST /introductions/:id/note       — employer adds a note
//   POST /introductions/:id/resubmit   — hunter resubmits (within window)
//   GET  /introductions/:id/playback   — get signed Mux URL for playback

import { Router, Request, Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import {
  createUploadUrl,
  getAssetInfo,
  getSignedPlaybackUrl,
  getSignedThumbnailUrl,
} from '../services/muxService'
import { generateWatermarkedDownloadUrl } from '../services/muxStitchService'
import { notifyListingPosted } from '../services/notificationService'

export const introductionsRouter = Router()
introductionsRouter.use(requireAuth)

const RESUBMIT_WINDOW_HOURS = 48

// ── POST /introductions/upload-url ───────────
// Returns a direct Mux upload URL. The client uploads
// the stitched video blob directly — never via our servers.

introductionsRouter.post('/upload-url', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', userId)
    .single()

  const username = user?.email?.split('@')[0] ?? userId.slice(0, 8)

  try {
    const { uploadId, uploadUrl } = await createUploadUrl(username)
    return res.json({ upload_id: uploadId, upload_url: uploadUrl })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create upload URL' })
  }
})

// ── POST /introductions ───────────────────────
// Called after the client has uploaded to Mux.
// Creates video_media and video_applications rows.

introductionsRouter.post('/', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const {
    listing_id,
    mux_upload_id,
    mux_asset_id,
    prompt_ids_used,
    swap_used_id,
    duration_seconds,
  } = req.body

  if (!listing_id || !mux_upload_id) {
    return res.status(400).json({ error: 'listing_id and mux_upload_id required' })
  }

  // Get hunter profile
  const { data: hunter } = await supabaseAdmin
    .from('hunter_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!hunter) return res.status(404).json({ error: 'Hunter profile not found' })

  // Check for existing introduction to this listing
  const { data: existing } = await supabaseAdmin
    .from('video_applications')
    .select('id, submitted_at, repeat_count')
    .eq('listing_id', listing_id)
    .eq('hunter_id', hunter.id)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Check employer resubmission cap
  const { data: listing } = await supabaseAdmin
    .from('job_listings')
    .select('resubmission_cap, employer_location_id, title')
    .eq('id', listing_id)
    .single()

  if (existing && listing?.resubmission_cap != null) {
    const repeatCount = (existing.repeat_count ?? 0) + 1
    if (repeatCount > listing.resubmission_cap) {
      return res.status(409).json({
        error: `This employer has limited resubmissions to ${listing.resubmission_cap}.`,
      })
    }
  }

  // Create video_media row (transcode status pending until Mux webhook)
  const { data: media, error: mediaError } = await supabaseAdmin
    .from('video_media')
    .insert({
      hunter_id:        hunter.id,
      raw_url:          `mux:${mux_upload_id}`,
      mux_asset_id:     mux_asset_id ?? null,
      duration_seconds: duration_seconds ?? null,
      transcode_status: mux_asset_id ? 'processing' : 'pending',
    })
    .select()
    .single()

  if (mediaError) return res.status(500).json({ error: 'Media record failed' })

  // Create introduction record
  const { data: application, error: appError } = await supabaseAdmin
    .from('video_applications')
    .insert({
      listing_id,
      hunter_id:       hunter.id,
      video_media_id:  media.id,
      swap_used_id:    swap_used_id ?? null,
      prompt_ids_used: prompt_ids_used ?? [],
      status:          'sent',
    })
    .select()
    .single()

  if (appError) return res.status(500).json({ error: 'Introduction record failed' })

  // Award circle points for introduction submitted
  await supabaseAdmin.from('circle_point_logs').insert({
    hunter_id:    hunter.id,
    reason:       'introduction_submitted',
    delta:        1,
    reference_id: application.id,
  })
  await supabaseAdmin.rpc('increment_circle_points', {
    p_hunter_id: hunter.id,
    p_delta:     1,
  })

  // If applied via swap and intro submitted → complete the swap
  if (swap_used_id) {
    await supabaseAdmin
      .from('swap_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', swap_used_id)

    await supabaseAdmin
      .from('hunter_profiles')
      .update({ swap_status: 'available' })
      .eq('id', hunter.id)
  }

  return res.json({ application, media })
})

// ── POST /introductions/mux-webhook ───────────
// Mux sends this when an asset finishes processing.
// Updates video_media with playback ID and thumbnail.

introductionsRouter.post('/mux-webhook', async (req: Request, res: Response) => {
  // Verify Mux webhook signature in production
  const event = req.body
  if (event.type !== 'video.asset.ready') return res.json({ ok: true })

  const assetId = event.data?.id
  if (!assetId) return res.json({ ok: true })

  const info = await getAssetInfo(assetId)

  await supabaseAdmin
    .from('video_media')
    .update({
      mux_asset_id:     info.assetId,
      mux_playback_id:  info.playbackId,
      playback_url:     info.playbackId
        ? `https://stream.mux.com/${info.playbackId}.m3u8`
        : null,
      thumbnail_url:    info.thumbUrl,
      duration_seconds: info.duration ? Math.round(info.duration) : null,
      transcode_status: 'ready',
    })
    .eq('mux_asset_id', assetId)

  return res.json({ ok: true })
})

// ── GET /introductions/history ────────────────
// Hunter's own introduction history, newest first.

introductionsRouter.get('/history', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest

  const { data: hunter } = await supabaseAdmin
    .from('hunter_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!hunter) return res.status(404).json({ error: 'Not found' })

  const { data, error } = await supabaseAdmin
    .from('video_applications')
    .select(`
      id,
      status,
      is_repeat,
      repeat_count,
      submitted_at,
      video_media (
        thumbnail_url,
        playback_url,
        duration_seconds,
        transcode_status,
        mux_playback_id
      ),
      job_listings (
        id,
        title,
        employer_locations (
          name,
          address,
          display_lat,
          display_lng,
          employer_profiles ( business_name, logo_url )
        )
      )
    `)
    .eq('hunter_id', hunter.id)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ history: data })
})

// ── GET /introductions/listing/:id ────────────
// Employer view: all introductions for a listing.

introductionsRouter.get('/listing/:id', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const listingId  = req.params.id

  // Verify user is an employer member for this listing's location
  const { data: access } = await supabaseAdmin
    .from('job_listings')
    .select(`
      employer_locations (
        employer_id,
        employer_members!inner ( user_id )
      )
    `)
    .eq('id', listingId)
    .single()

  const hasAccess = (access as any)
    ?.employer_locations
    ?.employer_members
    ?.some((m: any) => m.user_id === userId)

  if (!hasAccess) return res.status(403).json({ error: 'Access denied' })

  const { data, error } = await supabaseAdmin
    .from('video_applications')
    .select(`
      id,
      status,
      is_repeat,
      repeat_count,
      submitted_at,
      employer_notes,
      employer_status,
      video_media (
        thumbnail_url,
        duration_seconds,
        transcode_status,
        mux_playback_id
      ),
      hunter_profiles (
        id,
        display_name,
        avatar_url,
        bio,
        linkedin_url,
        github_url
      )
    `)
    .eq('listing_id', listingId)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ introductions: data })
})

// ── GET /introductions/:id/playback ───────────
// Returns a signed Mux playback URL (employer or hunter own).

introductionsRouter.get('/:id/playback', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest

  const { data: app } = await supabaseAdmin
    .from('video_applications')
    .select(`
      id,
      hunter_id,
      video_media ( mux_playback_id ),
      job_listings (
        employer_locations (
          employer_members ( user_id )
        )
      )
    `)
    .eq('id', req.params.id)
    .single()

  if (!app) return res.status(404).json({ error: 'Not found' })

  // Allow hunter (own) or employer member
  const { data: hunter } = await supabaseAdmin
    .from('hunter_profiles').select('id').eq('user_id', userId).single()

  const isOwner    = hunter?.id === (app as any).hunter_id
  const isEmployer = (app as any).job_listings?.employer_locations?.employer_members
    ?.some((m: any) => m.user_id === userId)

  if (!isOwner && !isEmployer) return res.status(403).json({ error: 'Access denied' })

  const playbackId = (app as any).video_media?.mux_playback_id
  if (!playbackId) return res.status(404).json({ error: 'Video not ready' })

  const url   = await getSignedPlaybackUrl(playbackId)
  const thumb = await getSignedThumbnailUrl(playbackId)

  // For hunter's own video, also provide a watermarked download URL
  let watermarked_url: string | null = null
  if (isOwner) {
    const { data: userRow } = await supabaseAdmin
      .from('users').select('email').eq('id', userId).single()
    const username = userRow?.email?.split('@')[0] ?? 'hunter'
    watermarked_url = await generateWatermarkedDownloadUrl(playbackId, username)
  }

  return res.json({ playback_url: url, thumbnail_url: thumb, watermarked_url })
})

// ── POST /introductions/:id/view ──────────────
// Employer marks introduction as viewed.

introductionsRouter.post('/:id/view', async (req: Request, res: Response) => {
  await supabaseAdmin
    .from('video_applications')
    .update({ status: 'viewed' })
    .eq('id', req.params.id)
    .eq('status', 'sent')   // only upgrade, never downgrade

  return res.json({ status: 'viewed' })
})

// ── POST /introductions/:id/status ────────────
// Employer sets employer_status: follow_up | move_forward | modest_match | passed

introductionsRouter.post('/:id/status', async (req: Request, res: Response) => {
  const { employer_status } = req.body
  const allowed = ['follow_up', 'move_forward', 'modest_match', 'passed', 'shortlisted']

  if (!allowed.includes(employer_status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  await supabaseAdmin
    .from('video_applications')
    .update({ employer_status })
    .eq('id', req.params.id)

  return res.json({ employer_status })
})

// ── POST /introductions/:id/note ──────────────
// Employer appends a note to the feedback log.

introductionsRouter.post('/:id/note', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const { note }   = req.body

  if (!note?.trim()) return res.status(400).json({ error: 'Note required' })

  // Fetch existing notes
  const { data: app } = await supabaseAdmin
    .from('video_applications')
    .select('employer_notes')
    .eq('id', req.params.id)
    .single()

  const existing = (app?.employer_notes as any[]) ?? []
  const newNote  = {
    user_id:    userId,
    text:       note.trim(),
    created_at: new Date().toISOString(),
  }

  await supabaseAdmin
    .from('video_applications')
    .update({ employer_notes: [...existing, newNote] })
    .eq('id', req.params.id)

  return res.json({ note: newNote })
})

// ── POST /introductions/:id/phase ────────────
// Registers a single phase upload for an introduction.
// Called after each of the 3 phase clips is uploaded to Mux.
// When all 3 are registered and ready, the DB trigger enqueues
// the stitch job automatically.

introductionsRouter.post('/:id/phase', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const { phase_index, mux_upload_id, mux_asset_id, prompt_id, prompt_text, duration_seconds } = req.body

  if (phase_index == null || !mux_upload_id) {
    return res.status(400).json({ error: 'phase_index and mux_upload_id required' })
  }

  const { data: hunter } = await supabaseAdmin
    .from('hunter_profiles').select('id').eq('user_id', userId).single()
  if (!hunter) return res.status(404).json({ error: 'Not found' })

  // Verify this application belongs to the hunter
  const { data: app } = await supabaseAdmin
    .from('video_applications')
    .select('id')
    .eq('id', req.params.id)
    .eq('hunter_id', hunter.id)
    .single()

  if (!app) return res.status(404).json({ error: 'Introduction not found' })

  const { data: phase, error } = await supabaseAdmin
    .from('introduction_phases')
    .upsert({
      application_id:   req.params.id,
      phase_index,
      mux_upload_id,
      mux_asset_id:     mux_asset_id ?? null,
      prompt_id:        prompt_id ?? null,
      prompt_text:      prompt_text ?? null,
      duration_seconds: duration_seconds ?? null,
      transcode_status: mux_asset_id ? 'processing' : 'pending',
    }, { onConflict: 'application_id,phase_index' })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ phase })
})

// ── POST /introductions/:id/resubmit ─────────
// Hunter resubmits within the 48-hour window.
// Checks resubmission cap set by employer.

introductionsRouter.post('/:id/resubmit', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const { new_mux_upload_id, prompt_ids_used, duration_seconds } = req.body

  const { data: hunter } = await supabaseAdmin
    .from('hunter_profiles').select('id').eq('user_id', userId).single()
  if (!hunter) return res.status(404).json({ error: 'Not found' })

  const { data: original } = await supabaseAdmin
    .from('video_applications')
    .select('id, listing_id, submitted_at, repeat_count, job_listings(resubmission_cap)')
    .eq('id', req.params.id)
    .eq('hunter_id', hunter.id)
    .single()

  if (!original) return res.status(404).json({ error: 'Introduction not found' })

  // Check time window
  const submittedAt  = new Date(original.submitted_at).getTime()
  const windowMs     = RESUBMIT_WINDOW_HOURS * 3_600_000
  if (Date.now() - submittedAt > windowMs) {
    return res.status(409).json({
      error: `Resubmission window (${RESUBMIT_WINDOW_HOURS}h) has closed.`,
    })
  }

  // Check employer cap
  const cap = (original as any).job_listings?.resubmission_cap
  if (cap != null && (original.repeat_count ?? 0) >= cap) {
    return res.status(409).json({ error: `Resubmission limit of ${cap} reached.` })
  }

  // Create new media + application
  const { data: media } = await supabaseAdmin
    .from('video_media')
    .insert({
      hunter_id:        hunter.id,
      raw_url:          `mux:${new_mux_upload_id}`,
      duration_seconds: duration_seconds ?? null,
      transcode_status: 'pending',
    })
    .select()
    .single()

  const { data: newApp } = await supabaseAdmin
    .from('video_applications')
    .insert({
      listing_id:      original.listing_id,
      hunter_id:       hunter.id,
      video_media_id:  media!.id,
      prompt_ids_used: prompt_ids_used ?? [],
      status:          'sent',
      is_repeat:       true,
      repeat_count:    (original.repeat_count ?? 0) + 1,
    })
    .select()
    .single()

  return res.json({ application: newApp })
})
