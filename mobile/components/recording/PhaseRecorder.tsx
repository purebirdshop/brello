// mobile/components/recording/PhaseRecorder.tsx
// Single-phase camera recording view.
// Shows a countdown timer, the phase prompt overlay,
// and a record/stop button. Returns the recorded clip URI.

import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native'
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'
import { colors, spacing, radius, typography } from '../../lib/theme'

const PHASE_DURATION_MS = 30_000   // 30 seconds per phase

interface PhaseRecorderProps {
  phase:       0 | 1 | 2
  promptText:  string | null
  phaseLabel:  string
  onClipReady: (uri: string, durationMs: number) => void
}

export function PhaseRecorder({
  phase,
  promptText,
  phaseLabel,
  onClipReady,
}: PhaseRecorderProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef      = useRef<CameraView>(null)
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)

  const [facing, setFacing]         = useState<CameraType>('front')
  const [isRecording, setRecording] = useState(false)
  const [msLeft, setMsLeft]         = useState(PHASE_DURATION_MS)
  const [started, setStarted]       = useState(false)

  // Pulse animation for the record button
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
        ])
      )
      loop.start()
      return () => loop.stop()
    } else {
      pulseAnim.setValue(1)
    }
  }, [isRecording])

  // Auto-stop at 30 seconds
  useEffect(() => {
    if (isRecording) {
      const start = Date.now()
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - start
        const left    = Math.max(0, PHASE_DURATION_MS - elapsed)
        setMsLeft(left)
        if (left <= 0) stopRecording()
      }, 100)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRecording])

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording) return
    setStarted(true)
    setRecording(true)
    setMsLeft(PHASE_DURATION_MS)

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: 30,
      })
      if (video?.uri) {
        const durationMs = PHASE_DURATION_MS - msLeft
        onClipReady(video.uri, durationMs)
      }
    } catch (err) {
      console.error('[PhaseRecorder] recordAsync error:', err)
    } finally {
      setRecording(false)
    }
  }, [isRecording, msLeft])

  const stopRecording = useCallback(() => {
    if (!cameraRef.current || !isRecording) return
    cameraRef.current.stopRecording()
    if (timerRef.current) clearInterval(timerRef.current)
  }, [isRecording])

  const toggleFacing = () => {
    setFacing((f) => f === 'front' ? 'back' : 'front')
  }

  if (!permission) return <View style={styles.root} />

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={styles.permissionText}>
          Camera access is needed to record your introduction.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Allow camera access</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const totalSec  = Math.ceil(msLeft / 1000)
  const isWarning = msLeft < 10_000
  const pct       = msLeft / PHASE_DURATION_MS

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
      />

      {/* Gradient overlay at top and bottom */}
      <View style={styles.topOverlay} pointerEvents="none" />
      <View style={styles.bottomOverlay} pointerEvents="none" />

      {/* Phase label + timer */}
      <View style={styles.topBar}>
        <View style={styles.phasePill}>
          <Text style={styles.phaseLabel}>{phaseLabel}</Text>
        </View>

        {isRecording && (
          <View style={[styles.timerPill, isWarning && styles.timerPillWarning]}>
            <View style={[styles.recDot, isWarning && styles.recDotWarning]} />
            <Text style={[styles.timerText, isWarning && styles.timerTextWarning]}>
              {totalSec}s
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.flipBtn} onPress={toggleFacing}>
          <Text style={styles.flipIcon}>⇄</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      {isRecording && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
        </View>
      )}

      {/* Prompt overlay */}
      {promptText && (
        <View style={styles.promptBox} pointerEvents="none">
          <Text style={styles.promptText}>{promptText}</Text>
        </View>
      )}

      {/* Record / stop button */}
      <View style={styles.controlRow}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
            onPress={isRecording ? stopRecording : startRecording}
            activeOpacity={0.85}
          >
            <View style={[styles.recordInner, isRecording && styles.recordInnerStop]} />
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.recordHint}>
          {isRecording ? 'Tap to stop' : started ? 'Tap to record again' : 'Tap to start'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#000',
  },
  topOverlay: {
    position:   'absolute',
    top:        0,
    left:       0,
    right:      0,
    height:     140,
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomOverlay: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    height:          180,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topBar: {
    position:          'absolute',
    top:               spacing.xl,
    left:              spacing.md,
    right:             spacing.md,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               spacing.sm,
  },
  phasePill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius:    radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical:   6,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.2)',
  },
  phaseLabel: {
    ...typography.caption,
    fontWeight: '700',
    color:      '#fff',
  },
  timerPill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius:    radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical:   6,
    borderWidth:     1,
    borderColor:     colors.error + '60',
  },
  timerPillWarning: {
    borderColor:     colors.error,
    backgroundColor: colors.error + '30',
  },
  recDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: colors.error,
  },
  recDotWarning: {
    backgroundColor: '#fff',
  },
  timerText: {
    ...typography.body,
    fontWeight: '700',
    color:      '#fff',
    fontSize:   16,
  },
  timerTextWarning: {
    color: '#fff',
  },
  flipBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  flipIcon: {
    fontSize: 20,
    color:    '#fff',
  },
  progressTrack: {
    position:        'absolute',
    top:             spacing.xl + 48,
    left:            spacing.md,
    right:           spacing.md,
    height:          3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius:    radius.full,
    overflow:        'hidden',
  },
  progressFill: {
    height:          3,
    backgroundColor: colors.error,
    borderRadius:    radius.full,
  },
  promptBox: {
    position:          'absolute',
    bottom:            160,
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
  controlRow: {
    position:       'absolute',
    bottom:         spacing.xl + 24,
    left:           0,
    right:          0,
    alignItems:     'center',
    gap:            spacing.sm,
  },
  recordBtn: {
    width:           80,
    height:          80,
    borderRadius:    40,
    borderWidth:     4,
    borderColor:     '#fff',
    alignItems:      'center',
    justifyContent:  'center',
  },
  recordBtnActive: {
    borderColor: colors.error,
  },
  recordInner: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: '#fff',
  },
  recordInnerStop: {
    borderRadius:    8,
    width:           28,
    height:          28,
    backgroundColor: colors.error,
  },
  recordHint: {
    ...typography.caption,
    color:      'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  permissionScreen: {
    flex:            1,
    backgroundColor: colors.background,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.md,
    padding:         spacing.xl,
  },
  permissionText: {
    ...typography.body,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 24,
  },
  permissionBtn: {
    backgroundColor:   colors.primary,
    borderRadius:      radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xl,
  },
  permissionBtnText: {
    ...typography.body,
    fontWeight: '600',
    color:      '#fff',
  },
})
