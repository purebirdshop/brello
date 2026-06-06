// mobile/components/notifications/NotificationItem.tsx
// Single row in the notification log. Tapping marks it read
// and routes to the relevant screen.

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors, spacing, radius, typography } from '../../lib/theme'
import { NotificationLogItem } from '../../store/notificationStore'

interface NotificationItemProps {
  item:    NotificationLogItem
  onPress: (item: NotificationLogItem) => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)

  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function NotificationItem({ item, onPress }: NotificationItemProps) {
  const isUnread = !item.read_at

  return (
    <TouchableOpacity
      style={[styles.row, isUnread && styles.rowUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      {/* Unread dot */}
      {isUnread && <View style={styles.unreadDot} />}

      {/* Icon */}
      <View style={[styles.iconWrap, isUnread && styles.iconWrapUnread]}>
        <Text style={styles.icon}>{item.icon}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, isUnread && styles.titleUnread]}>
          {item.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.time}>{timeAgo(item.sent_at)}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    position:          'relative',
  },
  rowUnread: {
    backgroundColor: colors.primary + '0a',
  },
  unreadDot: {
    position:        'absolute',
    left:            6,
    top:             20,
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: colors.primary,
  },
  iconWrap: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  iconWrapUnread: {
    backgroundColor: colors.primary + '20',
  },
  icon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    gap:  2,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
  titleUnread: {
    color: colors.textPrimary,
  },
  body: {
    ...typography.caption,
    color:      colors.textMuted,
    lineHeight: 18,
  },
  time: {
    ...typography.caption,
    color:    colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
})
