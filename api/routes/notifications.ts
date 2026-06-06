// api/routes/notifications.ts
// Exposes:
//   POST /notifications/process  — cron endpoint, processes the queue
//   GET  /notifications           — fetch current user's notification log
//   POST /notifications/:id/read  — mark one read
//   POST /notifications/read-all  — mark all read

import { Router, Request, Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import { processNotificationQueue } from '../services/notificationWorker'
import { processStitchQueue }        from '../services/stitchWorker'
import { supabaseAdmin }              from '../lib/supabase'

export const notificationsRouter = Router()

// ── POST /notifications/process ──────────────
// Called by Vercel cron (vercel.json schedule) or manually.
// Protected by a shared cron secret, not user JWT.

notificationsRouter.post('/process', async (req: Request, res: Response) => {
  const secret = req.headers['x-cron-secret']
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    await Promise.all([
      processNotificationQueue(),
      processStitchQueue(),
      snapshotAnalytics(),
    ])
    return res.json({ status: 'ok' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ── GET /notifications ────────────────────────

notificationsRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest

    const { data, error } = await supabaseAdmin
      .from('notification_logs')
      .select('*')
      .eq('recipient_user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(50)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ notifications: data })
  }
)

// ── POST /notifications/:id/read ──────────────

notificationsRouter.post(
  '/:id/read',
  requireAuth,
  async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest

    await supabaseAdmin
      .from('notification_logs')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('recipient_user_id', userId)

    return res.json({ status: 'ok' })
  }
)

// ── POST /notifications/read-all ──────────────

notificationsRouter.post(
  '/read-all',
  requireAuth,
  async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest

    await supabaseAdmin
      .from('notification_logs')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_user_id', userId)
      .is('read_at', null)

    return res.json({ status: 'ok' })
  }
)


// ── Analytics snapshot (called by cron) ──────
async function snapshotAnalytics(): Promise<void> {
  try {
    await supabaseAdmin.rpc('snapshot_location_analytics')
  } catch (err) {
    console.error('[cron] analytics snapshot error:', err)
  }
}
