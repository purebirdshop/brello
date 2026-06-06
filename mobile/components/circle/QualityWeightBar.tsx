// mobile/components/circle/QualityWeightBar.tsx
// Shows the strength of a circle relationship as a segmented
// bar. 0.0 = dormant stranger, 1.0 = active swap partner.

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '../../lib/theme'

interface QualityWeightBarProps {
  weight:       number   // 0.0 – 1.0
  showLabel?:   boolean
}

const SEGMENTS = 5

function weightLabel(w: number): string {
  if (w >= 0.8) return 'Strong'
  if (w >= 0.6) return 'Active'
  if (w >= 0.4) return 'Growing'
  if (w >= 0.2) return 'New'
  return 'Dormant'
}

function weightColor(w: number): string {
  if (w >= 0.8) return colors.primary
  if (w >= 0.6) return colors.success
  if (w >= 0.4) return colors.accent
  if (w >= 0.2) return colors.info
  return colors.textMuted
}

export function QualityWeightBar({
  weight,
  showLabel = true,
}: QualityWeightBarProps) {
  const filled = Math.round(weight * SEGMENTS)
  const color  = weightColor(weight)

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i < filled ? color : colors.surfaceLight },
            ]}
          />
        ))}
      </View>
      {showLabel && (
        <Text style={[styles.label, { color }]}>
          {weightLabel(weight)}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    gap:           2,
  },
  segment: {
    width:        10,
    height:       4,
    borderRadius: radius.full,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    fontSize:   11,
  },
})
