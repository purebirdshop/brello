// mobile/app/auth/magic-link.tsx
// Screen 2 (email path): enter email → receive magic link.

import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../../components/ui/Screen'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { colors, spacing, typography } from '../../lib/theme'
import { signInWithMagicLink } from '../../lib/authService'
import { useAuthStore } from '../../store/authStore'

export default function MagicLinkScreen() {
  const router  = useRouter()
  const loading = useAuthStore((s) => s.loading)
  const error   = useAuthStore((s) => s.error)

  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [inputErr, setInputErr] = useState('')

  async function handleSend() {
    if (!email || !email.includes('@')) {
      setInputErr('Please enter a valid email address.')
      return
    }
    setInputErr('')

    try {
      await signInWithMagicLink(email.trim().toLowerCase())
      setSent(true)
    } catch {
      // error in store
    }
  }

  if (sent) {
    return (
      <Screen padded>
        <View style={styles.center}>
          <Text style={styles.icon}>✉️</Text>
          <Text style={styles.h2}>Check your email</Text>
          <Text style={styles.body}>
            We sent a sign-in link to{'\n'}
            <Text style={{ color: colors.primary }}>{email}</Text>
          </Text>
          <Text style={styles.caption}>
            Tap the link in that email and you'll be brought right back here.
          </Text>
          <Button
            label="Use a different email"
            variant="ghost"
            onPress={() => { setSent(false); setEmail('') }}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen padded scroll>
      <View style={styles.header}>
        <Button
          label="← Back"
          variant="ghost"
          onPress={() => router.back()}
          style={styles.back}
        />
        <Text style={typography.h2}>Sign in with email</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          We'll send you a link — no password needed.
        </Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@example.com"
          error={inputErr || error || undefined}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />

        <Button
          label="Send sign-in link"
          onPress={handleSend}
          loading={loading}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    gap:        spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  back: {
    alignSelf: 'flex-start',
    marginLeft: -spacing.sm,
  },
  form: {
    gap: spacing.md,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.md,
    paddingHorizontal: spacing.md,
  },
  icon: {
    fontSize: 48,
  },
  h2: {
    ...typography.h2,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color:     colors.textSecondary,
    textAlign: 'center',
  },
  caption: {
    ...typography.caption,
    textAlign:  'center',
    lineHeight: 18,
    color:      colors.textMuted,
  },
})
