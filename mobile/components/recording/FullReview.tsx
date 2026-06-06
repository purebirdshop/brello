// mobile/components/recording/FullReview.tsx
// After all 3 phases are recorded and individually approved,
// plays them in sequence so the hunter can review the full
// introduction before submitting. Prompt text overlays each segment.

import React, { useRef, useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av'
import { colors, spacing, radius, typography } from '../../lib/theme'
import { PhaseClip } from '../../store/recordingStore'

const PHASE_LABELS = ['Introduction', 'Prompt 1', 'Prompt 2']

interface FullReviewProps {
  clips:       PhaseClip[]
  onSubmit:    () => void
  onRetakeAll: () => void
  submitting:  boolean
}

export function FullReview({
  clips,
  onSubmit,
  onRetakeAll,
  submitting,
}: FullReviewProps) {
  const videoRef      = useRef<Video>(null)
  const [currentClip, setCurrentClip] = useState(0)
  const [playing, setPlaying]         = useState(false)

  const clip = clips[currentClip]

  // Auto-advance when a clip finishes
  async function handlePlaybackUpdate(status: AVPlaybackStatus) {
    if (!status.isLoaded) return
    setPlaying(status.isPlaying)

    if (status.didJustFinish) {
      if (currentClip < clips.length - 1) {
        setCurrentClip((c) => c + 1)
      } else {
        setPlaying(false)
      }
    }
  }

  // When clip changes, auto-play
  useEffect(() => {
    if (videoRef.current && clip) {
      videoRef.current.unloadAsync().then(() => {
        videoRef.current?.loadAsync({ uri: clip.uri }, {}, false).then(() => {
          videoRef.current?.playAsync()
        })
      })
    }
  }, [currentClip])

  async function handlePlayAll() {
    setCurrentClip(0)
    setPlaying(true)
  }

  return (
    <View style={styles.root}>
      {/* Video preview */}
      <View style={styles.videoWrap}>
        {clip && (
          <Video
            ref={videoRef}
            source={{ uri: clip.uri }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            onPlaybackStatusUpdate={handlePlaybackUpdate}
          />
        )}

        {/* Prompt overlay */}
        {clip?.promptText && (
          <View style={styles.promptBox} pointerEvents="none">
            <Text style={styles.promptText}>{clip.promptText}</Text>
          </View>
        )}

        {/* Phase indicator dots */}
        <View style={styles.phaseDots} pointerEvents="none">
          {clips.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentClip && styles.dotActive]}
            />
          ))}
        </View>

        {/* Phase label */}
        <View style={styles.labelBadge} pointerEvents="none">
          <Text style={styles.labelText}>{PHASE_LABELS[currentClip]}</Text>
        </View>

        {/* Play-all button when stopped */}
        {!playing && (
          <TouchableOpacity style={styles.playOverlay} onPress={handlePlayAll}>
            <View style={styles.playBtn}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Clip scrubber */}
      <View style={styles.scrubber}>
        {clips.map((c, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.scrubItem, i === currentClip && styles.scrubItemActive]}
            onPress={() => { setCurrentClip(i); setPlaying(false) }}
          >
            <Text style={styles.scrubLabel}>{PHASE_LABELS[i]}</Text>
            <Text style={styles.scrubDur}>
              {c ? Math.round(c.durationMs / 1000) : 0}s
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Text style={styles.readyText}>Ready to send?</Text>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={onSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Send introduction →</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.retakeBtn}
          onPress={onRetakeAll}
          disabled={submitting}
        >
          <Text style={styles.retakeBtnText}>↺  Start over</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#000',
  },
  videoWrap: {
    flex:     1,
    position: 'relative',
  },
  promptBox: {
    position:          'absolute',
    bottom:            80,
    left:              spacing.md,
    right:             spacing.md,
    backgroundColor:   'rgba(0,0,0,0.65)',
    borderRadius:      radius.md,
    padding:           spacing.md,
    borderLeftWidth:   3,
    borderLeftColor:   colors.primary,
  },
  promptText: {
    ...typography.body,
    color:      '#fff',
    lineHeight: 22,
  },
  phaseDots: {
    position:       'absolute',
    top:            spacing.lg,
    left:           0,
    right:          0,
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            6,
  },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width:           18,
  },
  labelBadge: {
    position:          'absolute',
    top:               spacing.xl + 16,
    left:              spacing.md,
    backgroundColor:   'rgba(0,0,0,0.6)',
    borderRadius:      radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical:   6,
  },
  labelText: {
    ...typography.caption,
    fontWeight: '700',
    color:      '#fff',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
  },
  playBtn: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.4)',
  },
  playIcon: {
    fontSize:   28,
    color:      '#fff',
    marginLeft: 4,
  },
  scrubber: {
    flexDirection:   'row',
    backgroundColor: colors.surface,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
  },
  scrubItem: {
    flex:           1,
    alignItems:     'center',
    paddingVertical: spacing.sm,
    gap:            2,
  },
  scrubItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  scrubLabel: {
    ...typography.caption,
    fontWeight: '600',
    color:      colors.textSecondary,
    fontSize:   10,
  },
  scrubDur: {
    ...typography.caption,
    color:    colors.textMuted,
    fontSize: 10,
  },
  actions: {
    backgroundColor: colors.surface,
    padding:         spacing.lg,
    gap:             spacing.md,
  },
  readyText: {
    ...typography.h3,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    ...typography.body,
    fontWeight: '700',
    color:      '#fff',
    fontSize:   16,
  },
  retakeBtn: {
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     colors.border,
  },
  retakeBtnText: {
    ...typography.body,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
})
