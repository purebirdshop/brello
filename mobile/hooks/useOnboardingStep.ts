// mobile/hooks/useOnboardingStep.ts
// Advances the onboarding step in Supabase and the local store.

import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { OnboardingStep, ONBOARDING_STEPS } from '@localloop/shared'
import { useRouter } from 'expo-router'

// Map of step → next route
const STEP_ROUTES: Record<OnboardingStep, string> = {
  email:          '/auth/magic-link',
  verify:         '/auth/magic-link',
  profile:        '/onboarding/profile',
  location:       '/onboarding/location',
  radius_reveal:  '/onboarding/radius-reveal',
  resume:         '/onboarding/resume',
  circle_intro:   '/onboarding/circle-intro',
  find_contacts:  '/onboarding/find-contacts',
  follow_business:'/onboarding/follow-business',
  complete:       '/tabs/map',
}

export function useOnboardingStep() {
  const router = useRouter()
  const { user, setOnboardingStep } = useAuthStore()

  async function advance(currentStep: OnboardingStep) {
    if (!user) return

    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep)
    const nextStep     = ONBOARDING_STEPS[currentIndex + 1] as OnboardingStep

    // Update DB
    await supabase
      .from('onboarding_states')
      .update({
        current_step:    nextStep,
        completed_steps: supabase.rpc('array_append_unique', {
          arr: [],
          val: currentStep,
        }),
        ...(nextStep === 'complete' ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq('user_id', user.id)

    setOnboardingStep(nextStep)
    router.push(STEP_ROUTES[nextStep] as any)
  }

  async function skip(currentStep: OnboardingStep) {
    // Skip behaves identically to advance for optional steps
    await advance(currentStep)
  }

  return { advance, skip }
}
