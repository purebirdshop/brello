// mobile/app/onboarding/profile.tsx
// Screen 3: display name, bio, avatar (optional)

import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Screen } from '../../components/ui/Screen'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { ProgressBar } from '../../components/onboarding/ProgressBar'
import { colors, spacing, typography } from '../../lib/theme'
import { useOnboardingStep } from '../../hooks/useOnboardingStep'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'

export default function OnboardingProfile() {
  const { advance } = useOnboardingStep()
  const { user, hunterProfile, setHunterProfile } = useAuthStore()

  const [displayName, setDisplayName] = useState(hunterProfile?.display_name ?? '')
  const [bio, setBio]                 = useState(hunterProfile?.bio ?? '')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  async function handleContinue() {
    if (!displayName.trim()) {
      setError('A display name is required.')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: updateError } = await supabase
      .from('hunter_profiles')
      .update({ display_name: displayName.trim(), bio: bio.trim() || null })
      .eq('user_id', user!.id)
      .select()
      .single()

    setLoading(false)

    if (updateError) {
      setError('Something went wrong. Please try again.')
      return
    }

    setHunterProfile(data)
    await advance('profile')
  }

  return (
    <Screen scroll padded>
      <ProgressBar currentStep="profile" />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={typography.h2}>Let's set up your profile</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            This is how employers and your circle will see you.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How should we call you?"
            autoCapitalize="words"
            error={error}
          />

          <Input
            label="Bio (optional)"
            value={bio}
            onChangeText={setBio}
            placeholder="A sentence or two about yourself..."
            multiline
            numberOfLines={3}
            style={{ height: 88, paddingTop: 12 }}
          />
        </View>

        <Button
          label="Continue"
          onPress={handleContinue}
          loading={loading}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap:  spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  form: {
    gap: spacing.md,
    flex: 1,
  },
})
