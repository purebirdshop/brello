// mobile/app/auth/welcome.tsx
// Screen 1: brand intro + two auth entry points.

import React from 'react'
import { View, Text, StyleSheet, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../../components/ui/Screen'
import { Button } from '../../components/ui/Button'
import { colors, spacing, typography } from '../../lib/theme'
import { signInWithGoogle } from '../../lib/authService'
import { useAuthStore } from '../../store/authStore'

export default function WelcomeScreen() {
  const router  = useRouter()
  const loading = useAuthStore((s) => s.loading)
  const error   = useAuthStore((s) => s.error)

  async function handleGoogle() {
    try {
      await signInWithGoogle()
      // AuthGate handles redirect
    } catch {
      // error already set in store
    }
  }

  return (
    <Screen padded>
      <View style={styles.hero}>
        {/* Logo placeholder — replace with actual asset */}
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>◎</Text>
        </View>

        <Text style={styles.wordmark}>LocalLoop</Text>

        <Text style={styles.tagline}>
          Jobs within walking distance.{'\n'}
          Opportunities in your circle.
        </Text>
      </View>

      <View style={styles.actions}>
        {error && (
          <Text style={styles.error}>{error}</Text>
        )}

        <Button
          label="Continue with Google"
          onPress={handleGoogle}
          loading={loading}
          style={styles.googleBtn}
        />

        <Button
          label="Sign in with email"
          variant="secondary"
          onPress={() => router.push('/auth/magic-link')}
          disabled={loading}
        />

        <Text style={styles.terms}>
          By continuing you agree to our Terms of Service and Privacy Policy.
          We never share your exact location with anyone.
        </Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.md,
  },
  logoMark: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: colors.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  logoText: {
    fontSize: 40,
    color:    colors.primary,
  },
  wordmark: {
    ...typography.h1,
    fontSize:    36,
    letterSpacing: -0.5,
  },
  tagline: {
    ...typography.body,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 24,
  },
  actions: {
    gap:          spacing.md,
    paddingBottom: spacing.xl,
  },
  googleBtn: {
    backgroundColor: '#fff',
  },
  error: {
    ...typography.caption,
    color:     colors.error,
    textAlign: 'center',
  },
  terms: {
    ...typography.caption,
    textAlign: 'center',
    color:     colors.textMuted,
    lineHeight: 18,
  },
})
