// mobile/components/listings/BusinessBottomSheet.tsx
// Bottom sheet for the business discovery layer.
// Shows location detail, follower count, active listings,
// and follow/unfollow toggle.

import React, { useMemo, useRef, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { colors, spacing, radius, typography } from '../../lib/theme'
import { Button } from '../ui/Button'
import { useMapStore, BusinessPin } from '../../store/mapStore'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'

interface BusinessBottomSheetProps {
  business: BusinessPin | null
  onClose:  () => void
}

export function BusinessBottomSheet({ business, onClose }: BusinessBottomSheetProps) {
  const sheetRef   = useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['35%', '65%'], [])

  const { followedLocationIds, addFollow, removeFollow } = useMapStore()
  const { hunterProfile } = useAuthStore()

  const isFollowed = business
    ? followedLocationIds.has(business.id)
    : false

  useEffect(() => {
    if (business) {
      sheetRef.current?.snapToIndex(0)
    } else {
      sheetRef.current?.close()
    }
  }, [business?.id])

  async function handleFollow() {
    if (!hunterProfile || !business) return

    if (isFollowed) {
      await supabase
        .from('location_follows')
        .delete()
        .eq('hunter_id', hunterProfile.id)
        .eq('employer_location_id', business.id)
      removeFollow(business.id)
    } else {
      await supabase.from('location_follows').insert({
        hunter_id:            hunterProfile.id,
        employer_location_id: business.id,
        notify_all:           true,
        notify_matched_only:  false,
      })
      addFollow(business.id)
    }
  }

  if (!business) return null

  return (
    <BottomSheet
      ref={sheetRef}
      index={business ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={(i) => { if (i === -1) onClose() }}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {business.employer_name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.info}>
            <Text style={styles.name}>{business.employer_name}</Text>
            <Text style={styles.locationName}>{business.name}</Text>
            <Text style={styles.address}>{business.address}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{business.follower_count}</Text>
            <Text style={styles.statLabel}>followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {business.distance_miles.toFixed(1)} mi
            </Text>
            <Text style={styles.statLabel}>from you</Text>
          </View>
        </View>

        {/* Follow CTA */}
        <View style={styles.followSection}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {isFollowed
              ? 'You\'ll be notified when this location posts a new opening.'
              : 'Follow to get notified when they post a new opening.'}
          </Text>

          <Button
            label={isFollowed ? '★  Following this location' : '☆  Follow this location'}
            onPress={handleFollow}
            variant={isFollowed ? 'secondary' : 'primary'}
          />
        </View>

        {/* Phase 3 note: active listings for this location shown here in next pass */}
        <View style={styles.listingsNote}>
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            Active listings from this location appear on the Jobs layer.
          </Text>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor:      colors.surface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
  },
  handle: {
    backgroundColor: colors.border,
    width:           40,
  },
  content: {
    padding:    spacing.md,
    paddingTop: spacing.sm,
    gap:        spacing.lg,
  },
  header: {
    flexDirection: 'row',
    gap:           spacing.md,
    alignItems:    'flex-start',
  },
  avatar: {
    width:           52,
    height:          52,
    borderRadius:    radius.md,
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: {
    ...typography.h2,
    color: colors.textSecondary,
  },
  info: {
    flex: 1,
    gap:  2,
  },
  name: {
    ...typography.h3,
  },
  locationName: {
    ...typography.body,
    color: colors.textSecondary,
  },
  address: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection:   'row',
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.md,
    padding:         spacing.md,
    alignItems:      'center',
    justifyContent:  'space-around',
  },
  stat: {
    alignItems: 'center',
    gap:        2,
  },
  statValue: {
    ...typography.h3,
    color: colors.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statDivider: {
    width:           1,
    height:          32,
    backgroundColor: colors.border,
  },
  followSection: {
    gap: spacing.sm,
  },
  listingsNote: {
    paddingBottom: spacing.md,
  },
})
