// api/services/stripeService.ts
// Wraps the Stripe SDK for employer subscription management.
// Creates checkout sessions, handles webhooks,
// and syncs subscription status to employer_subscriptions table.

import Stripe from 'stripe'
import { supabaseAdmin } from '../lib/supabase'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
})

export { stripe }

// ── Plan → Stripe price ID mapping ───────────
// Set these after creating products in Stripe dashboard.
// Store in env vars so they can differ between environments.

function getPriceId(tier: string): string {
  const map: Record<string, string> = {
    base:         process.env.STRIPE_PRICE_BASE          ?? '',
    pay_per_post: process.env.STRIPE_PRICE_PAY_PER_POST  ?? '',
  }
  return map[tier] ?? ''
}

// ── Create checkout session ───────────────────
// Redirects employer to Stripe-hosted checkout.
// On success, Stripe webhook updates subscription status.

export async function createCheckoutSession(params: {
  employerId:    string
  tier:          string
  userId:        string
  successUrl:    string
  cancelUrl:     string
}): Promise<{ url: string }> {
  const { employerId, tier, userId, successUrl, cancelUrl } = params

  const priceId = getPriceId(tier)
  if (!priceId) throw new Error(`No Stripe price configured for tier: ${tier}`)

  // Get or create Stripe customer
  const customerId = await getOrCreateCustomer(userId, employerId)

  const session = await stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        tier === 'pay_per_post' ? 'payment' : 'subscription',
    line_items:  [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url:  cancelUrl,
    metadata: {
      employer_id: employerId,
      tier,
      user_id:     userId,
    },
  })

  return { url: session.url! }
}

// ── Create customer portal session ───────────
// Lets employer manage their subscription (cancel, update card).

export async function createPortalSession(params: {
  userId:     string
  returnUrl:  string
}): Promise<{ url: string }> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', params.userId)
    .single()

  // Find Stripe customer by email
  const customers = await stripe.customers.list({ email: user?.email, limit: 1 })
  if (!customers.data.length) throw new Error('No Stripe customer found')

  const session = await stripe.billingPortal.sessions.create({
    customer:   customers.data[0].id,
    return_url: params.returnUrl,
  })

  return { url: session.url }
}

// ── Handle webhook ────────────────────────────
// Processes Stripe events and updates employer_subscriptions.

export async function handleWebhookEvent(
  payload:   string | Buffer,
  signature: string
): Promise<void> {
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    throw new Error(`Webhook signature verification failed: ${err.message}`)
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session    = event.data.object as Stripe.Checkout.Session
      const employerId = session.metadata?.employer_id
      const tier       = session.metadata?.tier

      if (!employerId || !tier) break

      await supabaseAdmin
        .from('employer_subscriptions')
        .upsert({
          employer_id: employerId,
          tier,
          status:      'active',
          started_at:  new Date().toISOString(),
          expires_at:  null,
        }, { onConflict: 'employer_id' })

      // Update subscription_plans stripe data if needed
      break
    }

    case 'customer.subscription.deleted':
    case 'customer.subscription.paused': {
      const sub        = event.data.object as Stripe.Subscription
      const employerId = sub.metadata?.employer_id

      if (!employerId) break

      await supabaseAdmin
        .from('employer_subscriptions')
        .update({
          status:     'cancelled',
          expires_at: new Date(sub.current_period_end * 1000).toISOString(),
        })
        .eq('employer_id', employerId)

      break
    }

    case 'customer.subscription.updated': {
      const sub        = event.data.object as Stripe.Subscription
      const employerId = sub.metadata?.employer_id

      if (!employerId) break

      const status = sub.status === 'active' ? 'active' : 'expired'

      await supabaseAdmin
        .from('employer_subscriptions')
        .update({ status })
        .eq('employer_id', employerId)

      break
    }
  }
}

// ── Helpers ───────────────────────────────────

async function getOrCreateCustomer(
  userId:     string,
  employerId: string
): Promise<string> {
  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', userId)
    .single()

  const email = userRow?.email

  // Check for existing customer
  const existing = await stripe.customers.list({ email, limit: 1 })
  if (existing.data.length > 0) return existing.data[0].id

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId, employer_id: employerId },
  })

  return customer.id
}
