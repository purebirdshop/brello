// mobile/app/tabs/profile.tsx
// Hunter profile tab. Shows profile summary, notification
// badge, useful links, and sign out. Full profile editing
// is Phase 6.

import React, { useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, radius, typography } from '../../lib/theme'
import { signOut } from '../../lib/authService'
import { useAuthStore } from '../../store/authStore'
import { useNotifications } from '../../hooks/useNotifications'
import { useNotificationStore } from '../../store/notificationStore'
import { QualityWeightBar } from '../../components/circle/QualityWeightBar'
import { RADIUS } from '@localloop/shared'

export default function ProfileTab() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()

  const { hunterProfile, user } = useAuthStore()
  const { unreadCount }         = useNotificationStore()
  const { fetchNotifications }  = useNotifications()

  useEffect(() => {
    fetchNotifications()
  }, [])

  const radiusPct = hunterProfile
    ? ((hunterProfile.radius_miles - RADIUS.BASE_MILES) / (RADIUS.MAX_MILES - RADIUS.BASE_MILES)) * 100
    : 0

  function MenuItem({
    icon, label, badge, onPress
  }: { icon: string; label: string; badge?: number; onPress: () => void }) {
    return (
      <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.75}>
        <Text style={styles.menuIcon}>{icon}</Text>
        <Text style={styles.menuLabel}>{label}</Text>
        {badge != null && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
        <Text style={styles.menuChevron}>›</Text>
      </TouchableOpacity>
    )
  }

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar + name */}
      <View style={styles.hero}>
        <View style={styles.avatarWrap}>
          {hunterProfile?.avatar_url ? (
            <Image source={{ uri: hunterProfile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {hunterProfile?.display_name?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.displayName}>
          {hunterProfile?.display_name ?? 'Your profile'}
        </Text>
        {hunterProfile?.bio && (
          <Text style={styles.bio}>{hunterProfile.bio}</Text>
        )}
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Radius card */}
      {hunterProfile && (
        <View style={styles.radiusCard}>
          <View style={styles.radiusRow}>
            <Text style={styles.radiusLabel}>Radius</Text>
            <Text style={styles.radiusValue}>{hunterProfile.radius_miles.toFixed(2)} mi</Text>
          </View>
          <View style={styles.radiusTrack}>
            <View style={[styles.radiusFill, { width: `${Math.min(radiusPct, 100)}%` }]} />
          </View>
          <View style={styles.radiusRow}>
            <Text style={styles.radiusSub}>{hunterProfile.circle_points} circle points</Text>
            <Text style={styles.radiusSub}>max {RADIUS.MAX_MILES} mi</Text>
          </View>
        </View>
      )}

      {/* Menu */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>

        <View style={styles.menuGroup}>
          <MenuItem
            icon="🔔"
            label="Notifications"
            badge={unreadCount}
            onPress={() => router.push('/notifications' as any)}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="🔖"
            label="Saved listings"
            onPress={() => router.push('/saved' as any)}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="📄"
            label="Application history"
            onPress={() => router.push('/history' as any)}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="👤"
            label="Edit profile"
            onPress={() => router.push('/edit-profile' as any)}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="🎯"
            label="My skills"
            onPress={() => router.push('/skills' as any)}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="💼"
            label="Import from LinkedIn"
            onPress={() => router.push('/linkedin-import' as any)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Links</Text>

        <View style={styles.menuGroup}>
          {hunterProfile?.linkedin_url && (
            <>
              <MenuItem icon="💼" label="LinkedIn" onPress={() => {}} />
              <View style={styles.menuDivider} />
            </>
          )}
          {hunterProfile?.github_url && (
            <>
              <MenuItem icon="👾" label="GitHub" onPress={() => {}} />
              <View style={styles.menuDivider} />
            </>
          )}
          <MenuItem icon="📋" label="Resume" onPress={() => {}} />
        </View>
      </View>

      {/* Sign out */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={signOut}
        activeOpacity={0.8}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <View style={{ height: insets.bottom + spacing.xl }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  hero: {
    alignItems:  'center',
    gap:         spacing.sm,
    paddingTop:  spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  avatarWrap: {
    marginBottom: spacing.xs,
  },
  avatar: {
    width:        80,
    height:       80,
    borderRadius: 40,
  },
  avatarFallback: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarInitial: {
    fontSize:   36,
    fontWeight: '700',
    color:      '#fff',
  },
  displayName: {
    ...typography.h2,
    textAlign: 'center',
  },
  bio: {
    ...typography.body,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 22,
  },
  email: {
    ...typography.caption,
    color: colors.textMuted,
  },
  radiusCard: {
    backgroundColor:   colors.surface,
    borderRadius:      radius.md,
    padding:           spacing.md,
    marginHorizontal:  spacing.md,
    gap:               spacing.xs,
    borderWidth:       1,
    borderColor:       colors.primary + '30',
  },
  radiusRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  radiusLabel: {
    ...typography.label,
    textTransform: 'uppercase',
  },
  radiusValue: {
    ...typography.h3,
    color: colors.primary,
  },
  radiusTrack: {
    height:          6,
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.full,
    overflow:        'hidden',
  },
  radiusFill: {
    height:          6,
    backgroundColor: colors.primary,
    borderRadius:    radius.full,
  },
  radiusSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  section: {
    gap:              spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    textTransform: 'uppercase',
    paddingLeft:   spacing.xs,
  },
  menuGroup: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     colors.border,
  },
  menuItem: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
  },
  menuIcon: {
    fontSize: 18,
    width:    24,
    textAlign: 'center',
  },
  menuLabel: {
    ...typography.body,
    flex: 1,
  },
  badge: {
    backgroundColor:   colors.error,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical:   2,
    minWidth:          20,
    alignItems:        'center',
  },
  badgeText: {
    ...typography.caption,
    color:      '#fff',
    fontWeight: '700',
    fontSize:   10,
  },
  menuChevron: {
    fontSize: 20,
    color:    colors.textMuted,
  },
  menuDivider: {
    height:     1,
    backgroundColor: colors.border,
    opacity:    0.4,
    marginLeft: spacing.md + 24 + spacing.md,
  },
  signOutBtn: {
    marginHorizontal:  spacing.md,
    backgroundColor:   colors.surfaceLight,
    borderRadius:      radius.md,
    padding:           spacing.md,
    alignItems:        'center',
    borderWidth:       1,
    borderColor:       colors.border,
  },
  signOutText: {
    ...typography.body,
    fontWeight: '600',
    color:      colors.error,
  },
})
