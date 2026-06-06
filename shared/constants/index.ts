// ─────────────────────────────────────────────
// shared/constants/index.ts
// ─────────────────────────────────────────────

export const RADIUS = {
  BASE_MILES: 1.0,
  MAX_MILES: 5.0,
  STEP_MILES: 0.25,
  ALPHA_BETA_MILES: 5.0,   // instant max for testers
} as const

export const CIRCLE = {
  SOFT_MAX: 5000,
  QUALITY_DECAY_DAYS: 60,  // member goes dormant after this many inactive days
  ANCHOR_DECAY_DAYS: 30,   // location anchor strength decays after this
} as const

export const SWAP = {
  DURATION_MINUTES: 15,
  EXTENSION_MINUTES: 10,
  EXTENSION_APPROVAL_TIMEOUT_MINUTES: 2,
  WARNING_BEFORE_EXPIRY_MINUTES: 2,
  DAILY_CAP: null,          // null = unlimited at launch
} as const

export const INTRODUCTION = {
  MIN_DURATION_SECONDS: 30,
  MAX_DURATION_SECONDS: 90,
} as const

export const LOCATION = {
  FUZZ_OFFSET_MILES: 0.35,  // randomized offset applied to swap/hunter display coords
} as const

export const JOB_FAIR = {
  DEFAULT_OVERRIDE_RADIUS_MILES: 0.5,
} as const

export const ONBOARDING_STEPS = [
  'email',
  'verify',
  'profile',
  'location',
  'radius_reveal',
  'resume',
  'circle_intro',
  'find_contacts',
  'follow_business',
  'complete',
] as const
