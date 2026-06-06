// mobile/store/recordingStore.ts
// State machine for the 3-phase phased recording flow.
// Phase 0: Intro (30s)
// Phase 1: Prompt 1 (30s)
// Phase 2: Prompt 2 (30s)
// Each phase has its own recorded clip URI.
// Clips are stitched client-side into a sequential review.

import { create } from 'zustand'

export type RecordingPhase = 0 | 1 | 2
export type PhaseState = 'idle' | 'recording' | 'review' | 'accepted'

export interface PhaseClip {
  uri:           string
  durationMs:    number
  promptId:      string | null
  promptText:    string | null
}

interface RecordingState {
  // Which listing this introduction is for
  listingId:         string | null
  listingTitle:      string | null
  employerName:      string | null
  swapId:            string | null    // if applying via swap

  // 3-phase clips
  clips:             (PhaseClip | null)[]   // index = phase
  currentPhase:      RecordingPhase
  phaseState:        PhaseState

  // Selected prompts (one per recording phase 1 and 2)
  prompts:           { id: string; text: string; category: string }[]

  // Submission state
  submitting:        boolean
  submitted:         boolean
  submitError:       string | null

  // Actions
  initSession:       (listingId: string, listingTitle: string, employerName: string, swapId?: string) => void
  setPrompts:        (prompts: { id: string; text: string; category: string }[]) => void
  setPhaseState:     (state: PhaseState) => void
  saveClip:          (phase: RecordingPhase, clip: PhaseClip) => void
  retakePhase:       (phase: RecordingPhase) => void
  retakeAll:         () => void
  advancePhase:      () => void
  setSubmitting:     (v: boolean) => void
  setSubmitted:      (v: boolean) => void
  setSubmitError:    (e: string | null) => void
  reset:             () => void
}

const INITIAL: Omit<RecordingState,
  'initSession' | 'setPrompts' | 'setPhaseState' | 'saveClip' |
  'retakePhase' | 'retakeAll' | 'advancePhase' | 'setSubmitting' |
  'setSubmitted' | 'setSubmitError' | 'reset'
> = {
  listingId:    null,
  listingTitle: null,
  employerName: null,
  swapId:       null,
  clips:        [null, null, null],
  currentPhase: 0,
  phaseState:   'idle',
  prompts:      [],
  submitting:   false,
  submitted:    false,
  submitError:  null,
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  ...INITIAL,

  initSession: (listingId, listingTitle, employerName, swapId) =>
    set({ ...INITIAL, listingId, listingTitle, employerName, swapId: swapId ?? null }),

  setPrompts:    (prompts)      => set({ prompts }),
  setPhaseState: (phaseState)   => set({ phaseState }),

  saveClip: (phase, clip) =>
    set((s) => {
      const clips = [...s.clips]
      clips[phase] = clip
      return { clips, phaseState: 'review' }
    }),

  retakePhase: (phase) =>
    set((s) => {
      const clips = [...s.clips]
      clips[phase] = null
      return { clips, currentPhase: phase, phaseState: 'idle' }
    }),

  retakeAll: () =>
    set({ clips: [null, null, null], currentPhase: 0, phaseState: 'idle' }),

  advancePhase: () =>
    set((s) => {
      const next = (s.currentPhase + 1) as RecordingPhase
      if (next > 2) return { phaseState: 'accepted' }   // all done
      return { currentPhase: next, phaseState: 'idle' }
    }),

  setSubmitting:  (submitting)  => set({ submitting }),
  setSubmitted:   (submitted)   => set({ submitted }),
  setSubmitError: (submitError) => set({ submitError }),
  reset:          ()            => set(INITIAL),
}))
