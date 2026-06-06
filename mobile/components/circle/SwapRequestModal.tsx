// mobile/components/circle/SwapRequestModal.tsx
// Confirmation modal shown before sending a swap request.
// Shows who you're requesting from, which listing, and the timer.
// Handles the locked-user "notify me" path too.

import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { colors, spacing, radius, typography } from '../../lib/theme'
import { Button } from '../ui/Button'
import { NearbyCircleMember } from '../../store/circleStore'
import { useSwap } from '../../hooks/useSwap'
import { SWAP } from '@localloop/shared'

interface SwapRequestModalProps {
  visible:         boolean
  member:          NearbyCircleMember | null
  listingId:       string
  listingTitle:    string
  employerName:    string
  onClose:         () => void
  onSuccess:       () => void
}

export function SwapRequestModal({
  visible,
  member,
  listingId,
  listingTitle,
  employerName,
  onClose,
  onSuccess,
}: SwapRequestModalProps) {
  const { requestSwap, notifyWhenAvailable } = useSwap()
  const [loading, setLoading]   = useState(false)
  const [notified, setNotified] = useState(false)
  const [error, setError]       = useState('')

  if (!member) return null

  const isLocked = member.swap_status === 'swap_locked'

  async function handleRequest() {
    setLoading(true)
    setError('')
    try {
      // In production, we get the granter's actual location from the
      // server — never from the client. For now we pass display coords
      // which are already fuzzed.
      await requestSwap(
        member.member_hunter_id,
        listingId,
        0,   // server resolves real coords via granter's profile
        0,
      )
      onSuccess()
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleNotify() {
    setLoading(true)
    await notifyWhenAvailable(member.member_hunter_id)
    setLoading(false)
    setNotified(true)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberInitial}>
                {member.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.memberName}>{member.display_name}</Text>
              <Text style={styles.memberDist}>
                📍 {member.distance_miles.toFixed(1)} mi from {employerName}
              </Text>
            </View>
          </View>

          {/* Listing context */}
          <View style={styles.listingBox}>
            <Text style={styles.listingLabel}>Applying to</Text>
            <Text style={styles.listingTitle}>{listingTitle}</Text>
            <Text style={styles.listingEmployer}>{employerName}</Text>
          </View>

          {isLocked ? (
            /* Locked path */
            <View style={styles.body}>
              <View style={styles.lockedBadge}>
                <Text style={styles.lockedText}>🔒  {member.display_name} is mid-swap right now</Text>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
                They can't share their location while they're using it for someone else.
              </Text>
              {notified ? (
                <Text style={styles.notifiedText}>
                  ✓ You'll be notified when they're available
                </Text>
              ) : (
                <Button
                  label="Notify me when they're free"
                  onPress={handleNotify}
                  loading={loading}
                  variant="secondary"
                />
              )}
            </View>
          ) : (
            /* Available path */
            <View style={styles.body}>
              <View style={styles.timerInfo}>
                <Text style={styles.timerIcon}>⏱</Text>
                <Text style={styles.timerText}>
                  You'll borrow their location for{' '}
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>
                    {SWAP.DURATION_MINUTES} minutes
                  </Text>
                  . After that, your map returns to your actual location.
                </Text>
              </View>

              <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
                A push notification will be sent to {member.display_name}.
                They must approve before the swap activates.
              </Text>

              {error ? (
                <Text style={styles.error}>{error}</Text>
              ) : null}

              <Button
                label={`Request spot from ${member.display_name}`}
                onPress={handleRequest}
                loading={loading}
              />

              <Button
                label="Cancel"
                variant="ghost"
                onPress={onClose}
                disabled={loading}
              />
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:         spacing.lg,
    gap:             spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  memberAvatar: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  memberInitial: {
    ...typography.h2,
    color: '#fff',
  },
  headerInfo: {
    flex: 1,
    gap:  2,
  },
  memberName: {
    ...typography.h3,
  },
  memberDist: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  listingBox: {
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             2,
  },
  listingLabel: {
    ...typography.caption,
    color:         colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  listingTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  listingEmployer: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  body: {
    gap: spacing.md,
  },
  timerInfo: {
    flexDirection:   'row',
    gap:             spacing.sm,
    backgroundColor: colors.primary + '15',
    borderRadius:    radius.md,
    padding:         spacing.md,
    alignItems:      'flex-start',
  },
  timerIcon: {
    fontSize: 18,
  },
  timerText: {
    ...typography.caption,
    color:      colors.textSecondary,
    flex:       1,
    lineHeight: 18,
  },
  lockedBadge: {
    backgroundColor: colors.error + '20',
    borderRadius:    radius.md,
    padding:         spacing.md,
    alignItems:      'center',
  },
  lockedText: {
    ...typography.body,
    fontWeight: '600',
    color:      colors.error,
  },
  notifiedText: {
    ...typography.body,
    color:      colors.primary,
    fontWeight: '600',
    textAlign:  'center',
  },
  error: {
    ...typography.caption,
    color:     colors.error,
    textAlign: 'center',
  },
})
