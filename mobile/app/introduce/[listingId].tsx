// mobile/app/introduce/[listingId].tsx
// Orchestrates the full phased introduction recording flow:
//   1. Pre-flight check (repeat application warning, swap context)
//   2. Phase 0: Intro recording (30s)
//   3. Phase 0: Review
//   4. Phase 1: Prompt 1 recording (30s)
//   5. Phase 1: Review
//   6. Phase 2: Prompt 2 recording (30s)
//   7. Phase 2: Review
//   8. Full review of all 3 clips in sequence
//   9. Upload to Mux + submit

import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as FileSystem from 'expo-file-system'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useRecordingStore, RecordingPhase } from '../../store/recordingStore'
import { useCircleStore } from '../../store/circleStore'
import { useSwap } from '../../hooks/useSwap'

import { PhaseRecorder } from '../../components/recording/PhaseRecorder'
import { ClipReview } from '../../components/recording/ClipReview'
import { FullReview } from '../../components/recording/FullReview'

import { colors, spacing, typography, radius } from '../../lib/theme'

const PHASE_LABELS = ['Introduction', 'Prompt 1', 'Prompt 2']

// ── Swap expiry warning modal ─────────────────
function SwapExpiryModal({
  visible,
  onExtend,
  onContinue,
}: {
  visible:    boolean
  onExtend:   () => void
  onContinue: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <Text style={modalStyles.icon}>⏱</Text>
          <Text style={modalStyles.title}>Your spot expired</Text>
          <Text style={modalStyles.body}>
            The location swap timed out while you were recording.
            You can ask for more time or continue from your real location.
          </Text>
          <TouchableOpacity style={modalStyles.primaryBtn} onPress={onExtend}>
            <Text style={modalStyles.primaryBtnText}>Ask for more time</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modalStyles.secondaryBtn} onPress={onContinue}>
            <Text style={modalStyles.secondaryBtnText}>Continue from my location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:         spacing.xl,
    gap:             spacing.md,
    alignItems:      'center',
  },
  icon:  { fontSize: 48 },
  title: { ...typography.h2, textAlign: 'center' },
  body:  { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  primaryBtn: {
    width:           '100%',
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  primaryBtnText:   { ...typography.body, fontWeight: '700', color: '#fff' },
  secondaryBtn: {
    width:           '100%',
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     colors.border,
  },
  secondaryBtnText: { ...typography.body, fontWeight: '600', color: colors.textSecondary },
})

