// mobile/components/recording/ClipReview.tsx
// Shows the recorded clip for a single phase.
// Hunter can play back, approve ("Looks good"), or retake.

import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { colors, spacing, radius, typography } from '../../lib/theme'

interface ClipReviewProps {
  uri:        string
  phaseLabel: string
  onApprove:  () => void
  onRetake:   () => void
}

export function ClipReview({
  uri,
  phaseLabel,
  onApprove,
  onRetake,
}: ClipReviewProps) {
  const videoRef  = useRef<Video>(null)
  const [playing, setPlaying] = useState(false)

  async function togglePlay() {
    if (!videoRef.current) return
    if (playing) {
      await videoRef.current.pauseAsync()
    } else {
      await videoRef.current.replayAsync()
    }
    setPlaying((p) => !p)
  }

  return (
    <View style={styles.root}>
      {/* Video preview */}
      <View style={styles.videoWrap}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isLooping={false}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded) {
              setPlaying(status.isPlaying)
            }
          }}
        />

        {/* Play/pause overlay */}
        <TouchableOpacity
          style={styles.playOverlay}
          onPress={togglePlay}
          activeOpacity={0.85}
        >
          {!playing && (
            <View style={styles.playBtn}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Phase label */}
        <View style={styles.labelBadge}>
          <Text style={styles.labelText}>{phaseLabel}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Text style={styles.prompt}>How does it look?</Text>

        <TouchableOpacity style={styles.approveBtn} onPress={onApprove}>
          <Text style={styles.approveBtnText}>✓  Looks good</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.retakeBtn} onPress={onRetake}>
          <Text style={styles.retakeBtnText}>↺  Retake this part</Text>
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
    flex:            1,
    backgroundColor: '#000',
    position:        'relative',
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
    fontSize: 28,
    color:    '#fff',
    marginLeft: 4,
  },
  labelBadge: {
    position:          'absolute',
    top:               spacing.lg,
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
  actions: {
    backgroundColor: colors.surface,
    padding:         spacing.lg,
    gap:             spacing.md,
  },
  prompt: {
    ...typography.h3,
    textAlign: 'center',
  },
  approveBtn: {
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  approveBtnText: {
    ...typography.body,
    fontWeight: '700',
    color:      '#fff',
    fontSize:   16,
  },
  retakeBtn: {
    backgroundColor:   colors.surfaceLight,
    borderRadius:      radius.md,
    paddingVertical:   spacing.md,
    alignItems:        'center',
    borderWidth:       1,
    borderColor:       colors.border,
  },
  retakeBtnText: {
    ...typography.body,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
})
