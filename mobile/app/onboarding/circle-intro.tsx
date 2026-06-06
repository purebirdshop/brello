// mobile/app/onboarding/circle-intro.tsx
// Screen 7: introduce the circle concept, show founder connection,
// reveal that the user already has 2 in their circle.

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Screen } from '../../components/ui/Screen'
import { Button } from '../../components/ui/Button'
import { ProgressBar } from '../../components/onboarding/ProgressBar'
import { colors, spacing, typography, radius } from '../../lib/theme'
import { useOnboardingStep } from '../../hooks/useOnboardingStep'
import { RADIUS } from '@localloop/shared'

// Founder card — hardcoded display, auto-connected at signup
function FounderCard() {
  return (
    <View style={styles.founderCard}>
      <View style={styles.founderAvatar}>
        <Text style={styles.founderAvatarText}>J</Text>
      </View>
      <View style={styles.founderInfo}>
        <Text style={styles.founderName}>Jason  ·  LocalLoop founder</Text>
        <Text style={styles.founderBio}>
          Already in your circle. Every new member starts connected to me.
        </Text>
      </View>
      <View style={styles.connectedBadge}>
        <Text style={styles.connectedText}>✓</Text>
      </View>
    </View>
  )
}

export default function OnboardingCircleIntro() {
  const { advance } = useOnboardingStep()

  return (
    <Screen padded>
      <ProgressBar currentStep="circle_intro" />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={typography.h2}>Your circle starts here</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            Your circle is your trusted job-hunting crew. Growing it expands
            your map radius — and lets you swap locations to apply for jobs
            near friends.
          </Text>
        </View>

        {/* Circle size celebration */}
        <View style={styles.celebration}>
          <View style={styles.countBubble}>
            <Text style={styles.countNumber}>2</Text>
            <Text style={styles.countLabel}>in your circle</Text>
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
            You + the founder = your first ring unlocked.{'\n'}
            Keep growing to expand your radius toward {RADIUS.MAX_MILES} miles.
          </Text>
        </View>

        <FounderCard />

        <Button
          label="Find people I know →"
          onPress={() => advance('circle_intro')}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    flex:           1,
    gap:            spacing.xl,
    paddingTop:     spacing.xl,
    paddingBottom:  spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  celebration: {
    alignItems: 'center',
    gap:        spacing.sm,
  },
  countBubble: {
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  countNumber: {
    fontSize:   38,
    fontWeight: '800',
    color:      '#fff',
    lineHeight: 42,
  },
  countLabel: {
    ...typography.caption,
    color:      colors.primaryLight,
    fontWeight: '600',
  },
  founderCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.primary + '40',
  },
  founderAvatar: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  founderAvatarText: {
    ...typography.h3,
    color: '#fff',
  },
  founderInfo: {
    flex: 1,
    gap:  2,
  },
  founderName: {
    ...typography.body,
    fontWeight: '600',
  },
  founderBio: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  connectedBadge: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  connectedText: {
    color:      '#fff',
    fontWeight: '700',
    fontSize:   14,
  },
})
