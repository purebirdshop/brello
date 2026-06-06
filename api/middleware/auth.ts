// ─────────────────────────────────────────────
// api/middleware/auth.ts
// Extracts and verifies the Supabase JWT from
// the Authorization header. Attaches the user
// and a scoped Supabase client to req for downstream use.
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import { supabaseAdmin, supabaseForUser } from '../lib/supabase'

export interface AuthenticatedRequest extends Request {
  userId: string
  userClient: ReturnType<typeof supabaseForUser>
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' })
  }

  const jwt = authHeader.replace('Bearer ', '')

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt)

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  ;(req as AuthenticatedRequest).userId     = user.id
  ;(req as AuthenticatedRequest).userClient = supabaseForUser(jwt)

  next()
}
