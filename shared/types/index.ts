// ─────────────────────────────────────────────
// shared/types/index.ts
// Single source of truth for all LocalLoop entities.
// Mirrors the Supabase schema 1:1.
// ─────────────────────────────────────────────

// ── Enums ────────────────────────────────────

export type UserRole = 'hunter' | 'employer' | 'both' | 'alpha' | 'beta' | 'admin'

export type EmployerMemberRole = 'owner' | 'hr_admin' | 'viewer'

export type ResumeSource = 'upload' | 'linkedin_import'

export type SwapStatus = 'pending' | 'active' | 'expired' | 'declined' | 'completed'

export type ListingStatus = 'draft' | 'active' | 'closed'

export type ListingType = 'standard' | 'fair_digital' | 'fair_physical'

export type IntroductionStatus = 'sent' | 'viewed' | 'shortlisted' | 'passed'

export type JobFairStatus = 'upcoming' | 'live' | 'archived'

export type JobFairTier = 'standard' | 'featured'

export type CircleMemberStatus = 'pending' | 'accepted' | 'removed'

export type CirclePointReason =
  | 'swap_completed'
  | 'introduction_submitted'
  | 'member_active'
  | 'member_verified'

export type NotificationChannel = 'push' | 'email' | 'in_app'

export type NotificationType =
  | 'swap_request'
  | 'swap_approved'
  | 'swap_declined'
  | 'swap_expiring'
  | 'swap_extension_request'
  | 'swap_available'       // locked user became available
  | 'introduction_received'
  | 'listing_posted'       // followed location posted a new listing
  | 'job_fair_announced'
  | 'job_fair_live'
  | 'circle_request'
  | 'radius_milestone'

export type ContentReportTargetType = 'listing' | 'introduction' | 'user' | 'employer'

export type SubscriptionTier = 'founding' | 'base' | 'pay_per_post' | 'free'

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled'

export type OnboardingStep =
  | 'email'
  | 'verify'
  | 'profile'
  | 'location'
  | 'radius_reveal'
  | 'resume'
  | 'circle_intro'
  | 'find_contacts'
  | 'follow_business'
  | 'complete'

export type LocationDisplayMode = 'zip_centroid' | 'offset'

export type VideoTranscodeStatus = 'pending' | 'processing' | 'ready' | 'error'

export type SwapTokenAction = 'earned' | 'spent' | 'daily_reset' | 'refunded'

// ── Core user entities ───────────────────────

export interface User {
  id: string
  email: string
  phone: string | null
  role: UserRole
  is_founder: boolean
  deleted_at: string | null
  created_at: string
  last_active_at: string
}

export interface HunterProfile {
  id: string
  user_id: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  linkedin_url: string | null
  github_url: string | null
  other_links: string[]
  current_lat: number | null
  current_lng: number | null
  radius_miles: number            // computed from circle_points + milestones
  circle_points: number
  swap_status: 'available' | 'swap_locked'
  location_updated_at: string | null
  deleted_at: string | null
  created_at: string
}

export interface Resume {
  id: string
  hunter_id: string
  source: ResumeSource
  file_url: string | null
  linkedin_raw_json: Record<string, unknown> | null
  imported_at: string
}

// ── Employer entities ────────────────────────

export interface EmployerProfile {
  id: string
  user_id: string
  business_name: string
  logo_url: string | null
  website: string | null
  description: string | null
  verified_at: string | null
  deleted_at: string | null
  created_at: string
}

export interface EmployerMember {
  id: string
  employer_id: string
  user_id: string
  role: EmployerMemberRole
  location_scope: string | null   // employer_location.id — null means all locations
  joined_at: string
}

export interface EmployerLocation {
  id: string
  employer_id: string
  name: string
  address: string
  lat: number
  lng: number
  display_lat: number             // fuzzed — sent to client
  display_lng: number             // fuzzed — sent to client
  display_mode: LocationDisplayMode
  is_active: boolean
  follower_count: number          // denormalized
  deleted_at: string | null
  created_at: string
}

export interface EmployerSubscription {
  id: string
  employer_id: string
  tier: SubscriptionTier
  status: SubscriptionStatus
  monthly_cap: number | null      // null = unlimited
  started_at: string
  expires_at: string | null
}

// ── Listings ─────────────────────────────────

export interface JobListing {
  id: string
  employer_location_id: string
  job_fair_id: string | null
  title: string
  description: string
  tags: string[]
  listing_type: ListingType
  status: ListingStatus
  application_count: number       // denormalized
  preview_approved_at: string | null
  posted_at: string | null
  closes_at: string | null
  deleted_at: string | null
}

export interface SavedListing {
  id: string
  hunter_id: string
  listing_id: string
  saved_at: string
}

// ── Skills ───────────────────────────────────

export interface SkillTag {
  id: string
  label: string
  category: string | null
  is_active: boolean
}

export interface HunterSkill {
  id: string
  hunter_id: string
  skill_tag_id: string
}

