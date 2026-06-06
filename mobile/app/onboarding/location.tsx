// mobile/app/onboarding/location.tsx
// Screen 4: request location permission with honest copy.

import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import * as Location from 'expo-location'
import { Screen } from '../../components/ui/Screen'
import { Button } from '../../components/ui/Button'
import { ProgressBar } from '../../components/onboarding/ProgressBar'
import { colors, spacing, typography, radius } from '../../lib/theme'
import { useOnboardingStep } from '../../hooks/useOnboardingStep'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'

export default function OnboardingLocation() {
  const { advance } = useOnboardingStep()
  const { hunterProfile, setHunterProfile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [denied, setDenied]   = useState(false)

  async function handleAllow() {
    setLoading(true)

    const { status } = await Location.requestForegroundPermissionsAsync()

    if (status !== 'granted') {
      setDenied(true)
      setLoading(false)
      return
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })

    // Store precise location server-side — never sent to clients raw
    if (hunterProfile) {
      const { data } = await supabase
        .from('hunter_profiles')
        .update({
          current_lat:          loc.coords.latitude,
          current_lng:          loc.coords.longitude,
          location_updated_at:  new Date().toISOString(),
        })
        .eq('id', hunterProfile.id)
        .select()
        .single()

      if (data) setHunterProfile(data)
    }

    setLoading(false)
    await advance('location')
  }

  async function handleSkip() {
    await advance('location')
  }

  return (
    <Screen padded>
      <ProgressBar currentStep="location" />

      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.iconRing}>
            <Text style={styles.icon}>◎</Text>
          </View>

          <Text style={typography.h2}>Jobs near you</Text>

          <Text style={[typography.body, styles.body]}>
            LocalLoop shows you opportunities within walking distance. We need
            your location to make that work.
          </Text>

          <View style={styles.privacyBox}>
            <Text style={styles.privacyTitle}>🔒  Your privacy</Text>
            <Text style={styles.privacyText}>
              We never share your exact location with employers or other users.
              Locations are always generalized before anyone sees them.
            </Text>
          </View>
        </View>

        {denied && (
          <Text style={styles.deniedText}>
            Location access was denied. You can enable it in your device
            Settings → LocalLoop → Location. You can still browse without it.
          </Text>
        )}

        <View style={styles.actions}>
          <Button
            label="Allow location access"
            onPress={handleAllow}
            loading={loading}
          />
          <Button
            label="Not now"
            variant="ghost"
            onPress={handleSkip}
            disabled={loading}
          />
        </View>
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
    gap:        spacing.md,
    paddingTop: spacing.xl,
  },
  iconRing: {
    width:           100,
    height:          100,
    borderRadius:    50,
    borderWidth:     2,
    borderColor:     colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.primaryLight + '20',
  },
  icon: {
    fontSize: 48,
    color:    colors.primary,
  },
  body: {
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 24,
  },
  privacyBox: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.xs,
    width:           '100%',
  },
  privacyTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  privacyText: {
    ...typography.caption,
    color:      colors.textSecondary,
    lineHeight: 18,
  },
  deniedText: {
    ...typography.caption,
    color:      colors.warning,
    textAlign:  'center',
    lineHeight: 18,
  },
  actions: {
    gap: spacing.sm,
  },
})
