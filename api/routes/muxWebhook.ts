// api/routes/muxWebhook.ts
// Standalone Mux webhook handler.
// Processes video.asset.ready events:
//   1. Updates introduction_phases row with playback ID
//   2. If it was a phase upload (not a stitch), checks if all 3 are ready
//   3. Stitch trigger is handled by DB trigger (015_stitch_queue.sql)

import { Router, Request, Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'

export const muxWebhookRouter = Router()

muxWebhookRouter.post('/', async (req: Request, res: Response) => {
  const event = req.body

  // In production: verify Mux webhook signature using
  // the Mux-Signature header and your webhook signing secret.
  // For now we trust the payload structure.

  if (event.type !== 'video.asset.ready') {
    return res.json({ ok: true, ignored: true })
  }

  const asset = event.data
  if (!asset?.id) return res.json({ ok: true })

  const assetId    = asset.id
  const playbackId = asset.playback_ids?.[0]?.id
  const duration   = asset.duration ? Math.round(asset.duration) : null
  const thumbUrl   = playbackId
    ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=0`
    : null

  // ── Update introduction_phases row if this is a phase asset ──
  const { data: phaseRow } = await supabaseAdmin
    .from('introduction_phases')
    .select('id, application_id, phase_index')
    .eq('mux_asset_id', assetId)
    .maybeSingle()

  if (phaseRow) {
    // Update phase with playback info
    await supabaseAdmin
      .from('introduction_phases')
      .update({
        mux_playback_id:  playbackId,
        duration_seconds: duration,
        transcode_status: 'ready',
      })
      .eq('id', phaseRow.id)

    // DB trigger (trg_maybe_enqueue_stitch) fires automatically
    // to check if all 3 phases are ready and enqueue the stitch job.
    return res.json({ ok: true, phase: phaseRow.phase_index })
  }

  // ── Update video_media row if this is a stitched / standalone asset ──
  const { data: mediaRow } = await supabaseAdmin
    .from('video_media')
    .select('id')
    .eq('mux_asset_id', assetId)
    .maybeSingle()

  if (mediaRow) {
    await supabaseAdmin
      .from('video_media')
      .update({
        mux_playback_id:  playbackId,
        playback_url:     playbackId
          ? `https://stream.mux.com/${playbackId}.m3u8`
          : null,
        thumbnail_url:    thumbUrl,
        duration_seconds: duration,
        transcode_status: 'ready',
      })
      .eq('id', mediaRow.id)

    return res.json({ ok: true, media: mediaRow.id })
  }

  // Asset not found in our DB — could be a test upload, ignore gracefully
  console.warn(`[muxWebhook] Unknown asset ${assetId} — no matching phase or media row`)
  return res.json({ ok: true, unknown: true })
})
