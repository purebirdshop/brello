// mobile/components/listings/ListingBottomSheet.tsx
// Bottom sheet that slides up when a listing pin is tapped.
// Shows listing detail, employer info, follow button, and
// the "Introduce yourself" CTA. Phase 4 will add the
// circle swap surface to this sheet.

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { colors, spacing, radius, typography } from '../../lib/theme'
import { Button } from '../ui/Button'
import { useMapStore, ListingPin } from '../../store/mapStore'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'expo-router'
import { NearbyCircleSheet } from '../circle/NearbyCircleSheet'

interface ListingBottomSheetProps {
  listing: ListingPin | null
  onClose: () => void
}

export function ListingBottomSheet({ listing, onClose }: ListingBottomSheetProps) {
  const sheetRef   = useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['40%', '80%'], [])
  const router     = useRouter()

  const { followedLocationIds, addFollow, removeFollow } = useMapStore()
  const { hunterProfile } = useAuthStore()
  const [nearbyCircleOpen, setNearbyCircleOpen] = useState(false)

  const isFollowed = listing
    ? followedLocationIds.has(listing.employer_location_id)
    : false

  // Open/close sheet based on whether listing is selected
  useEffect(() => {
    if (listing) {
      sheetRef.current?.snapToIndex(0)
    } else {
      sheetRef.current?.close()
    }
  }, [listing?.id])

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) onClose()
  }, [onClose])

  async function handleFollow() {
    if (!hunterProfile || !listing) return

    if (isFollowed) {
      await supabase
        .from('location_follows')
        .delete()
        .eq('hunter_id', hunterProfile.id)
        .eq('employer_location_id', listing.employer_location_id)
      removeFollow(listing.employer_location_id)
    } else {
      await supabase.from('location_follows').insert({
        hunter_id:            hunterProfile.id,
        employer_location_id: listing.employer_location_id,
        notify_all:           true,
        notify_matched_only:  false,
      })
      addFollow(listing.employer_location_id)
    }
  }

  async function handleSave() {
    if (!hunterProfile || !listing) return
    await supabase.from('saved_listings').upsert({
      hunter_id:  hunterProfile.id,
      listing_id: listing.id,
    })
  }

  function handleIntroduce() {
    if (!listing) return
    // Phase 6: navigate to introduction recording screen
    router.push(`/introduce/${listing.id}` as any)
  }

  if (!listing) return null

  const postedDate = listing.posted_at
    ? new Date(listing.posted_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
      })
    : null

  return (
    <BottomSheet
      ref={sheetRef}
      index={listing ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleSheetChange}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Employer header */}
        <View style={styles.employerRow}>
          <View style={styles.employerAvatar}>
            <Text style={styles.employerInitial}>
              {listing.employer_name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.employerInfo}>
            <Text style={styles.employerName}>{listing.employer_name}</Text>
            <Text style={styles.locationName}>{listing.location_name}</Text>
          </View>

          <TouchableOpacity
            style={[styles.followBtn, isFollowed && styles.followBtnActive]}
            onPress={handleFollow}
          >
            <Text style={[styles.followBtnText, isFollowed && styles.followBtnTextActive]}>
              {isFollowed ? '★ Following' : '☆ Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Listing title */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{listing.title}</Text>
          {postedDate && (
            <Text style={styles.posted}>Posted {postedDate}</Text>
          )}
        </View>

        {/* Distance badge */}
        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              📍 {listing.distance_miles.toFixed(1)} mi away
            </Text>
          </View>
          {listing.listing_type !== 'standard' && (
            <View style={[styles.badge, styles.badgeFair]}>
              <Text style={styles.badgeText}>
                🎪 {listing.listing_type === 'fair_digital' ? 'Digital Fair' : 'Job Fair'}
              </Text>
            </View>
          )}
        </View>

        {/* Tags */}
        {listing.tags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsRow}
          >
            {listing.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Description */}
        <Text style={styles.description}>{listing.description}</Text>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label="Introduce yourself →"
            onPress={handleIntroduce}
          />
          <View style={styles.secondaryActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleSave}>
              <Text style={styles.secondaryBtnText}>🔖  Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setNearbyCircleOpen(true)}
            >
              <Text style={styles.secondaryBtnText}>👥  Circle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>

    <NearbyCircleSheet
      listing={nearbyCircleOpen ? listing : null}
      onClose={() => setNearbyCircleOpen(false)}
    />
  )
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: colors.surface,
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
    gap:        spacing.md,
  },
  employerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  employerAvatar: {
    width:           44,
    height:          44,
    borderRadius:    radius.sm,
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  employerInitial: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  employerInfo: {
    flex: 1,
    gap:  2,
  },
  employerName: {
    ...typography.body,
    fontWeight: '700',
  },
  locationName: {
    ...typography.caption,
    color: colors.textMuted,
  },
  followBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.full,
    borderWidth:       1.5,
    borderColor:       colors.border,
  },
  followBtnActive: {
    backgroundColor: colors.accent + '20',
    borderColor:     colors.accent,
  },
  followBtnText: {
    ...typography.caption,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
  followBtnTextActive: {
    color: colors.accent,
  },
  titleRow: {
    gap: 4,
  },
  title: {
    ...typography.h3,
    lineHeight: 24,
  },
  posted: {
    ...typography.caption,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
    flexWrap:      'wrap',
  },
  badge: {
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
  },
  badgeFair: {
    backgroundColor: colors.accent + '20',
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  tagsRow: {
    gap:           spacing.sm,
    paddingBottom: 2,
  },
  tag: {
    backgroundColor: colors.primary + '20',
    borderRadius:    radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
  },
  tagText: {
    ...typography.caption,
    color:      colors.primary,
    fontWeight: '600',
  },
  description: {
    ...typography.body,
    color:      colors.textSecondary,
    lineHeight: 22,
  },
  actions: {
    gap:        spacing.sm,
    paddingTop: spacing.sm,
  },
  secondaryActions: {
    flexDirection:  'row',
    gap:            spacing.sm,
  },
  secondaryBtn: {
    flex:            1,
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.md,
    paddingVertical: spacing.sm,
    alignItems:      'center',
  },
  secondaryBtnText: {
    ...typography.body,
    fontWeight: '600',
    fontSize:   14,
  },
})
