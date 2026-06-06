// mobile/components/ui/Screen.tsx
import React from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '../../lib/theme'

interface ScreenProps {
  children:    React.ReactNode
  scroll?:     boolean
  padded?:     boolean
  style?:      ViewStyle
  contentStyle?: ViewStyle
}

export function Screen({
  children,
  scroll    = false,
  padded    = true,
  style,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets()

  const inner = (
    <View
      style={[
        styles.inner,
        padded && styles.padded,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
        contentStyle,
      ]}
    >
      {children}
    </View>
  )

  return (
    <KeyboardAvoidingView
      style={[styles.root, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
})
