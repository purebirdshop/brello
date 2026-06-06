// api/routes/stripe.ts
// Stripe subscription endpoints:
//   POST /stripe/checkout     — create checkout session
//   POST /stripe/portal       — create customer portal session
//   GET  /stripe/plans        — list subscription plans
//   POST /stripe/webhook      — Stripe webhook (no auth, signature verified)

import { Router, Request, Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import {
  createCheckoutSession,
  createPortalSession,
  handleWebhookEvent,
} from '../services/stripeService'

export const stripeRouter = Router()

// ── GET /stripe/plans ─────────────────────────
// Public — no auth required

stripeRouter.get('/plans', async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .order('monthly_price_usd', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ plans: data })
})

// ── POST /stripe/checkout ─────────────────────

stripeRouter.post('/checkout', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const { tier }   = req.body

  if (!tier) return res.status(400).json({ error: 'tier required' })

  // Get employer profile
  const { data: emp } = await supabaseAdmin
    .from('employer_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!emp) return res.status(404).json({ error: 'No employer profile found' })

  try {
    const { url } = await createCheckoutSession({
      employerId: emp.id,
      tier,
      userId,
      successUrl: `${process.env.APP_DEEP_LINK_BASE}/subscription/success`,
      cancelUrl:  `${process.env.APP_DEEP_LINK_BASE}/subscription/cancel`,
    })

    return res.json({ url })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ── POST /stripe/portal ───────────────────────

stripeRouter.post('/portal', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest

  try {
    const { url } = await createPortalSession({
      userId,
      returnUrl: `${process.env.APP_DEEP_LINK_BASE}/subscription`,
    })
    return res.json({ url })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ── POST /stripe/webhook ──────────────────────
// Raw body required — must be registered BEFORE express.json()
// in the main app. We handle that by checking for raw body.

stripeRouter.post(
  '/webhook',
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string

    try {
      // Raw body is available when using express.raw() for this route
      const payload = (req as any).rawBody ?? JSON.stringify(req.body)
      await handleWebhookEvent(payload, sig)
      return res.json({ received: true })
    } catch (err: any) {
      console.error('[stripe webhook]', err.message)
      return res.status(400).json({ error: err.message })
    }
  }
)
