// mobile/components/employer/IntroductionCard.tsx
// Card used in the employer dashboard listing view.
// Shows hunter thumbnail, name, status badge, and
// employer action buttons: Follow Up, Move Forward, Modest Match.

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { colors, spacing, radius, typography } from '../../lib/theme'

export type EmployerStatus =
  | 'new'
  | 'viewed'
  | 'follow_up'
  | 'move_forward'
  | 'modest_match'
  | 'passed'

interface IntroductionCardProps {
  item:          any   // video_application row with joins
  onStatusChange: (introId: string, status: EmployerStatus) => Promise<void>
  onAddNote:     (introId: string, note: string) => Promise<void>
  onPlay:        (introId: string, playbackId: string) => void
}

const STATUS_CONFIG: Record<EmployerStatus, { label: string; color: string; icon: string }> = {
  new:          { label: 'New',          color: colors.info,        icon: '🔵' },
  viewed:       { label: 'Viewed',       color: colors.textMuted,   icon: '👁' },
  follow_up:    { label: 'Follow up',    color: colors.accent,      icon: '📌' },
  move_forward: { label: 'Move forward', color: colors.primary,     icon: '✅' },
  modest_match: { label: 'Modest match', color: colors.warning,     icon: '🟡' },
  passed:       { label: 'Passed',       color: colors.error,       icon: '✕'  },
}

const ACTION_STATUSES: EmployerStatus[] = ['follow_up', 'move_forward', 'modest_match', 'passed']

