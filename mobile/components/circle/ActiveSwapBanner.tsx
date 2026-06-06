// mobile/components/circle/ActiveSwapBanner.tsx
// Shown at the top of the map when a swap is active.
// Counts down to expiry, shows warning at 2 min,
// and handles extension request flow.

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native'
import { colors, spacing, radius, typography } from '../../lib/theme'
import { useCircleStore } from '../../store/circleStore'
import { useSwap } from '../../hooks/useSwap'
import { SWAP } from '@localloop/shared'

const WARNING_MS = SWAP.WARNING_BEFORE_EXPIRY_MINUTES * 60 * 1000

export function ActiveSwapBanner() {
  const { activeSwap }             = useCircleStore()
  const { requestExtension, completeSwap } = useSwap()

  const [msLeft, setMsLeft]              = useState(0)
  const [isWarning, setIsWarning]        = useState(false)
  const [extensionRequested, setExtReq]  = useState(false)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const effectiveExpiry = activeSwap?.extended_expires_at ?? activeSwap?.expires_at

  // Countdown tick
  useEffect(() => {
    if (!effectiveExpiry) return

    function tick() {
      const left = new Date(effectiveExpiry!).getTime() - Date.now()
      setMsLeft(Math.max(left, 0))
      setIsWarning(left <= WARNING_MS && left > 0)
      if (left <= 0 && activeSwap) {
        completeSwap(activeSwap.id, false)
      }
    }

    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [effectiveExpiry, activeSwap?.id])

  // Pulse animation during warning
  useEffect(() => {
    if (!isWarning) {
      pulseAnim.setValue(1)
      return
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [isWarning])

  const handleRequestExtension = useCallback(async () => {
    setExtReq(true)
    await requestExtension()
  }, [requestExtension])

  if (!activeSwap) return null

  const totalSec  = Math.floor(msLeft / 1000)
  const minutes   = Math.floor(totalSec / 60)
  const seconds   = totalSec % 60
  const timeStr   = `${minutes}:${String(seconds).padStart(2, '0')}`

  return (
    <Animated.View
      style={[
        styles.banner,
        isWarning && styles.bannerWarning,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <View style={styles.left}>
        <Text style={styles.icon}>{isWarning ? '⚠️' : '⇄'}</Text>
        <View>
          <Text style={styles.title}>
            {isWarning ? 'Swap expiring soon' : 'Spot active'}
          </Text>
          <Text style={styles.timer}>{timeStr} remaining</Text>
        </View>
      </View>

      {isWarning && !extensionRequested && (
        <TouchableOpacity
          style={styles.extBtn}
          onPress={handleRequestExtension}
        >
          <Text style={styles.extBtnText}>Ask for more time</Text>
        </TouchableOpacity>
      )}

      {extensionRequested && (
        <Text style={styles.extSent}>Request sent…</Text>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   colors.primary,
    borderRadius:      radius.md,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal:  spacing.md,
    gap:               spacing.md,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.3,
    shadowRadius:      6,
    elevation:         6,
  },
  bannerWarning: {
    backgroundColor: colors.warning,
  },
  left: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    flex:          1,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    ...typography.caption,
    fontWeight: '700',
    color:      '#fff',
  },
  timer: {
    ...typography.h3,
    color:    '#fff',
    fontSize: 15,
  },
  extBtn: {
    backgroundColor:  'rgba(255,255,255,0.25)',
    borderRadius:     radius.full,
    paddingVertical:  6,
    paddingHorizontal: spacing.sm,
  },
  extBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color:      '#fff',
  },
  extSent: {
    ...typography.caption,
    color:      'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
})
