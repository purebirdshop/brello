// mobile/store/authStore.ts
// Central auth state. Holds the Supabase session, the public
// user row, the hunter profile, and the onboarding step.
// All auth side-effects (post-signup provisioning) happen
// in the authService, not here.

import { create } from 'zustand'
import { Session, User } from '@supabase/supabase-js'
import { HunterProfile, OnboardingStep } from '@localloop/shared'

interface AuthState {
  // Supabase session — null when signed out
  session:        Session | null
  // Supabase auth user — null when signed out
  user:           User | null
  // Our public users row role
  role:           string | null
  // Hunter profile — null if user is employer-only or not yet provisioned
  hunterProfile:  HunterProfile | null
  // Current onboarding step — null when onboarding complete
  onboardingStep: OnboardingStep | null
  // True while any auth operation is in flight
  loading:        boolean
  // Error from last auth operation
  error:          string | null

  // Setters called by authService
  setSession:        (session: Session | null) => void
  setUser:           (user: User | null) => void
  setRole:           (role: string | null) => void
  setHunterProfile:  (profile: HunterProfile | null) => void
  setOnboardingStep: (step: OnboardingStep | null) => void
  setLoading:        (loading: boolean) => void
  setError:          (error: string | null) => void
  reset:             () => void
}

const initialState = {
  session:        null,
  user:           null,
  role:           null,
  hunterProfile:  null,
  onboardingStep: null,
  loading:        false,
  error:          null,
}

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,

  setSession:        (session)       => set({ session }),
  setUser:           (user)          => set({ user }),
  setRole:           (role)          => set({ role }),
  setHunterProfile:  (hunterProfile) => set({ hunterProfile }),
  setOnboardingStep: (step)          => set({ onboardingStep: step }),
  setLoading:        (loading)       => set({ loading }),
  setError:          (error)         => set({ error }),
  reset:             ()              => set(initialState),
}))
