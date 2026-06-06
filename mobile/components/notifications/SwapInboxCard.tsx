// mobile/components/notifications/SwapInboxCard.tsx
// Prominent card shown when the current user has a pending
// incoming swap request. Appears at the top of the circle tab
// and as a dismissible banner on the map.

import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { colors, spacing, radius, typography } from '../../lib/theme'
import { useSwap } from '../../hooks/useSwap'
import { SWAP } from '@localloop/shared'

interface SwapInboxCardProps {
  swapId:        string
  requesterName: string
  listingTitle:  string
  employerName:  string
  expiresAt:     string
  onActioned:    () => void
}

export function SwapInboxCard({
  swapId,
  requesterName,
  listingTitle,
  employerName,
  expiresAt,
  onActioned,
}: SwapInboxCardProps) {
  const { acceptSwap, declineSwap } = useSwap()
  const [loading, setLoading]       = useState(false)
  const [action, setAction]         = useState<'accept' | 'decline' | null>(null)

  async function handleAccept() {
    setLoading(true)
    setAction('accept')
    await acceptSwap(swapId)
    setLoading(false)
    onActioned()
  }

  async function handleDecline() {
    setLoading(true)
    setAction('decline')
    await declineSwap(swapId)
    setLoading(false)
    onActioned()
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>⇄</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>Spot request</Text>
          <Text style={styles.sub}>
            <Text style={styles.name}>{requesterName}</Text> wants to apply nearby
          </Text>
        </View>
      </View>

      {/* Listing context */}
      <View style={styles.listingRow}>
        <Text style={styles.listingIcon}>💼</Text>
        <Text style={styles.listingText} numberOfLines={1}>
          {listingTitle} · {employerName}
        </Text>
      </View>

      {/* Timer note */}
      <Text style={styles.timerNote}>
        They'll have your location for {SWAP.DURATION_MINUTES} minutes only.
      </Text>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnDecline]}
          onPress={handleDecline}
          disabled={loading}
        >
          {loading && action === 'decline'
            ? <ActivityIndicator size="small" color={colors.textMuted} />
            : <Text style={styles.btnDeclineText}>Decline</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnAccept]}
          onPress={handleAccept}
          disabled={loading}
        >
          {loading && action === 'accept'
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.btnAcceptText}>Share my spot</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
    borderWidth:     1.5,
    borderColor:     colors.accent + '60',
    marginHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  headerIcon: {
    fontSize:        24,
    width:           36,
    textAlign:       'center',
  },
  headerText: {
    flex: 1,
    gap:  1,
  },
  title: {
    ...typography.body,
    fontWeight: '700',
  },
  sub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  name: {
    color:      colors.primary,
    fontWeight: '700',
  },
  listingRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.xs,
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.sm,
    padding:         spacing.sm,
  },
  listingIcon: {
    fontSize: 14,
  },
  listingText: {
    ...typography.caption,
    flex:       1,
    fontWeight: '600',
  },
  timerNote: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.xs,
  },
  btn: {
    flex:           1,
    height:         44,
    borderRadius:   radius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  btnDecline: {
    backgroundColor: colors.surfaceLight,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  btnAccept: {
    backgroundColor: colors.primary,
  },
  btnDeclineText: {
    ...typography.body,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
  btnAcceptText: {
    ...typography.body,
    fontWeight: '600',
    color:      '#fff',
  },
})
