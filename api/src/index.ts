// ─────────────────────────────────────────────
// api/src/index.ts
// Express server entry point
// ─────────────────────────────────────────────

import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: [
    'http://localhost:8081',  // Expo dev
    'http://localhost:5173',  // Vite web dev (future)
    ...(process.env.ALLOWED_ORIGINS?.split(',') ?? []),
  ],
  credentials: true,
}))

// Raw body for Stripe webhook signature verification
app.use('/stripe/webhook', express.raw({ type: 'application/json' }), (req: any, _res, next) => {
  req.rawBody = req.body
  next()
})

app.use(express.json())

// ── Health check ──────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'localloop-api', ts: new Date().toISOString() })
})

// ── Routes ───────────────────────────────────
import { authRouter }  from '../routes/auth'
import { swapsRouter }        from '../routes/swaps'
import { notificationsRouter }  from '../routes/notifications'
import { introductionsRouter }  from '../routes/introductions'
import { muxWebhookRouter }     from '../routes/muxWebhook'
import { employerRouter }       from '../routes/employer'
import { stripeRouter }         from '../routes/stripe'
import { linkedinRouter }       from '../routes/linkedin'
import { analyticsRouter }      from '../routes/analytics'

app.use('/auth',  authRouter)
app.use('/swaps',         swapsRouter)
app.use('/notifications',   notificationsRouter)
app.use('/introductions',   introductionsRouter)
app.use('/mux',             muxWebhookRouter)
app.use('/employer',        employerRouter)
app.use('/stripe',          stripeRouter)
app.use('/linkedin',        linkedinRouter)
app.use('/analytics',       analyticsRouter)

// Phase 3+ routes (stubbed)
// app.use('/hunters',   huntersRouter)
// app.use('/employers', employersRouter)
// app.use('/listings',  listingsRouter)
// app.use('/circle',    circleRouter)
// app.use('/swaps',     swapsRouter)
// app.use('/fairs',     fairsRouter)

app.listen(PORT, () => {
  console.log(`LocalLoop API running on http://localhost:${PORT}`)
})

export default app
