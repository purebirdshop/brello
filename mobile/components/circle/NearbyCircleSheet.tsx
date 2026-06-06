// mobile/components/circle/NearbyCircleSheet.tsx
// Bottom sheet that slides up from the listing detail.
// Shows circle members physically near the listing location,
// their swap availability, and lets you initiate a spot request.

import React, { useMemo, useRef, useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native'
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet'
import { colors, spacing, radius, typography } from '../../lib/theme'
import { CircleMemberCard } from './CircleMemberCard'
import { SwapRequestModal } from './SwapRequestModal'
import { useCircleStore, NearbyCircleMember, CircleMemberView } from '../../store/circleStore'
import { useNearbyCircle } from '../../hooks/useNearbyCircle'
import { ListingPin } from '../../store/mapStore'

interface NearbyCircleSheetProps {
  listing:  ListingPin | null
  onClose:  () => void
}

export function NearbyCircleSheet({ listing, onClose }: NearbyCircleSheetProps) {
  const sheetRef   = useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['50%', '90%'], [])

  const { nearbyForListing, loadingNearby, members } = useCircleStore()
  const { fetchNearby, clearNearby }                 = useNearbyCircle()

  const [swapTarget, setSwapTarget] = useState<NearbyCircleMember | null>(null)
  const [modalVisible, setModal]    = useState(false)

  useEffect(() => {
    if (listing) {
      sheetRef.current?.snapToIndex(0)
      fetchNearby(listing.employer_location_id)
    } else {
      sheetRef.current?.close()
      clearNearby()
    }
  }, [listing?.id])

  function handleRequestSwap(nearby: NearbyCircleMember) {
    setSwapTarget(nearby)
    setModal(true)
  }

  // Merge nearby data with full member data for quality weight display
  function toCardView(nearby: NearbyCircleMember): CircleMemberView {
    const full = members.find((m) => m.hunter_profile_id === nearby.member_hunter_id)
    return {
      circle_member_id:   full?.circle_member_id ?? nearby.member_hunter_id,
      hunter_profile_id:  nearby.member_hunter_id,
      display_name:       nearby.display_name,
      avatar_url:         nearby.avatar_url,
      bio:                full?.bio ?? null,
      swap_status:        nearby.swap_status,
      quality_weight:     full?.quality_weight ?? 0.3,
      completed_swaps:    full?.completed_swaps ?? 0,
      radius_miles:       full?.radius_miles ?? 1,
      status:             'accepted',
      i_am_requester:     false,
    }
  }

  if (!listing) return null

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={listing ? 0 : -1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onChange={(i) => { if (i === -1) onClose() }}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Circle near this listing</Text>
          <Text style={styles.sub}>
            {listing.employer_name} · {listing.location_name}
          </Text>
        </View>

        {loadingNearby ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Finding your circle…</Text>
          </View>
        ) : nearbyForListing.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No one nearby</Text>
            <Text style={styles.emptySub}>
              None of your circle members are currently near this location.
              Grow your circle to increase your chances of finding a spot partner.
            </Text>
          </View>
        ) : (
          <BottomSheetFlatList
            data={nearbyForListing}
            keyExtractor={(m) => m.member_hunter_id}
            renderItem={({ item }) => (
              <CircleMemberCard
                member={toCardView(item)}
                distanceMiles={item.distance_miles}
                showSwapButton
                onRequestSwap={() => handleRequestSwap(item)}
              />
            )}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          />
        )}
      </BottomSheet>

      <SwapRequestModal
        visible={modalVisible}
        member={swapTarget}
        listingId={listing.id}
        listingTitle={listing.title}
        employerName={listing.employer_name}
        onClose={() => { setModal(false); setSwapTarget(null) }}
        onSuccess={() => { setModal(false); onClose() }}
      />
    </>
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
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:               2,
  },
  title: {
    ...typography.h3,
  },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.md,
    padding:        spacing.xl,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    ...typography.h3,
    textAlign: 'center',
  },
  emptySub: {
    ...typography.body,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 22,
  },
  list: {
    padding: spacing.md,
  },
})
