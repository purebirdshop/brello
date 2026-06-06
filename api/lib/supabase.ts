// ─────────────────────────────────────────────
// api/lib/supabase.ts
// Supabase clients for the API layer.
// ─────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.SUPABASE_URL!
const supabaseAnon = process.env.SUPABASE_ANON_KEY!
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseAnon || !supabaseServiceRole) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

/**
 * Public client — respects RLS. Use for user-scoped operations.
 * Pass the user's JWT to scope requests correctly.
 */
export const supabase = createClient(supabaseUrl, supabaseAnon)

/**
 * Admin client — bypasses RLS. Use ONLY for:
 * - Post-signup hooks (creating user row, founder connection)
 * - Background jobs (radius recalculation, anchor decay)
 * - Trusted server-side operations
 *
 * Never expose this client or its key to the mobile app.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

/**
 * Creates a Supabase client scoped to a specific user's JWT.
 * Use this for all request handlers so RLS policies apply correctly.
 */
export function supabaseForUser(jwt: string) {
  return createClient(supabaseUrl, supabaseAnon, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  })
}
