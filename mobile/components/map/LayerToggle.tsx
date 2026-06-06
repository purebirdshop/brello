// mobile/components/map/LayerToggle.tsx
// Floating pill toggle that switches between the jobs layer
// and the business discovery layer.

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors, radius, spacing, typography } from '../../lib/theme'
import { MapLayer } from '../../store/mapStore'

interface LayerToggleProps {
  active:   MapLayer
  onChange: (layer: MapLayer) => void
}

const LAYERS: { key: MapLayer; label: string; icon: string }[] = [
  { key: 'jobs',       label: 'Jobs',       icon: '💼' },
  { key: 'businesses', label: 'Businesses', icon: '🏢' },
]

export function LayerToggle({ active, onChange }: LayerToggleProps) {
  return (
    <View style={styles.container}>
      {LAYERS.map((layer) => {
        const isActive = active === layer.key
        return (
          <TouchableOpacity
            key={layer.key}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onChange(layer.key)}
            activeOpacity={0.8}
          >
            <Text style={styles.icon}>{layer.icon}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {layer.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection:   'row',
    backgroundColor: colors.surface,
    borderRadius:    radius.full,
    padding:         3,
    borderWidth:     1,
    borderColor:     colors.border,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.3,
    shadowRadius:    8,
    elevation:       6,
  },
  pill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.xs,
    paddingVertical:  8,
    paddingHorizontal: spacing.md,
    borderRadius:    radius.full,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  icon: {
    fontSize: 14,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
  labelActive: {
    color: '#fff',
  },
})