// ── Repeat application warning ────────────────
function RepeatWarningModal({
  visible,
  onProceed,
  onCancel,
  repeatCount,
  resubmitWindowOpen,
}: {
  visible:            boolean
  onProceed:          () => void
  onCancel:           () => void
  repeatCount:        number
  resubmitWindowOpen: boolean
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <Text style={modalStyles.icon}>⚠️</Text>
          <Text style={modalStyles.title}>You've already applied</Text>
          <Text style={modalStyles.body}>
            You've sent {repeatCount} introduction{repeatCount > 1 ? 's' : ''} for this listing.
            {resubmitWindowOpen
              ? ' You can resubmit a new introduction within 48 hours.'
              : ' The resubmission window has closed.'}
          </Text>
          {resubmitWindowOpen && (
            <TouchableOpacity style={modalStyles.primaryBtn} onPress={onProceed}>
              <Text style={modalStyles.primaryBtnText}>Record a new introduction</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={modalStyles.secondaryBtn} onPress={onCancel}>
            <Text style={modalStyles.secondaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────
type ScreenMode = 'preflight' | 'recording' | 'clip-review' | 'full-review'

export default function IntroduceScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>()
  const router        = useRouter()
  const insets        = useSafeAreaInsets()

  const { hunterProfile, user } = useAuthStore()
  const { activeSwap }          = useCircleStore()
  const { requestExtension, completeSwap } = useSwap()

  const {
    clips,
    currentPhase,
    phaseState,
    prompts,
    submitting,
    submitted,
    submitError,
    initSession,
    setPrompts,
    setPhaseState,
    saveClip,
    retakePhase,
    retakeAll,
    advancePhase,
    setSubmitting,
    setSubmitted,
    setSubmitError,
    reset,
  } = useRecordingStore()

  const [mode, setMode]               = useState<ScreenMode>('preflight')
  const [listing, setListing]         = useState<any>(null)
  const [loadingPreflight, setLoading] = useState(true)
  const [showRepeat, setShowRepeat]   = useState(false)
  const [repeatCount, setRepeatCount] = useState(0)
  const [windowOpen, setWindowOpen]   = useState(false)
  const [swapExpired, setSwapExpired] = useState(false)

  // Load listing and check for existing applications
  useEffect(() => {
    if (!listingId || !hunterProfile) return
    loadPreflight()
  }, [listingId, hunterProfile?.id])

  // Monitor swap expiry during recording
  useEffect(() => {
    if (!activeSwap || mode !== 'recording') return

    const expiryMs = new Date(
      activeSwap.extended_expires_at ?? activeSwap.expires_at
    ).getTime()

    const check = setInterval(() => {
      if (Date.now() >= expiryMs) {
        setSwapExpired(true)
        clearInterval(check)
      }
    }, 5000)

    return () => clearInterval(check)
  }, [activeSwap, mode])

  async function loadPreflight() {
    setLoading(true)

    const { data: listingData } = await supabase
      .from('job_listings')
      .select(`
        id, title, resubmission_cap,
        employer_locations (
          name,
          employer_profiles ( business_name )
        )
      `)
      .eq('id', listingId)
      .single()

    setListing(listingData)

    // Load prompts
    const { data: promptData } = await supabase
      .from('video_prompts')
      .select('id, prompt_text, category')
      .eq('is_active', true)

    if (promptData) {
      // Pick one prompt per category: experience and motivation
      const experience = promptData.filter((p: any) => p.category === 'experience')
      const motivation = promptData.filter((p: any) => p.category === 'motivation')
      const selected = [
        experience[Math.floor(Math.random() * experience.length)],
        motivation[Math.floor(Math.random() * motivation.length)],
      ].filter(Boolean)

      setPrompts(selected.map((p: any) => ({
        id:       p.id,
        text:     p.prompt_text,
        category: p.category,
      })))
    }

    // Check for existing application
    if (hunterProfile) {
      const { data: existing } = await supabase
        .from('video_applications')
        .select('id, submitted_at, repeat_count')
        .eq('listing_id', listingId)
        .eq('hunter_id', hunterProfile.id)
        .is('deleted_at', null)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        const count = (existing.repeat_count ?? 0) + 1
        setRepeatCount(count)
        const windowMs = 48 * 3_600_000
        const open = Date.now() - new Date(existing.submitted_at).getTime() < windowMs
        setWindowOpen(open)
        setShowRepeat(true)
      }
    }

    // Init recording session
    const employerName = (listingData as any)?.employer_locations?.employer_profiles?.business_name ?? ''
    initSession(listingId, listingData?.title ?? '', employerName, activeSwap?.id)

    setLoading(false)
  }

  // ── Recording handlers ────────────────────────

  function handleClipReady(uri: string, durationMs: number) {
    const prompt = currentPhase > 0 ? prompts[currentPhase - 1] : null
    saveClip(currentPhase, {
      uri,
      durationMs,
      promptId:   prompt?.id ?? null,
      promptText: prompt?.text ?? null,
    })
    // phaseState → 'review' (set by saveClip)
  }

  function handleClipApproved() {
    const allFilled = clips.filter(Boolean).length
    if (currentPhase === 2 && allFilled >= 3) {
      // All phases done → full review
      setMode('full-review')
    } else {
      advancePhase()
    }
  }

  function handleRetake(phase: RecordingPhase) {
    retakePhase(phase)
  }

  // ── Submission ────────────────────────────────

  async function handleSubmit() {
    if (!hunterProfile || !listingId) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const session = await supabase.auth.getSession()
      const token   = session.data.session?.access_token

      // 1. Submit the introduction record first (creates video_media + application rows)
      const totalDuration = clips.reduce((sum, c) => sum + (c ? c.durationMs / 1000 : 0), 0)

      // Get a combined upload URL for the stitched asset placeholder
      const urlRes = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/introductions/upload-url`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      )
      const { upload_url, upload_id } = await urlRes.json()

      const submitRes = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/introductions`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            listing_id:       listingId,
            mux_upload_id:    upload_id,
            prompt_ids_used:  clips.map((c) => c?.promptId).filter(Boolean),
            swap_used_id:     activeSwap?.id ?? null,
            duration_seconds: totalDuration,
          }),
        }
      )

      if (!submitRes.ok) {
        const err = await submitRes.json()
        throw new Error(err.error ?? 'Submission failed')
      }

      const { application } = await submitRes.json()

      // 2. Upload each phase clip to Mux individually (parallel)
      await Promise.all(
        clips.map(async (clip, idx) => {
          if (!clip) return

          // Get per-phase upload URL
          const phaseUrlRes = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL}/introductions/upload-url`,
            { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
          )
          const { upload_url: phaseUploadUrl, upload_id: phaseUploadId } = await phaseUrlRes.json()

          // Upload clip to Mux
          await FileSystem.uploadAsync(phaseUploadUrl, clip.uri, {
            httpMethod: 'PUT',
            mimeType:   'video/mp4',
            headers:    { 'Content-Type': 'video/mp4' },
          })

          // Register phase with API
          await fetch(
            `${process.env.EXPO_PUBLIC_API_URL}/introductions/${application.id}/phase`,
            {
              method:  'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                phase_index:      idx,
                mux_upload_id:    phaseUploadId,
                prompt_id:        clip.promptId,
                prompt_text:      clip.promptText,
                duration_seconds: Math.round(clip.durationMs / 1000),
              }),
            }
          )
        })
      )

      setSubmitted(true)

      // 3. The stitch job is now queued server-side.
      // The cron worker will stitch the 3 clips and notify the employer.
      Alert.alert(
        'Introduction sent! 🎬',
        `Your introduction for ${listing?.title} is on its way. It'll be ready for review shortly.`,
        [{ text: 'Back to listing', onPress: () => router.back() }]
      )
    } catch (err: any) {
      setSubmitError(err.message ?? 'Upload failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Swap expiry handlers ──────────────────────

  async function handleRequestMoreTime() {
    await requestExtension()
    setSwapExpired(false)
  }

  function handleContinueFromReal() {
    if (activeSwap) completeSwap(activeSwap.id, false)
    setSwapExpired(false)
  }

  // ── Render ────────────────────────────────────

  if (loadingPreflight) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  const getPromptForPhase = (phase: RecordingPhase): string | null => {
    if (phase === 0) return null
    return prompts[phase - 1]?.text ?? null
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Close button */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + spacing.sm }]}
        onPress={() => { reset(); router.back() }}
      >
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      {/* Recording / review content */}
      {(mode === 'preflight' || mode === 'recording') && phaseState !== 'review' && (
        <PhaseRecorder
          phase={currentPhase}
          phaseLabel={PHASE_LABELS[currentPhase]}
          promptText={getPromptForPhase(currentPhase)}
          onClipReady={handleClipReady}
        />
      )}

      {phaseState === 'review' && clips[currentPhase] && mode !== 'full-review' && (
        <ClipReview
          uri={clips[currentPhase]!.uri}
          phaseLabel={PHASE_LABELS[currentPhase]}
          onApprove={handleClipApproved}
          onRetake={() => handleRetake(currentPhase)}
        />
      )}

      {mode === 'full-review' && (
        <FullReview
          clips={clips.filter(Boolean) as any}
          onSubmit={handleSubmit}
          onRetakeAll={() => { retakeAll(); setMode('recording') }}
          submitting={submitting}
        />
      )}

      {/* Swap expiry modal */}
      <SwapExpiryModal
        visible={swapExpired}
        onExtend={handleRequestMoreTime}
        onContinue={handleContinueFromReal}
      />

      {/* Repeat application modal */}
      <RepeatWarningModal
        visible={showRepeat}
        repeatCount={repeatCount}
        resubmitWindowOpen={windowOpen}
        onProceed={() => setShowRepeat(false)}
        onCancel={() => { reset(); router.back() }}
      />

      {/* Submit error */}
      {submitError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#000',
  },
  loading: {
    flex:            1,
    backgroundColor: colors.background,
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeBtn: {
    position:        'absolute',
    right:           spacing.md,
    zIndex:          100,
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeBtnText: {
    color:      '#fff',
    fontSize:   16,
    fontWeight: '700',
  },
  errorBanner: {
    position:          'absolute',
    bottom:            spacing.xl,
    left:              spacing.md,
    right:             spacing.md,
    backgroundColor:   colors.error,
    borderRadius:      radius.md,
    padding:           spacing.md,
  },
  errorText: {
    ...typography.body,
    color:      '#fff',
    fontWeight: '600',
    textAlign:  'center',
  },
})
