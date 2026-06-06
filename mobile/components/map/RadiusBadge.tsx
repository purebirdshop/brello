// mobile/components/map/RadiusBadge.tsx
// Floating HUD in the top-right corner of the map.
// Shows current radius and tappable circle points summary.

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors, radius, spacing, typography } from '../../lib/theme'
import { RADIUS } from '@localloop/shared'

interface RadiusBadgeProps {
  radiusMiles:  number
  circlePoints: number
  onPress?:     () => void
}

export function RadiusBadge({ radiusMiles, circlePoints, onPress }: RadiusBadgeProps) {
  const pct = ((radiusMiles - RADIUS.BASE_MILES) / (RADIUS.MAX_MILES - RADIUS.BASE_MILES)) * 100

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
    >
      <View style={styles.row}>
        <Text style={styles.icon}>◎</Text>
        <View>
          <Text style={styles.value}>{radiusMiles.toFixed(2)} mi</Text>
          <Text style={styles.sub}>{circlePoints} pts</Text>
        </View>
      </View>

      {/* Progress bar toward max radius */}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(pct, 100)}%` }]} />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    minWidth:        110,
    gap:             spacing.xs,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.3,
    shadowRadius:    6,
    elevation:       5,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  icon: {
    fontSize: 18,
    color:    colors.primary,
  },
  value: {
    ...typography.body,
    fontWeight: '700',
    fontSize:   13,
  },
  sub: {
    ...typography.caption,
    color:    colors.textMuted,
    fontSize: 11,
  },
  track: {
    height:          3,
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.full,
    overflow:        'hidden',
  },
  fill: {
    height:          3,
    backgroundColor: colors.primary,
    borderRadius:    radius.full,
  },
})
