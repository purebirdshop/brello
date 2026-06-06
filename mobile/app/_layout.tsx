// mobile/app/_layout.tsx
// Root layout. Bootstraps auth on mount and redirects
// based on session + onboarding state.

import React, { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { bootstrapAuth } from '../lib/authService'
import { bootstrapNotifications, resolveNotificationRoute } from '../lib/notificationService'
import { useAuthStore } from '../store/authStore'
import { colors } from '../lib/theme'

function AuthGate({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const segments = useSegments()

  const { session, onboardingStep, loading } = useAuthStore()

  useEffect(() => {
    if (loading) return

    const inAuth       = segments[0] === 'auth'
    const inOnboarding = segments[0] === 'onboarding'
    const inApp        = segments[0] === 'tabs'

    if (!session) {
      // Not signed in — send to auth
      if (!inAuth) router.replace('/auth/welcome')
      return
    }

    if (onboardingStep && onboardingStep !== 'complete') {
      // Signed in but onboarding incomplete
      if (!inOnboarding) router.replace('/onboarding/profile')
      return
    }

    // Fully authenticated and onboarded
    if (!inApp) router.replace('/tabs/map')
  }, [session, onboardingStep, loading, segments])

  return <>{children}</>
}

export default function RootLayout() {
  const router = useRouter()

  useEffect(() => {
    bootstrapAuth()
    bootstrapNotifications((notification) => {
      const route = resolveNotificationRoute(notification)
      if (route) router.push(route as any)
    })
  }, [])

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown:     false,
            contentStyle:    { backgroundColor: colors.background },
            animation:       'slide_from_right',
          }}
        >
          <Stack.Screen name="auth"       options={{ animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="tabs"       options={{ animation: 'fade' }} />
        </Stack>
      </AuthGate>
    </SafeAreaProvider>
  )
}
