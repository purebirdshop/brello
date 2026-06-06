// mobile/lib/authService.ts
// All auth side-effects live here, not in components or the store.
// Responsibilities:
//   - Bootstrap session on app start
//   - Listen to auth state changes
//   - Post-signup provisioning (user row, hunter profile,
//     onboarding state, token ledger, founder circle connection)
//   - Sign in via Magic Link and Google OAuth
//   - Sign out

import { supabase } from './supabase'
import { useAuthStore } from '../store/authStore'
import { RADIUS } from '@localloop/shared'
import { GoogleSignin } from '@react-native-google-signin/google-signin'

// ── Founder config ────────────────────────────
// The founder's user.id from your Supabase auth.users table.
// Set this after your first sign-in as the founder.
const FOUNDER_USER_ID = process.env.EXPO_PUBLIC_FOUNDER_USER_ID ?? ''

// ── Bootstrap ─────────────────────────────────
// Call once on app start. Restores session from AsyncStorage
// and wires up the auth state change listener.

export async function bootstrapAuth() {
  const store = useAuthStore.getState()
  store.setLoading(true)

  try {
    // Restore existing session
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      store.setSession(session)
      store.setUser(session.user)
      await loadUserData(session.user.id)
    }
  } catch (err) {
    store.setError('Failed to restore session.')
    console.error('[authService] bootstrap error:', err)
  } finally {
    store.setLoading(false)
  }

  // Listen for future auth changes (sign in, sign out, token refresh)
  supabase.auth.onAuthStateChange(async (event, session) => {
    const store = useAuthStore.getState()

    if (event === 'SIGNED_IN' && session) {
      store.setSession(session)
      store.setUser(session.user)
      await provisionNewUserIfNeeded(session.user.id)
      await loadUserData(session.user.id)
    }

    if (event === 'SIGNED_OUT') {
      store.reset()
    }

    if (event === 'TOKEN_REFRESHED' && session) {
      store.setSession(session)
    }
  })
}

// ── Load user data ────────────────────────────
// Fetches the user row, hunter profile, and onboarding state
// for an already-authenticated user. Safe to call on every session restore.

async function loadUserData(userId: string) {
  const store = useAuthStore.getState()

  try {
    // Fetch public user row
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (userError) throw userError
    store.setRole(userRow.role)

    // Fetch hunter profile if this user is a hunter
    if (['hunter', 'both', 'alpha', 'beta'].includes(userRow.role)) {
      const { data: profile, error: profileError } = await supabase
        .from('hunter_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (!profileError && profile) {
        store.setHunterProfile(profile)
      }
    }

    // Fetch onboarding state
    const { data: onboarding } = await supabase
      .from('onboarding_states')
      .select('current_step, completed_at')
      .eq('user_id', userId)
      .single()

    if (onboarding && !onboarding.completed_at) {
      store.setOnboardingStep(onboarding.current_step)
    } else {
      store.setOnboardingStep(null)
    }
  } catch (err) {
    console.error('[authService] loadUserData error:', err)
  }
}

// ── Post-signup provisioning ──────────────────
// Runs only if the user row doesn't exist yet (true new signup).
// Creates: users row, hunter_profile, onboarding_state,
//          swap_token_ledger, and founder circle connection.

async function provisionNewUserIfNeeded(userId: string) {
  // Check if already provisioned
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single()

  if (existing) return  // already provisioned, nothing to do

  const { data: authUser } = await supabase.auth.getUser()
  if (!authUser.user) return

  const email = authUser.user.email ?? ''

  // 1. Insert public users row
  const { error: userError } = await supabase
    .from('users')
    .insert({
      id:    userId,
      email,
      role:  'hunter',
    })

  if (userError) {
    console.error('[authService] provision: users insert failed', userError)
    return
  }

  // 2. Insert hunter_profile
  const displayName = authUser.user.user_metadata?.full_name
    ?? authUser.user.user_metadata?.name
    ?? email.split('@')[0]

  const { data: profile, error: profileError } = await supabase
    .from('hunter_profiles')
    .insert({
      user_id:      userId,
      display_name: displayName,
      avatar_url:   authUser.user.user_metadata?.avatar_url ?? null,
      radius_miles: RADIUS.BASE_MILES,
      circle_points: 0,
    })
    .select()
    .single()

  if (profileError) {
    console.error('[authService] provision: hunter_profile insert failed', profileError)
    return
  }

  // 3. Insert onboarding_state — start after email/verify steps
  await supabase
    .from('onboarding_states')
    .insert({
      user_id:         userId,
      current_step:    'profile',
      completed_steps: ['email', 'verify'],
    })

  // 4. Insert swap_token_ledger
  await supabase
    .from('swap_token_ledger')
    .insert({
      hunter_id:  profile.id,
      balance:    0,
      daily_used: 0,
      daily_cap:  null,   // unlimited at launch
    })

  // 5. Auto-connect with founder (if founder user exists)
  if (FOUNDER_USER_ID && FOUNDER_USER_ID !== userId) {
    const { data: founderProfile } = await supabase
      .from('hunter_profiles')
      .select('id')
      .eq('user_id', FOUNDER_USER_ID)
      .single()

    if (founderProfile) {
      // Insert accepted circle connection — no pending step for founder
      await supabase
        .from('circle_members')
        .insert([
          {
            requester_id:   founderProfile.id,
            recipient_id:   profile.id,
            status:         'accepted',
            quality_weight: 0.5,
          },
        ])

      // Log the circle point for the new user (member_verified: founder counts)
      await supabase
        .from('circle_point_logs')
        .insert({
          hunter_id: profile.id,
          reason:    'member_verified',
          delta:     1,
        })

      // Update circle_points on hunter_profile
      await supabase
        .from('hunter_profiles')
        .update({ circle_points: 1 })
        .eq('id', profile.id)
    }
  }

  console.log('[authService] New user provisioned:', userId)
}

// ── Sign in with Magic Link ───────────────────

export async function signInWithMagicLink(email: string): Promise<void> {
  const store = useAuthStore.getState()
  store.setLoading(true)
  store.setError(null)

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'localloop://auth/callback',
    },
  })

  store.setLoading(false)

  if (error) {
    store.setError(error.message)
    throw error
  }
}

// ── Sign in with Google ───────────────────────

export async function signInWithGoogle(): Promise<void> {
  const store = useAuthStore.getState()
  store.setLoading(true)
  store.setError(null)

  try {
    await GoogleSignin.hasPlayServices()
    const userInfo = await GoogleSignin.signIn()
    const idToken  = userInfo.data?.idToken

    if (!idToken) throw new Error('No ID token returned from Google Sign-In')

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token:    idToken,
    })

    if (error) throw error
  } catch (err: any) {
    store.setError(err.message ?? 'Google sign-in failed')
    throw err
  } finally {
    store.setLoading(false)
  }
}

// ── Sign out ──────────────────────────────────

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
  useAuthStore.getState().reset()
}
