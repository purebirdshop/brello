// mobile/app/employer/listing/[listingId].tsx
// Employer introduction review dashboard for a specific listing.
// Shows all introductions with filter tabs by status,
// video thumbnail + Mux playback link, status actions, and notes.

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../../lib/supabase'
import { IntroductionCard, EmployerStatus } from '../../../components/employer/IntroductionCard'
import { colors, spacing, radius, typography } from '../../../lib/theme'

type FilterTab = 'all' | 'new' | 'follow_up' | 'move_forward' | 'modest_match' | 'passed'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',          label: 'All'          },
  { key: 'new',          label: '🔵 New'        },
  { key: 'move_forward', label: '✅ Forward'    },
  { key: 'follow_up',    label: '📌 Follow up'  },
  { key: 'modest_match', label: '🟡 Modest'     },
  { key: 'passed',       label: '✕ Passed'      },
]

export default function EmployerListingDashboard() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>()
  const router        = useRouter()
  const insets        = useSafeAreaInsets()

  const [introductions, setIntroductions] = useState<any[]>([])
  const [listing, setListing]             = useState<any>(null)
  const [loading, setLoading]             = useState(true)
  const [activeFilter, setActiveFilter]   = useState<FilterTab>('all')

  const fetchIntroductions = useCallback(async () => {
    if (!listingId) return
    setLoading(true)

    try {
      const session = await supabase.auth.getSession()
      const token   = session.data.session?.access_token

      const [listingRes, introsRes] = await Promise.all([
        supabase
          .from('job_listings')
          .select(`
            id, title, status, application_count, resubmission_cap,
            employer_locations ( name, employer_profiles ( business_name ) )
          `)
          .eq('id', listingId)
          .single(),

        fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/introductions/listing/${listingId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then((r) => r.json()),
      ])

      setListing(listingRes.data)
      setIntroductions(introsRes.introductions ?? [])
    } catch (err) {
      console.error('[EmployerDashboard] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [listingId])

  useEffect(() => { fetchIntroductions() }, [listingId])

  // Mark as viewed when first loaded (server already handles status upgrade)
  useEffect(() => {
    introductions
      .filter((i) => i.status === 'sent')
      .forEach(async (i) => {
        const session = await supabase.auth.getSession()
        const token   = session.data.session?.access_token
        await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/introductions/${i.id}/view`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
        )
      })
  }, [introductions.length])

  async function handleStatusChange(introId: string, status: EmployerStatus) {
    const session = await supabase.auth.getSession()
    const token   = session.data.session?.access_token

    await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/introductions/${introId}/status`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ employer_status: status }),
      }
    )

    setIntroductions((prev) =>
      prev.map((i) => i.id === introId ? { ...i, employer_status: status } : i)
    )
  }

  async function handleAddNote(introId: string, note: string) {
    const session = await supabase.auth.getSession()
    const token   = session.data.session?.access_token

    const res  = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/introductions/${introId}/note`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ note }),
      }
    )
    const data = await res.json()

    setIntroductions((prev) =>
      prev.map((i) =>
        i.id === introId
          ? { ...i, employer_notes: [...(i.employer_notes ?? []), data.note] }
          : i
      )
    )
  }

  async function handlePlay(introId: string, playbackId: string) {
    const session = await supabase.auth.getSession()
    const token   = session.data.session?.access_token

    const res  = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/introductions/${introId}/playback`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()

    if (data.playback_url) {
      // Open Mux HLS stream in device browser / native player
      Linking.openURL(data.playback_url)
    }
  }

  const filtered = activeFilter === 'all'
    ? introductions
    : introductions.filter((i) => (i.employer_status ?? 'new') === activeFilter)

  const employer = listing?.employer_locations?.employer_profiles?.business_name ?? ''
  const location = listing?.employer_locations?.name ?? ''

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {listing?.title ?? 'Loading…'}
          </Text>
          <Text style={styles.headerSub}>
            {employer}{location ? ` · ${location}` : ''}
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{introductions.length}</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <FlatList
        data={FILTER_TABS}
        horizontal
        keyExtractor={(t) => t.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        renderItem={({ item: tab }) => {
          const count = tab.key === 'all'
            ? introductions.length
            : introductions.filter((i) => (i.employer_status ?? 'new') === tab.key).length

          return (
            <TouchableOpacity
              style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
              onPress={() => setActiveFilter(tab.key)}
            >
              <Text style={[
                styles.filterTabText,
                activeFilter === tab.key && styles.filterTabTextActive,
              ]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={styles.filterCount}>
                  <Text style={styles.filterCountText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        }}
      />

      {/* Introduction list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <IntroductionCard
              item={item}
              onStatusChange={handleStatusChange}
              onAddNote={handleAddNote}
              onPlay={handlePlay}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchIntroductions}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎬</Text>
              <Text style={styles.emptyTitle}>
                {activeFilter === 'all'
                  ? 'No introductions yet'
                  : `No ${activeFilter.replace('_', ' ')} introductions`}
              </Text>
              <Text style={styles.emptySub}>
                {activeFilter === 'all'
                  ? 'Introductions will appear here as hunters apply.'
                  : 'Try a different filter.'}
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: insets.bottom + spacing.xl }} />}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  backBtn:     { padding: spacing.xs },
  backText:    { fontSize: 22, color: colors.textPrimary },
  headerInfo:  { flex: 1, gap: 2 },
  headerTitle: { ...typography.h3 },
  headerSub:   { ...typography.caption, color: colors.textMuted },
  countBadge: {
    backgroundColor:   colors.primary,
    borderRadius:      radius.full,
    width:             28,
    height:            28,
    alignItems:        'center',
    justifyContent:    'center',
  },
  countText:   { ...typography.caption, fontWeight: '800', color: '#fff' },
  filterBar: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    gap:               spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterTab: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.full,
    backgroundColor:   colors.surface,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor:     colors.primary,
  },
  filterTabText:       { ...typography.caption, fontWeight: '600', color: colors.textSecondary },
  filterTabTextActive: { color: '#fff' },
  filterCount: {
    backgroundColor:   'rgba(255,255,255,0.25)',
    borderRadius:      radius.full,
    minWidth:          18,
    height:            18,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 4,
  },
  filterCountText: { ...typography.caption, fontSize: 10, fontWeight: '800', color: '#fff' },
  list:    { padding: spacing.md },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
