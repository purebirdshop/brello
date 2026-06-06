// mobile/app/onboarding/resume.tsx
// Screen 6: upload resume PDF. Skippable.

import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Screen } from '../../components/ui/Screen'
import { Button } from '../../components/ui/Button'
import { ProgressBar } from '../../components/onboarding/ProgressBar'
import { colors, spacing, typography, radius } from '../../lib/theme'
import { useOnboardingStep } from '../../hooks/useOnboardingStep'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'

export default function OnboardingResume() {
  const { advance, skip } = useOnboardingStep()
  const { hunterProfile } = useAuthStore()

  const [fileName, setFileName] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError]       = useState('')

  async function handlePickResume() {
    // DocumentPicker integration — install expo-document-picker in a follow-up
    // Stubbed here to show the flow without the native module dependency
    setError('Document picker will be wired in the next pass once expo-document-picker is installed.')
  }

  async function handleContinue() {
    await advance('resume')
  }

  return (
    <Screen padded>
      <ProgressBar currentStep="resume" />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={typography.h2}>Add your resume</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            Employers can view it alongside your introduction video. You can
            always add or update it later.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.dropZone, uploaded && styles.dropZoneSuccess]}
          onPress={handlePickResume}
          activeOpacity={0.75}
        >
          {uploaded ? (
            <>
              <Text style={styles.dropIcon}>✓</Text>
              <Text style={styles.dropLabel}>{fileName}</Text>
              <Text style={styles.dropHint}>Tap to replace</Text>
            </>
          ) : (
            <>
              <Text style={styles.dropIcon}>📄</Text>
              <Text style={styles.dropLabel}>Upload PDF resume</Text>
              <Text style={styles.dropHint}>Tap to browse your files</Text>
            </>
          )}
        </TouchableOpacity>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={uploaded ? 'Continue' : 'Continue without resume'}
            onPress={handleContinue}
            variant={uploaded ? 'primary' : 'secondary'}
            loading={loading}
          />
          {!uploaded && (
            <Button
              label="Skip for now"
              variant="ghost"
              onPress={() => skip('resume')}
              disabled={loading}
            />
          )}
        </View>
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
  dropZone: {
    flex:            1,
    maxHeight:       200,
    borderRadius:    radius.lg,
    borderWidth:     1.5,
    borderColor:     colors.border,
    borderStyle:     'dashed',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    backgroundColor: colors.surface,
  },
  dropZoneSuccess: {
    borderColor:     colors.primary,
    borderStyle:     'solid',
    backgroundColor: colors.primaryLight + '15',
  },
  dropIcon: {
    fontSize: 36,
  },
  dropLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  dropHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  error: {
    ...typography.caption,
    color: colors.warning,
  },
  actions: {
    gap: spacing.sm,
  },
})