export function IntroductionCard({
  item,
  onStatusChange,
  onAddNote,
  onPlay,
}: IntroductionCardProps) {
  const hunter   = item.hunter_profiles
  const media    = item.video_media
  const status   = (item.employer_status ?? 'new') as EmployerStatus
  const config   = STATUS_CONFIG[status]
  const notes    = (item.employer_notes ?? []) as any[]

  const [expanded, setExpanded]   = useState(false)
  const [noteText, setNoteText]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [localStatus, setLocalStatus] = useState<EmployerStatus>(status)

  async function handleStatusChange(newStatus: EmployerStatus) {
    setLocalStatus(newStatus)
    await onStatusChange(item.id, newStatus)
  }

  async function handleAddNote() {
    if (!noteText.trim()) return
    setSaving(true)
    await onAddNote(item.id, noteText.trim())
    setNoteText('')
    setSaving(false)
  }

  const currentConfig = STATUS_CONFIG[localStatus]

  return (
    <View style={styles.card}>
      {/* Header row */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.85}
      >
        {/* Thumbnail */}
        <TouchableOpacity
          style={styles.thumb}
          onPress={() => media?.mux_playback_id && onPlay(item.id, media.mux_playback_id)}
        >
          {media?.thumbnail_url ? (
            <>
              <Image source={{ uri: media.thumbnail_url }} style={styles.thumbImage} />
              <View style={styles.playIcon}>
                <Text style={styles.playIconText}>▶</Text>
              </View>
            </>
          ) : (
            <View style={styles.thumbFallback}>
              <Text style={styles.thumbFallbackText}>🎬</Text>
            </View>
          )}
          {item.status === 'sent' && (
            <View style={styles.newDot} />
          )}
        </TouchableOpacity>

        {/* Hunter info */}
        <View style={styles.info}>
          <Text style={styles.hunterName}>{hunter?.display_name ?? 'Unknown'}</Text>
          {hunter?.bio && (
            <Text style={styles.hunterBio} numberOfLines={1}>{hunter.bio}</Text>
          )}
          <Text style={styles.submittedDate}>
            {new Date(item.submitted_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric',
            })}
            {item.is_repeat && (
              <Text style={styles.repeatTag}> · Resubmission #{item.repeat_count}</Text>
            )}
          </Text>
        </View>

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: currentConfig.color + '20' }]}>
          <Text style={styles.statusIcon}>{currentConfig.icon}</Text>
          <Text style={[styles.statusLabel, { color: currentConfig.color }]}>
            {currentConfig.label}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Expanded: action buttons + notes */}
      {expanded && (
        <View style={styles.expanded}>
          {/* Hunter links */}
          <View style={styles.linksRow}>
            {hunter?.linkedin_url && (
              <View style={styles.linkBadge}>
                <Text style={styles.linkText}>💼 LinkedIn</Text>
              </View>
            )}
            {hunter?.github_url && (
              <View style={styles.linkBadge}>
                <Text style={styles.linkText}>👾 GitHub</Text>
              </View>
            )}
            {media?.duration_seconds && (
              <View style={styles.linkBadge}>
                <Text style={styles.linkText}>
                  ⏱ {Math.round(media.duration_seconds)}s
                </Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <Text style={styles.sectionLabel}>Mark as</Text>
          <View style={styles.actionsGrid}>
            {ACTION_STATUSES.map((s) => {
              const cfg     = STATUS_CONFIG[s]
              const isActive = localStatus === s
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.actionBtn,
                    isActive && { backgroundColor: cfg.color + '20', borderColor: cfg.color },
                  ]}
                  onPress={() => handleStatusChange(s)}
                >
                  <Text style={styles.actionIcon}>{cfg.icon}</Text>
                  <Text style={[styles.actionLabel, isActive && { color: cfg.color }]}>
                    {cfg.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Notes */}
          {notes.length > 0 && (
            <View style={styles.notesSection}>
              <Text style={styles.sectionLabel}>Notes</Text>
              {notes.map((n: any, i: number) => (
                <View key={i} style={styles.noteRow}>
                  <Text style={styles.noteText}>{n.text}</Text>
                  <Text style={styles.noteDate}>
                    {new Date(n.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric',
                    })}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Add note */}
          <View style={styles.noteInputRow}>
            <TextInput
              style={styles.noteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Add a note…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <TouchableOpacity
              style={[styles.noteSubmitBtn, !noteText.trim() && styles.noteSubmitBtnDisabled]}
              onPress={handleAddNote}
              disabled={!noteText.trim() || saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.noteSubmitText}>Add</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
    padding:       spacing.md,
  },
  thumb: {
    width:        64,
    height:       64,
    borderRadius: radius.sm,
    overflow:     'hidden',
    flexShrink:   0,
    position:     'relative',
  },
  thumbImage: {
    width:  '100%',
    height: '100%',
  },
  thumbFallback: {
    width:           '100%',
    height:          '100%',
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  thumbFallbackText: { fontSize: 28 },
  playIcon: {
    position:        'absolute',
    bottom:          4,
    right:           4,
    width:           22,
    height:          22,
    borderRadius:    11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  playIconText: { fontSize: 10, color: '#fff', marginLeft: 1 },
  newDot: {
    position:        'absolute',
    top:             4,
    left:            4,
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: colors.primary,
    borderWidth:     1.5,
    borderColor:     colors.surface,
  },
  info:           { flex: 1, gap: 2 },
  hunterName:     { ...typography.body, fontWeight: '700' },
  hunterBio:      { ...typography.caption, color: colors.textMuted },
  submittedDate:  { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  repeatTag:      { color: colors.accent, fontWeight: '600' },
  statusBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       'transparent',
  },
  statusIcon:  { fontSize: 12 },
  statusLabel: { ...typography.caption, fontWeight: '700', fontSize: 10 },
  expanded: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding:        spacing.md,
    gap:            spacing.md,
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  linkBadge: {
    backgroundColor:   colors.surfaceLight,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
  },
  linkText:      { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  sectionLabel:  { ...typography.label, textTransform: 'uppercase' },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },
  actionBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    backgroundColor:   colors.surfaceLight,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderWidth:       1.5,
    borderColor:       colors.border,
  },
  actionIcon:  { fontSize: 14 },
  actionLabel: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },
  notesSection: { gap: spacing.sm },
  noteRow: {
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.sm,
    padding:         spacing.sm,
    gap:             2,
  },
  noteText:     { ...typography.caption, color: colors.textPrimary, lineHeight: 18 },
  noteDate:     { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  noteInputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  noteInput: {
    flex:            1,
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.md,
    padding:         spacing.sm,
    ...typography.caption,
    color:           colors.textPrimary,
    minHeight:       40,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  noteSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    height:          40,
    alignItems:      'center',
    justifyContent:  'center',
  },
  noteSubmitBtnDisabled: { opacity: 0.4 },
  noteSubmitText: { ...typography.caption, fontWeight: '700', color: '#fff' },
})
