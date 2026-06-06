// api/services/stitchWorker.ts
// Polls the stitch_jobs table for pending jobs where all 3
// phase assets are ready, then calls muxStitchService to
// concatenate them into a single stitched asset.
// Called by the Vercel cron every minute alongside the
// notification queue worker.

import { supabaseAdmin } from '../lib/supabase'
import { stitchIntroduction } from './muxStitchService'
import { sendNotification } from './notificationService'

export async function processStitchQueue(): Promise<void> {
  // Fetch pending stitch jobs where all phases are ready
  const { data: jobs, error } = await supabaseAdmin
    .from('stitch_jobs')
    .select(`
      id,
      application_id,
      video_media_id,
      hunter_username,
      introduction_phases (
        phase_index,
        mux_asset_id,
        mux_playback_id,
        prompt_text,
        transcode_status
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5)   // process 5 at a time max

  if (error) {
    console.error('[stitchWorker] fetch error:', error)
    return
  }

  if (!jobs || jobs.length === 0) return

  console.log(`[stitchWorker] processing ${jobs.length} stitch job(s)`)

  for (const job of jobs) {
    await processJob(job)
  }
}

async function processJob(job: any): Promise<void> {
  const jobId = job.id

  // Mark as processing
  await supabaseAdmin
    .from('stitch_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', jobId)

  try {
    const phases = (job.introduction_phases ?? [])
      .sort((a: any, b: any) => a.phase_index - b.phase_index)

    // Verify all 3 phases are ready
    if (phases.length < 3 || phases.some((p: any) => p.transcode_status !== 'ready')) {
      // Not ready yet — reset to pending
      await supabaseAdmin
        .from('stitch_jobs')
        .update({ status: 'pending' })
        .eq('id', jobId)
      return
    }

    const phaseAssetIds  = phases.map((p: any) => p.mux_asset_id)
    const promptTexts    = phases.map((p: any) => p.prompt_text ?? null)

    // Stitch
    const result = await stitchIntroduction({
      videoMediaId:   job.video_media_id,
      phaseAssetIds,
      hunterUsername: job.hunter_username,
      promptTexts,
    })

    // Mark job done
    await supabaseAdmin
      .from('stitch_jobs')
      .update({
        status:       'done',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    // Notify employer that a new introduction is ready to review
    await notifyEmployerNewIntro(job.application_id)

    console.log(`[stitchWorker] job ${jobId} done — stitched asset: ${result.stitchedAssetId}`)

  } catch (err: any) {
    console.error(`[stitchWorker] job ${jobId} failed:`, err.message)

    await supabaseAdmin
      .from('stitch_jobs')
      .update({
        status: 'failed',
        error:  err.message ?? 'Unknown error',
      })
      .eq('id', jobId)
  }
}

async function notifyEmployerNewIntro(applicationId: string) {
  try {
    // Get employer user IDs for this listing
    const { data: app } = await supabaseAdmin
      .from('video_applications')
      .select(`
        listing_id,
        job_listings (
          title,
          employer_locations (
            employer_id,
            employer_members ( user_id )
          )
        )
      `)
      .eq('id', applicationId)
      .single()

    const members = (app as any)
      ?.job_listings?.employer_locations?.employer_members ?? []

    const title = (app as any)?.job_listings?.title ?? 'your listing'

    for (const member of members) {
      await sendNotification({
        recipientUserId: member.user_id,
        type:            'introduction_received',
        referenceId:     applicationId,
        data:            { listing_title: title },
      })
    }
  } catch (err) {
    console.error('[stitchWorker] employer notify error:', err)
  }
}
