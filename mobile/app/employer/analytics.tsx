// mobile/app/employer/analytics.tsx
// Employer analytics dashboard.
// Shows per-location summary cards and a 30-day
// follower + introduction trend for each location.

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { colors, spacing, radius, typography } from '../../lib/theme'

// ── Spark line ────────────────────────────────
// Simple inline bar chart from snapshot array

function SparkLine({
  data,
  field,
  color,
}: {
  data:  any[]
  field: string
  color: string
}) {
  if (!data.length) return null
  const values = data.map((d) => d[field] ?? 0)
  const max    = Math.max(...values, 1)

  return (
    <View style={sparkStyles.row}>
      {values.slice(-14).map((v, i) => (
        <View
          key={i}
          style={[
            sparkStyles.bar,
            {
              height:          Math.max(2, (v / max) * 28),
              backgroundColor: v > 0 ? color : colors.surfaceLight,
            },
          ]}
        />
      ))}
    </View>
  )
}

const sparkStyles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    gap:            2,
    height:         30,
  },
  bar: {
    flex:         1,
    borderRadius: 1,
    minHeight:    2,
  },
})

// ── Location analytics card ───────────────────

function LocationCard({
  location,
  snapshots,
  onPress,
}: {
  location:  any
  snapshots: any[]
  onPress:   () => void
}) {
  const lastSnap = snapshots[snapshots.length - 1]

  return (
    <TouchableOpacity
      style={styles.locationCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.locationCardHeader}>
        <View style={styles.locationAvatar}>
          <Text style={styles.locationAvatarText}>
            {location.name?.charAt(0) ?? '?'}
          </Text>
        </View>
        <View style={styles.locationInfo}>
          <Text style={styles.locationName}>{location.name}</Text>
          <Text style={styles.locationAddress} numberOfLines={1}>
            {location.address}
          </Text>
        </View>
        {!location.is_active && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>Inactive</Text>
          </View>
        )}
      </View>

      {/* Stat row */}
      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{location.follower_count ?? 0}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{location.active_listings ?? 0}</Text>
          <Text style={styles.statLabel}>Active listings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{location.total_intros ?? 0}</Text>
          <Text style={styles.statLabel}>Introductions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            +{location.today_new_intros ?? 0}
          </Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
      </View>

      {/* Spark lines */}
      {snapshots.length > 1 && (
        <View style={styles.sparkSection}>
          <View style={styles.sparkRow}>
            <Text style={styles.sparkLabel}>Followers</Text>
            <SparkLine data={snapshots} field="follower_count" color={colors.info} />
          </View>
          <View style={styles.sparkRow}>
            <Text style={styles.sparkLabel}>Intros</Text>
            <SparkLine data={snapshots} field="new_intro_count" color={colors.primary} />
          </View>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ── Main screen ───────────────────────────────

export default function EmployerAnalyticsScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()

  const [locations, setLocations]   = useState<any[]>([])
  const [snapshots, setSnapshots]   = useState<Record<string, any[]>>({})
  const [loading, setLoading]       = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const session = await supabase.auth.getSession()
    const token   = session.data.session?.access_token

    try {
      // Fetch location summaries
      const locRes  = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/analytics/locations`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const locData = await locRes.json()
      const locs    = locData.locations ?? []
      setLocations(locs)

      // Fetch 30-day snapshots for each location
      const snapData: Record<string, any[]> = {}
      await Promise.all(
        locs.map(async (loc: any) => {
          const res  = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL}/analytics/locations/${loc.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const data = await res.json()
          snapData[loc.id] = data.snapshots ?? []
        })
      )
      setSnapshots(snapData)
    } catch (err) {
      console.error('[Analytics] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [])

  const totalFollowers  = locations.reduce((s, l) => s + (l.follower_count ?? 0), 0)
  const totalIntros     = locations.reduce((s, l) => s + (l.total_intros   ?? 0), 0)
  const todayIntros     = locations.reduce((s, l) => s + (l.today_new_intros ?? 0), 0)

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchData}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalFollowers}</Text>
            <Text style={styles.summaryLabel}>Total followers</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalIntros}</Text>
            <Text style={styles.summaryLabel}>Total intros</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: colors.primary + '40' }]}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>
              +{todayIntros}
            </Text>
            <Text style={styles.summaryLabel}>Today</Text>
          </View>
        </View>

        {/* Location cards */}
        {loading && locations.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : locations.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No analytics yet</Text>
            <Text style={styles.emptySub}>
              Analytics appear once you have active locations and listings.
            </Text>
          </View>
        ) : (
          locations.map((loc) => (
            <LocationCard
              key={loc.id}
              location={loc}
              snapshots={snapshots[loc.id] ?? []}
              onPress={() =>
                router.push(`/employer/listing/${loc.id}` as any)
              }
            />
          ))
        )}

        <View style={{ height: insets.bottom + spacing.xl }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  backBtn:      { padding: spacing.xs },
  backText:     { fontSize: 22, color: colors.textPrimary },
  headerTitle:  { ...typography.h3, flex: 1 },
  content:      { padding: spacing.md, gap: spacing.md },
  summaryRow:   { flexDirection: 'row', gap: spacing.sm },
  summaryCard: {
    flex:            1,
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    alignItems:      'center',
    gap:             2,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  summaryValue:  { ...typography.h2, fontSize: 20 },
  summaryLabel:  { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  locationCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  locationCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  locationAvatar: {
    width:           44,
    height:          44,
    borderRadius:    radius.sm,
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  locationAvatarText: { ...typography.h3, color: colors.textSecondary },
  locationInfo:       { flex: 1, gap: 2 },
  locationName:       { ...typography.body, fontWeight: '700' },
  locationAddress:    { ...typography.caption, color: colors.textMuted },
  inactiveBadge: {
    backgroundColor:   colors.surfaceLight,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical:   2,
  },
  inactiveBadgeText:  { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  statRow: {
    flexDirection:   'row',
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.sm,
    padding:         spacing.sm,
    alignItems:      'center',
  },
  stat:           { flex: 1, alignItems: 'center', gap: 2 },
  statValue:      { ...typography.body, fontWeight: '800', fontSize: 15 },
  statLabel:      { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  statDivider:    { width: 1, height: 28, backgroundColor: colors.border },
  sparkSection:   { gap: spacing.xs },
  sparkRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  sparkLabel:     { ...typography.caption, color: colors.textMuted, width: 56 },
  empty: {
    alignItems: 'center',
    gap:        spacing.md,
    padding:    spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { ...typography.h3, textAlign: 'center' },
  emptySub:   { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
})
