// mobile/app/onboarding/radius-reveal.tsx
// Screen 5: animated map ring reveal — the first emotional hook.

import React, { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { Screen } from '../../components/ui/Screen'
import { Button } from '../../components/ui/Button'
import { ProgressBar } from '../../components/onboarding/ProgressBar'
import { colors, spacing, typography, radius } from '../../lib/theme'
import { useOnboardingStep } from '../../hooks/useOnboardingStep'
import { useAuthStore } from '../../store/authStore'
import { RADIUS } from '@localloop/shared'

export default function OnboardingRadiusReveal() {
  const { advance }     = useOnboardingStep()
  const { hunterProfile } = useAuthStore()

  const ringScale   = useRef(new Animated.Value(0)).current
  const ringOpacity = useRef(new Animated.Value(0)).current
  const textOpacity = useRef(new Animated.Value(0)).current

  const currentRadius = hunterProfile?.radius_miles ?? RADIUS.BASE_MILES

  useEffect(() => {
    // Animate the ring expanding, then fade in the text
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.spring(ringScale, {
          toValue:         1,
          tension:         40,
          friction:        8,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue:         1,
          duration:        600,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue:         1,
        duration:        400,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <Screen padded>
      <ProgressBar currentStep="radius_reveal" />

      <View style={styles.content}>
        <View style={styles.hero}>
          {/* Animated ring stack */}
          <View style={styles.ringContainer}>
            <Animated.View
              style={[
                styles.ring,
                styles.ringOuter,
                { transform: [{ scale: ringScale }], opacity: ringOpacity },
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                styles.ringMid,
                { transform: [{ scale: ringScale }], opacity: ringOpacity },
              ]}
            />
            <View style={styles.centerDot}>
              <Text style={styles.centerText}>you</Text>
            </View>
          </View>

          <Animated.View style={[styles.textBlock, { opacity: textOpacity }]}>
            <Text style={typography.h2}>Your world just got bigger</Text>
            <Text style={[typography.body, styles.body]}>
              Your starting ring covers{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {currentRadius} mile{currentRadius !== 1 ? 's' : ''}
              </Text>{' '}
              around you. Every time you grow your circle, your ring expands —
              up to {RADIUS.MAX_MILES} miles.
            </Text>
          </Animated.View>
        </View>

        <Button
          label="Let's grow it →"
          onPress={() => advance('radius_reveal')}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    flex:           1,
    justifyContent: 'space-between',
    paddingTop:     spacing.xl,
    paddingBottom:  spacing.xl,
  },
  hero: {
    flex:       1,
    alignItems: 'center',
    gap:        spacing.xl,
    paddingTop: spacing.xl,
  },
  ringContainer: {
    width:          220,
    height:         220,
    alignItems:     'center',
    justifyContent: 'center',
  },
  ring: {
    position:     'absolute',
    borderRadius: radius.full,
    borderWidth:  1.5,
  },
  ringOuter: {
    width:       220,
    height:      220,
    borderColor: colors.radiusStroke,
    backgroundColor: colors.radiusRing,
  },
  ringMid: {
    width:       140,
    height:      140,
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '08',
  },
  centerDot: {
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  centerText: {
    ...typography.caption,
    color:      '#fff',
    fontWeight: '700',
  },
  textBlock: {
    gap:       spacing.sm,
    alignItems:'center',
  },
  body: {
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 24,
  },
})
