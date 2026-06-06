// mobile/app/tabs/circle.tsx
// The circle tab. Shows:
//   - Radius milestone progress bar
//   - Incoming circle requests (accept/decline)
//   - Outgoing pending requests
//   - Accepted circle members with quality weights
//   - Invite prompt when circle is small

import React, { useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '../../components/ui/Screen'
import { CircleMemberCard } from '../../components/circle/CircleMemberCard'
import { PendingRequestCard } from '../../components/circle/PendingRequestCard'
import { useCircle } from '../../hooks/useCircle'
import { useCircleStore, CircleMemberView } from '../../store/circleStore'
import { useAuthStore } from '../../store/authStore'
import { colors, spacing, radius, typography } from '../../lib/theme'
import { RADIUS } from '@localloop/shared'

// ── Radius milestone progress ─────────────────
function RadiusProgress() {
  const { hunterProfile } = useAuthStore()
  if (!hunterProfile) return null

  const { radius_miles, circle_points } = hunterProfile
  const pct = ((radius_miles - RADIUS.BASE_MILES) / (RADIUS.MAX_MILES - RADIUS.BASE_MILES)) * 100
  const isMax = radius_miles >= RADIUS.MAX_MILES

  return (
    <View style={rStyles.container}>
      <View style={rStyles.row}>
        <View>
          <Text style={rStyles.radiusValue}>{radius_miles.toFixed(2)} mi radius</Text>
          <Text style={rStyles.pointsValue}>{circle_points} circle points</Text>
        </View>
        <View style={rStyles.ringIcon}>
          <Text style={rStyles.ringText}>◎</Text>
        </View>
      </View>

      <View style={rStyles.track}>
        <View style={[rStyles.fill, { width: `${Math.min(pct, 100)}%` }]} />
      </View>

      <Text style={rStyles.caption}>
        {isMax
          ? '🎉 Max radius reached! You\'re a LocalLoop legend.'
          : `Grow your circle to expand toward ${RADIUS.MAX_MILES} mi`}
      </Text>
    </View>
  )
}

const rStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    margin:          spacing.md,
    marginBottom:    0,
    gap:             spacing.sm,
    borderWidth:     1,
    borderColor:     colors.primary + '40',
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  radiusValue: {
    ...typography.h3,
    color: colors.primary,
  },
  pointsValue: {
    ...typography.caption,
    color: colors.textMuted,
  },
  ringIcon: {
    width:           52,
    height:          52,
    borderRadius:    26,
    borderWidth:     2,
    borderColor:     colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  ringText: {
    fontSize: 28,
    color:    colors.primary,
  },
  track: {
    height:          6,
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.full,
    overflow:        'hidden',
  },
  fill: {
    height:          6,
    backgroundColor: colors.primary,
    borderRadius:    radius.full,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
})

// ── Section header ────────────────────────────
function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={sStyles.container}>
      <Text style={sStyles.title}>{title}</Text>
      <View style={sStyles.badge}>
        <Text style={sStyles.badgeText}>{count}</Text>
      </View>
    </View>
  )
}

const sStyles = StyleSheet.create({
  container: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    backgroundColor:   colors.background,
  },
  title: {
    ...typography.label,
    textTransform: 'uppercase',
  },
  badge: {
    backgroundColor:   colors.surfaceLight,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical:   2,
    minWidth:          20,
    alignItems:        'center',
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize:   11,
    color:      colors.textSecondary,
  },
})

// ── Main screen ───────────────────────────────
export default function CircleTab() {
  const insets = useSafeAreaInsets()
  const { fetchCircle } = useCircle()
  const {
    members,
    pendingIncoming,
    pendingOutgoing,
    loadingMembers,
  } = useCircleStore()

  const onRefresh = useCallback(() => {
    fetchCircle()
  }, [fetchCircle])

  const sections = [
    ...(pendingIncoming.length > 0 ? [{
      key:   'incoming',
      title: 'Requests for you',
      count: pendingIncoming.length,
      data:  pendingIncoming,
    }] : []),
    ...(pendingOutgoing.length > 0 ? [{
      key:   'outgoing',
      title: 'Requests sent',
      count: pendingOutgoing.length,
      data:  pendingOutgoing,
    }] : []),
    {
      key:   'members',
      title: 'Your circle',
      count: members.length,
      data:  members,
    },
  ]

  function renderItem({ item, section }: { item: CircleMemberView; section: any }) {
    if (section.key === 'incoming') {
      return (
        <View style={styles.row}>
          <PendingRequestCard member={item} direction="incoming" />
        </View>
      )
    }
    if (section.key === 'outgoing') {
      return (
        <View style={styles.row}>
          <PendingRequestCard member={item} direction="outgoing" />
        </View>
      )
    }
    return (
      <View style={styles.row}>
        <CircleMemberCard member={item} />
      </View>
    )
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Radius progress card */}
      <RadiusProgress />

      {/* Member list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.circle_member_id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} count={section.count} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={loadingMembers}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !loadingMembers ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>◎</Text>
              <Text style={styles.emptyTitle}>Your circle is just getting started</Text>
              <Text style={styles.emptySub}>
                You're already connected to the founder. Add people you know to
                grow your radius and unlock spot requests.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: insets.bottom + spacing.xl }} />}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.listContent}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingTop: spacing.sm,
  },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
  },
  empty: {
    alignItems:        'center',
    gap:               spacing.md,
    padding:           spacing.xl,
    paddingTop:        spacing.xxl,
  },
  emptyIcon: {
    fontSize: 52,
    color:    colors.primary,
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
})
