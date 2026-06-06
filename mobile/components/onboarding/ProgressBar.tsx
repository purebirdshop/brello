// mobile/components/onboarding/ProgressBar.tsx
import React from 'react'
import { View, StyleSheet } from 'react-native'
import { colors, radius, spacing } from '../../lib/theme'
import { ONBOARDING_STEPS, OnboardingStep } from '@localloop/shared'

// Steps visible in the progress bar (email/verify are pre-bar)
const VISIBLE_STEPS = ONBOARDING_STEPS.filter(
  (s) => !['email', 'verify', 'complete'].includes(s)
)

interface ProgressBarProps {
  currentStep: OnboardingStep
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  const current = VISIBLE_STEPS.indexOf(currentStep)

  return (
    <View style={styles.row}>
      {VISIBLE_STEPS.map((_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            i <= current ? styles.active : styles.inactive,
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap:           spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  segment: {
    flex:         1,
    height:       3,
    borderRadius: radius.full,
  },
  active: {
    backgroundColor: colors.primary,
  },
  inactive: {
    backgroundColor: colors.surfaceLight,
  },
})
