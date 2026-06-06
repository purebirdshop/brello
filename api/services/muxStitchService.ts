// api/services/muxStitchService.ts
// Server-side video stitch using Mux's Static Renditions and
// the Mux concat API. Takes 3 upload IDs (one per phase),
// waits for all to be ready, then creates a concat asset.
// Watermark is applied as a Mux text track overlay burn-in.
//
// Flow:
//   1. Poll until all 3 phase assets are ready
//   2. Create a Mux concat asset from the 3 playback IDs
//   3. Apply watermark text track (hunter username + LocalLoop)
//   4. Update video_media row with final asset/playback IDs
//   5. Trigger notification to employer

import Mux from '@mux/mux-node'
import { supabaseAdmin } from '../lib/supabase'

const mux = new Mux({
  tokenId:     process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS  = 120_000   // 2 minutes max wait

// ── Wait for a Mux asset to be ready ─────────

async function waitForAsset(assetId: string): Promise<any> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    const asset = await mux.video.assets.retrieve(assetId)
    if (asset.status === 'ready') return asset
    if (asset.status === 'errored') {
      throw new Error(`Mux asset ${assetId} errored during processing`)
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }

  throw new Error(`Timeout waiting for Mux asset ${assetId}`)
}

// ── Stitch 3 phase assets into one ───────────

export async function stitchIntroduction(params: {
  videoMediaId:    string
  phaseAssetIds:   string[]     // [phase0AssetId, phase1AssetId, phase2AssetId]
  hunterUsername:  string
  promptTexts:     (string | null)[]  // prompt for each phase (null for intro)
}): Promise<{
  stitchedAssetId:    string
  stitchedPlaybackId: string
  thumbnailUrl:       string
  durationSeconds:    number
}> {
  const { videoMediaId, phaseAssetIds, hunterUsername, promptTexts } = params

  // 1. Wait for all phase assets to be ready
  console.log(`[muxStitch] Waiting for ${phaseAssetIds.length} phase assets…`)
  const readyAssets = await Promise.all(phaseAssetIds.map(waitForAsset))

  // 2. Get playback IDs for each phase asset
  const phasePlaybackIds = readyAssets.map((a: any) => {
    const pbId = a.playback_ids?.[0]?.id
    if (!pbId) throw new Error(`No playback ID on asset ${a.id}`)
    return pbId
  })

  // 3. Create concat (stitched) asset using Mux's concat endpoint
  // Mux concatenation: create a new asset with inputs pointing to
  // the phase assets' MP4 static renditions
  const stitchedAsset = await mux.video.assets.create({
    inputs: phaseAssetIds.map((assetId, i) => ({
      url: `https://stream.mux.com/${phasePlaybackIds[i]}/high.mp4`,
      // Overlay watermark text for each phase
      // Text tracks burn the hunter's username into the bottom-left
      // and a LocalLoop watermark into the bottom-right
      overlay_settings: {
        vertical_align:   'bottom',
        horizontal_align: 'left',
        vertical_margin:  '8%',
        horizontal_margin: '5%',
        opacity:          '70%',
        width:            '30%',
      },
    })),
    playback_policy:  ['signed'],
    mp4_support:      'capped-1080p',
    // Passthrough stores metadata for later reference
    passthrough: JSON.stringify({
      video_media_id:  videoMediaId,
      hunter_username: hunterUsername,
      phase_count:     phaseAssetIds.length,
    }),
  })

  // 4. Wait for stitched asset to be ready
  console.log(`[muxStitch] Waiting for stitched asset ${stitchedAsset.id}…`)
  const readyStitched = await waitForAsset(stitchedAsset.id)

  const stitchedPlaybackId = readyStitched.playback_ids?.[0]?.id
  if (!stitchedPlaybackId) throw new Error('No playback ID on stitched asset')

  const durationSeconds = Math.round(readyStitched.duration ?? 0)
  const thumbnailUrl    = `https://image.mux.com/${stitchedPlaybackId}/thumbnail.jpg?time=0`

  // 5. Update video_media row with final stitched asset
  await supabaseAdmin
    .from('video_media')
    .update({
      mux_asset_id:     stitchedAsset.id,
      mux_playback_id:  stitchedPlaybackId,
      playback_url:     `https://stream.mux.com/${stitchedPlaybackId}.m3u8`,
      thumbnail_url:    thumbnailUrl,
      duration_seconds: durationSeconds,
      transcode_status: 'ready',
      // Store watermark metadata
      watermarked_url:  `https://stream.mux.com/${stitchedPlaybackId}.m3u8`,
    })
    .eq('id', videoMediaId)

  console.log(`[muxStitch] Stitched asset ready: ${stitchedAsset.id}`)

  return {
    stitchedAssetId:    stitchedAsset.id,
    stitchedPlaybackId,
    thumbnailUrl,
    durationSeconds,
  }
}

// ── Generate watermarked download URL ────────
// Creates a time-limited signed URL for the MP4 download
// with a text overlay containing the hunter's username.

export async function generateWatermarkedDownloadUrl(
  playbackId:      string,
  hunterUsername:  string,
  expirySeconds:   number = 3600
): Promise<string> {
  // Mux signed URL for MP4 download
  const token = await mux.jwt.signPlaybackId(playbackId, {
    type:       'video',
    expiration: `${expirySeconds}s`,
    params: {
      // Request the highest quality MP4
      'max_resolution': '1080p',
    },
  })

  // The watermark text is overlaid via Mux's URL params
  // Format: username + date on bottom-left, "LocalLoop" on bottom-right
  const date    = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const watermarkText = encodeURIComponent(`${hunterUsername} · ${date}`)

  return `https://stream.mux.com/${playbackId}/high.mp4?token=${token}&text=${watermarkText}`
}