export interface ListingSkill {
  id: string
  listing_id: string
  skill_tag_id: string
  required: boolean
}

// ── Introductions (video applications) ───────

export interface VideoPrompt {
  id: string
  prompt_text: string
  category: 'intro' | 'experience' | 'motivation' | 'closing'
  is_active: boolean
}

export interface VideoMedia {
  id: string
  hunter_id: string
  raw_url: string
  playback_url: string | null
  thumbnail_url: string | null
  watermarked_url: string | null
  duration_seconds: number | null
  file_size_bytes: number | null
  transcode_status: VideoTranscodeStatus
  mux_asset_id: string | null
  mux_playback_id: string | null
  deleted_at: string | null
  created_at: string
}

export interface VideoApplication {
  id: string
  listing_id: string
  hunter_id: string
  video_media_id: string
  swap_used_id: string | null     // swap_request.id — null if applied within own radius
  prompt_ids_used: string[]
  status: IntroductionStatus
  is_repeat: boolean
  repeat_count: number
  deleted_at: string | null
  submitted_at: string
}

// ── Circle ───────────────────────────────────

export interface CircleMember {
  id: string
  requester_id: string            // hunter_profile.id
  recipient_id: string            // hunter_profile.id
  status: CircleMemberStatus
  quality_weight: number          // 0.0–1.0 computed score
  completed_swaps: number
  last_active_together: string | null
  created_at: string
}

export interface CirclePointLog {
  id: string
  hunter_id: string
  reason: CirclePointReason
  delta: number
  reference_id: string | null     // swap or introduction id
  created_at: string
}

export interface RadiusMilestone {
  id: string
  points_required: number         // Fibonacci-derived thresholds as seed data
  radius_miles: number
  label: string
}

// ── Location anchors ─────────────────────────

export interface LocationAnchor {
  id: string
  hunter_id: string
  employer_location_id: string
  via_member_id: string           // circle_member.id who works there
  anchor_strength: number         // 0.0–1.0, decays with inactivity
  extra_radius_miles: number
  last_reinforced_at: string
}

// ── Follows ──────────────────────────────────

export interface LocationFollow {
  id: string
  hunter_id: string
  employer_location_id: string
  notify_all: boolean
  notify_matched_only: boolean
  followed_at: string
}

// ── Swaps ────────────────────────────────────

export interface SwapRequest {
  id: string
  requester_id: string            // hunter_profile.id asking for swap
  granter_id: string              // hunter_profile.id sharing location
  listing_id: string
  status: SwapStatus
  granter_display_lat: number     // fuzzed before storage
  granter_display_lng: number     // fuzzed before storage
  expires_at: string
  accepted_at: string | null
  completed_at: string | null
  extension_requested_at: string | null
  extension_approved_at: string | null
  extension_declined_at: string | null
  extended_expires_at: string | null
  created_at: string
}

export interface SwapTokenLedger {
  id: string
  hunter_id: string
  balance: number
  daily_used: number
  daily_cap: number | null        // null = unlimited
  last_action: SwapTokenAction
  updated_at: string
}

export interface SwapNotifyQueue {
  id: string
  requesting_hunter_id: string    // wants to be notified
  locked_hunter_id: string        // currently swap_locked
  notified_at: string | null
  created_at: string
}

// ── Job fairs ────────────────────────────────

export interface JobFair {
  id: string
  name: string
  description: string | null
  lat: number
  lng: number
  display_lat: number
  display_lng: number
  override_radius_miles: number
  status: JobFairStatus
  starts_at: string
  ends_at: string
  hosted_by: string               // user.id — platform admin
  created_at: string
}

export interface JobFairEmployer {
  id: string
  job_fair_id: string
  employer_id: string
  tier: JobFairTier
  confirmed_at: string
}

// ── Notifications ─────────────────────────────

export interface NotificationLog {
  id: string
  recipient_user_id: string
  type: NotificationType
  channel: NotificationChannel
  reference_id: string | null     // the id of the thing being notified about
  read_at: string | null
  sent_at: string
}

export interface DeviceSession {
  id: string
  user_id: string
  push_token: string | null
  platform: 'ios' | 'android' | 'web'
  last_seen_at: string
  created_at: string
}

// ── Onboarding ───────────────────────────────

export interface OnboardingState {
  id: string
  user_id: string
  current_step: OnboardingStep
  completed_steps: OnboardingStep[]
  completed_at: string | null
  created_at: string
}

// ── Moderation ───────────────────────────────

export interface ContentReport {
  id: string
  reporter_id: string             // user.id
  target_type: ContentReportTargetType
  target_id: string
  reason: string
  resolved_at: string | null
  created_at: string
}

// ── Geo utility types (not persisted) ────────

export interface LatLng {
  lat: number
  lng: number
}

export interface RadiusQueryParams {
  center: LatLng
  radius_miles: number
}

export interface FuzzedLocation extends LatLng {
  display_lat: number
  display_lng: number
  fuzz_mode: LocationDisplayMode
}
