// mobile/app/history/index.tsx
// Tabbed screen: Saved listings | Application history
// Accessible from the profile tab menu.

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { colors, spacing, radius, typography } from '../../lib/theme'

type ActiveTab = 'saved' | 'history'

// ── Saved listing card ────────────────────────
function SavedCard({ item, onUnsave }: { item: any; onUnsave: (id: string) => void }) {
  const listing = item.job_listings
  const location = listing?.employer_locations
  const employer = location?.employer_profiles

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardAvatar}>
          <Text style={styles.cardAvatarText}>
            {employer?.business_name?.charAt(0) ?? '?'}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{listing?.title}</Text>
          <Text style={styles.cardSub}>
            {employer?.business_name} · {location?.name}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.unsaveBtn}
          onPress={() => onUnsave(item.id)}
        >
          <Text style={styles.unsaveBtnText}>🔖</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.savedDate}>
        Saved {new Date(item.saved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </Text>
    </View>
  )
}

// ── Application history card ──────────────────
const STATUS_META: Record<string, { label: string; color: string }> = {
  sent:        { label: 'Sent',        color: colors.info },
  viewed:      { label: 'Viewed',      color: colors.accent },
  shortlisted: { label: 'Shortlisted', color: colors.primary },
  passed:      { label: 'Passed',      color: colors.textMuted },
}

function HistoryCard({ item, onDownload }: { item: any; onDownload: (item: any) => void }) {
  const listing  = item.job_listings
  const location = listing?.employer_locations
  const employer = location?.employer_profiles
  const media    = item.video_media
  const meta     = STATUS_META[item.status] ?? STATUS_META.sent

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {/* Thumbnail */}
        <View style={styles.thumb}>
          {media?.thumbnail_url ? (
            <Image source={{ uri: media.thumbnail_url }} style={styles.thumbImage} />
          ) : (
            <View style={styles.thumbFallback}>
              <Text style={styles.thumbIcon}>🎬</Text>
            </View>
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{listing?.title}</Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {employer?.business_name} · {location?.name}
          </Text>
          <Text style={styles.cardDate}>
            {new Date(item.submitted_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: meta.color + '25' }]}>
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      {item.is_repeat && (
        <Text style={styles.repeatNote}>
          Resubmission #{item.repeat_count}
        </Text>
      )}

      {media?.transcode_status === 'ready' && (
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={() => onDownload(item)}
        >
          <Text style={styles.downloadBtnText}>↓  Download watermarked copy</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ── Main screen ───────────────────────────────
export default function HistoryScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const { hunterProfile } = useAuthStore()

  const [activeTab, setActiveTab]   = useState<ActiveTab>('saved')
  const [saved, setSaved]           = useState<any[]>([])
  const [history, setHistory]       = useState<any[]>([])
  const [loading, setLoading]       = useState(false)

  const fetchSaved = useCallback(async () => {
    if (!hunterProfile) return
    const { data } = await supabase
      .from('saved_listings')
      .select(`
        id, saved_at,
        job_listings (
          id, title,
          employer_locations (
            name,
            employer_profiles ( business_name )
          )
        )
      `)
      .eq('hunter_id', hunterProfile.id)
      .order('saved_at', { ascending: false })

    setSaved(data ?? [])
  }, [hunterProfile?.id])

  const fetchHistory = useCallback(async () => {
    if (!hunterProfile) return
    const session = await supabase.auth.getSession()
    const token   = session.data.session?.access_token

    const res  = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/introductions/history`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    setHistory(data.history ?? [])
  }, [hunterProfile?.id])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchSaved(), fetchHistory()]).finally(() => setLoading(false))
  }, [hunterProfile?.id])

  async function handleUnsave(savedId: string) {
    await supabase.from('saved_listings').delete().eq('id', savedId)
    setSaved((s) => s.filter((i) => i.id !== savedId))
  }

  async function handleDownload(item: any) {
    // In production: generate a signed Mux MP4 download URL with watermark
    // For now we show a placeholder alert
    Alert.alert(
      'Download',
      `A watermarked copy of your introduction for ${item.job_listings?.title} will be prepared. This feature completes in Phase 7 when server-side watermarking is wired.`
    )
  }

  const currentData = activeTab === 'saved' ? saved : history
  const isEmpty     = !loading && currentData.length === 0

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My activity</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['saved', 'history'] as ActiveTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'saved' ? '🔖  Saved' : '🎬  Introductions'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={currentData}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) =>
          activeTab === 'saved'
            ? <SavedCard item={item} onUnsave={handleUnsave} />
            : <HistoryCard item={item} onDownload={handleDownload} />
        }
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => activeTab === 'saved' ? fetchSaved() : fetchHistory()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          isEmpty ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>
                {activeTab === 'saved' ? '🔖' : '🎬'}
              </Text>
              <Text style={styles.emptyTitle}>
                {activeTab === 'saved' ? 'No saved listings' : 'No introductions yet'}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === 'saved'
                  ? 'Save listings from the map to review them later.'
                  : 'Find a listing on the map and introduce yourself.'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: insets.bottom + spacing.xl }} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  backBtn:       { padding: spacing.xs },
  backText:      { fontSize: 22, color: colors.textPrimary },
  headerTitle:   { ...typography.h3, flex: 1 },
  tabBar: {
    flexDirection:   'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex:            1,
    paddingVertical: spacing.md,
    alignItems:      'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: colors.primary },
  tabText:       { ...typography.body, color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  list:          { padding: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardAvatar: {
    width:           44,
    height:          44,
    borderRadius:    radius.sm,
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cardAvatarText: { ...typography.h3, color: colors.textSecondary },
  cardInfo:      { flex: 1, gap: 2 },
  cardTitle:     { ...typography.body, fontWeight: '700' },
  cardSub:       { ...typography.caption, color: colors.textMuted },
  cardDate:      { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  savedDate:     { ...typography.caption, color: colors.textMuted },
  unsaveBtn:     { padding: spacing.xs },
  unsaveBtnText: { fontSize: 20 },
  thumb: {
    width:        56,
    height:       56,
    borderRadius: radius.sm,
    overflow:     'hidden',
    flexShrink:   0,
  },
  thumbImage:    { width: '100%', height: '100%' },
  thumbFallback: {
    width:           '100%',
    height:          '100%',
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  thumbIcon:     { fontSize: 24 },
  statusBadge: {
    borderRadius:      radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
  },
  statusText:    { ...typography.caption, fontWeight: '700', fontSize: 11 },
  repeatNote:    { ...typography.caption, color: colors.accent },
  downloadBtn: {
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.sm,
    paddingVertical: spacing.xs,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     colors.border,
  },
  downloadBtnText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
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
