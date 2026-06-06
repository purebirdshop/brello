// mobile/components/circle/CircleMemberCard.tsx
// Reusable card for a circle member. Used in the circle tab
// member list and the nearby-circle bottom sheet.

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { colors, spacing, radius, typography } from '../../lib/theme'
import { QualityWeightBar } from './QualityWeightBar'
import { CircleMemberView } from '../../store/circleStore'

interface CircleMemberCardProps {
  member:          CircleMemberView
  onPress?:        (member: CircleMemberView) => void
  onRequestSwap?:  (member: CircleMemberView) => void
  showSwapButton?: boolean
  distanceMiles?:  number
}

export function CircleMemberCard({
  member,
  onPress,
  onRequestSwap,
  showSwapButton = false,
  distanceMiles,
}: CircleMemberCardProps) {
  const isLocked    = member.swap_status === 'swap_locked'
  const swapDisabled = isLocked

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(member)}
      activeOpacity={onPress ? 0.8 : 1}
    >
      {/* Avatar */}
      <View style={styles.avatarWrapper}>
        {member.avatar_url ? (
          <Image source={{ uri: member.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>
              {member.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Swap status dot */}
        <View style={[
          styles.statusDot,
          isLocked ? styles.statusLocked : styles.statusAvailable,
        ]} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name}>{member.display_name}</Text>

        {member.bio && (
          <Text style={styles.bio} numberOfLines={1}>{member.bio}</Text>
        )}

        <View style={styles.metaRow}>
          <QualityWeightBar weight={member.quality_weight} showLabel />
          {member.completed_swaps > 0 && (
            <Text style={styles.swapCount}>
              {member.completed_swaps} swap{member.completed_swaps !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {distanceMiles !== undefined && (
          <Text style={styles.distance}>
            📍 {distanceMiles.toFixed(1)} mi from listing
          </Text>
        )}
      </View>

      {/* Swap button */}
      {showSwapButton && (
        <TouchableOpacity
          style={[
            styles.swapBtn,
            swapDisabled && styles.swapBtnDisabled,
          ]}
          onPress={() => onRequestSwap?.(member)}
          disabled={swapDisabled}
        >
          <Text style={[
            styles.swapBtnText,
            swapDisabled && styles.swapBtnTextDisabled,
          ]}>
            {isLocked ? '🔒' : '⇄'}
          </Text>
          <Text style={[
            styles.swapBtnLabel,
            swapDisabled && styles.swapBtnTextDisabled,
          ]}>
            {isLocked ? 'Locked' : 'Spot'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width:        48,
    height:       48,
    borderRadius: 24,
  },
  avatarFallback: {
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarInitial: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  statusDot: {
    position:     'absolute',
    bottom:       0,
    right:        0,
    width:        12,
    height:       12,
    borderRadius: 6,
    borderWidth:  2,
    borderColor:  colors.surface,
  },
  statusAvailable: {
    backgroundColor: colors.success,
  },
  statusLocked: {
    backgroundColor: colors.error,
  },
  info: {
    flex: 1,
    gap:  3,
  },
  name: {
    ...typography.body,
    fontWeight: '700',
  },
  bio: {
    ...typography.caption,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    flexWrap:      'wrap',
  },
  swapCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  distance: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  swapBtn: {
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap:             2,
    minWidth:        56,
  },
  swapBtnDisabled: {
    backgroundColor: colors.surfaceLight,
  },
  swapBtnText: {
    fontSize: 18,
    color:    '#fff',
  },
  swapBtnTextDisabled: {
    color: colors.textMuted,
  },
  swapBtnLabel: {
    ...typography.caption,
    fontWeight: '700',
    color:      '#fff',
    fontSize:   10,
  },
})
