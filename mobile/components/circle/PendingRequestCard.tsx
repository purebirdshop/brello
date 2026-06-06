// mobile/components/circle/PendingRequestCard.tsx
// Card shown for incoming circle requests in the circle tab.
// Accept or decline with a single tap.

import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { colors, spacing, radius, typography } from '../../lib/theme'
import { CircleMemberView } from '../../store/circleStore'
import { supabase } from '../../lib/supabase'
import { useCircleStore } from '../../store/circleStore'
import { useAuthStore } from '../../store/authStore'

interface PendingRequestCardProps {
  member:    CircleMemberView
  direction: 'incoming' | 'outgoing'
}

export function PendingRequestCard({ member, direction }: PendingRequestCardProps) {
  const { updateMemberStatus } = useCircleStore()
  const { hunterProfile }      = useAuthStore()
  const [loading, setLoading]  = useState(false)

  async function handleAccept() {
    setLoading(true)
    await supabase
      .from('circle_members')
      .update({ status: 'accepted' })
      .eq('id', member.circle_member_id)

    // Award circle point to both parties
    if (hunterProfile?.id) {
      await supabase.from('circle_point_logs').insert([
        { hunter_id: hunterProfile.id,      reason: 'member_verified', delta: 1, reference_id: member.circle_member_id },
        { hunter_id: member.hunter_profile_id, reason: 'member_verified', delta: 1, reference_id: member.circle_member_id },
      ])
      await supabase.rpc('increment_circle_points', { p_hunter_id: hunterProfile.id, p_delta: 1 })
      await supabase.rpc('increment_circle_points', { p_hunter_id: member.hunter_profile_id, p_delta: 1 })
    }

    updateMemberStatus(member.circle_member_id, 'accepted')
    setLoading(false)
  }

  async function handleDecline() {
    setLoading(true)
    await supabase
      .from('circle_members')
      .update({ status: 'removed' })
      .eq('id', member.circle_member_id)

    updateMemberStatus(member.circle_member_id, 'removed')
    setLoading(false)
  }

  return (
    <View style={styles.card}>
      <View style={styles.avatarFallback}>
        <Text style={styles.avatarInitial}>
          {member.display_name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{member.display_name}</Text>
        <Text style={styles.sub}>
          {direction === 'incoming'
            ? 'Wants to join your circle'
            : 'Request sent — awaiting response'}
        </Text>
      </View>

      {direction === 'incoming' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnAccept]}
            onPress={handleAccept}
            disabled={loading}
          >
            <Text style={styles.btnText}>✓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnDecline]}
            onPress={handleDecline}
            disabled={loading}
          >
            <Text style={styles.btnText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {direction === 'outgoing' && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>Pending</Text>
        </View>
      )}
    </View>
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
    borderColor:     colors.accent + '50',
  },
  avatarFallback: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarInitial: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  info: {
    flex: 1,
    gap:  2,
  },
  name: {
    ...typography.body,
    fontWeight: '700',
  },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  btn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    alignItems:      'center',
    justifyContent:  'center',
  },
  btnAccept: {
    backgroundColor: colors.primary,
  },
  btnDecline: {
    backgroundColor: colors.surfaceLight,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  btnText: {
    fontSize:   16,
    fontWeight: '700',
    color:      '#fff',
  },
  pendingBadge: {
    backgroundColor:  colors.surfaceLight,
    borderRadius:     radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
  },
  pendingText: {
    ...typography.caption,
    color:      colors.textMuted,
    fontWeight: '600',
  },
})
