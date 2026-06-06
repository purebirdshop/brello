// api/services/muxService.ts
// Wraps the Mux Node SDK for:
//   - Generating direct upload URLs (client uploads directly to Mux)
//   - Fetching asset/playback info after upload completes
//   - Creating watermarked playback IDs

import Mux from '@mux/mux-node'

const mux = new Mux({
  tokenId:     process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

// ── Create a direct upload URL ────────────────
// The mobile client uploads directly to Mux — never via our API.
// We get the asset ID from the webhook once processing completes.

export async function createUploadUrl(hunterUsername: string): Promise<{
  uploadId:  string
  uploadUrl: string
}> {
  const upload = await mux.video.uploads.create({
    cors_origin: '*',
    new_asset_settings: {
      playback_policy: ['signed'],    // signed URLs only — not public
      passthrough:     hunterUsername,  // stored on the asset for watermark reference
      mp4_support:     'capped-1080p', // enable download
    },
  })

  return {
    uploadId:  upload.id,
    uploadUrl: upload.url,
  }
}

// ── Get asset info ────────────────────────────
// Called after the Mux webhook confirms the asset is ready.

export async function getAssetInfo(assetId: string) {
  const asset = await mux.video.assets.retrieve(assetId)
  return {
    assetId:    asset.id,
    playbackId: asset.playback_ids?.[0]?.id ?? null,
    duration:   asset.duration ?? null,
    status:     asset.status,
    thumbUrl:   asset.playback_ids?.[0]
      ? `https://image.mux.com/${asset.playback_ids[0].id}/thumbnail.jpg?time=0`
      : null,
  }
}

// ── Generate a signed playback URL ───────────────
// Employers get a time-limited signed URL — not a raw playback ID.
// Token expires in 24 hours.

export async function getSignedPlaybackUrl(
  playbackId: string,
  expirySeconds: number = 86400
): Promise<string> {
  const token = await mux.jwt.signPlaybackId(playbackId, {
    type:       'video',
    expiration: `${expirySeconds}s`,
  })

  return `https://stream.mux.com/${playbackId}.m3u8?token=${token}`
}

// ── Generate a signed thumbnail URL ──────────────

export async function getSignedThumbnailUrl(
  playbackId: string,
  timeSeconds: number = 0
): Promise<string> {
  const token = await mux.jwt.signPlaybackId(playbackId, {
    type:       'thumbnail',
    expiration: '24h',
    params:     { time: timeSeconds },
  })

  return `https://image.mux.com/${playbackId}/thumbnail.jpg?token=${token}`
}
