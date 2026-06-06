// mobile/app/notifications.tsx
// Full notification log screen. Accessible from the
// profile tab badge or a deep link. Shows all notifications
// newest first with unread indicators.

import React, { useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NotificationItem } from '../components/notifications/NotificationItem'
import { useNotifications } from '../hooks/useNotifications'
import { useNotificationStore, NotificationLogItem } from '../store/notificationStore'
import { colors, spacing, typography, radius } from '../lib/theme'

export default function NotificationsScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()

  const { fetchNotifications, handleMarkRead, handleMarkAllRead, handleNotificationTap } = useNotifications()
  const { items, unreadCount, loading } = useNotificationStore()

  useEffect(() => {
    fetchNotifications()
  }, [])

  function handlePress(item: NotificationLogItem) {
    handleMarkRead(item.id)
    handleNotificationTap({ request: { content: { data: { type: item.type, reference_id: item.reference_id } } } } as any)
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Notifications</Text>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <NotificationItem item={item} onPress={handlePress} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchNotifications}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySub}>
                Swap activity, new listings from businesses you follow,
                and job fair announcements will appear here.
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
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  backBtn: {
    padding: spacing.xs,
  },
  backText: {
    fontSize: 22,
    color:    colors.textPrimary,
  },
  headerTitle: {
    ...typography.h3,
    flex: 1,
  },
  markAllBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.full,
    backgroundColor:   colors.surfaceLight,
  },
  markAllText: {
    ...typography.caption,
    fontWeight: '600',
    color:      colors.primary,
  },
  separator: {
    height:          1,
    backgroundColor: colors.border,
    opacity:         0.3,
    marginLeft:      spacing.md + 44 + spacing.md,
  },
  empty: {
    alignItems:        'center',
    gap:               spacing.md,
    padding:           spacing.xl,
    paddingTop:        spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
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
