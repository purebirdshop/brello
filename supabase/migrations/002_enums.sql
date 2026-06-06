-- ─────────────────────────────────────────────
-- 002_enums.sql
-- All application enums — defined once, referenced everywhere
-- ─────────────────────────────────────────────

create type user_role as enum (
  'hunter', 'employer', 'both', 'alpha', 'beta', 'admin'
);

create type employer_member_role as enum (
  'owner', 'hr_admin', 'viewer'
);

create type resume_source as enum (
  'upload', 'linkedin_import'
);

create type swap_status as enum (
  'pending', 'active', 'expired', 'declined', 'completed'
);

create type hunter_swap_status as enum (
  'available', 'swap_locked'
);

create type listing_status as enum (
  'draft', 'active', 'closed'
);

create type listing_type as enum (
  'standard', 'fair_digital', 'fair_physical'
);

create type introduction_status as enum (
  'sent', 'viewed', 'shortlisted', 'passed'
);

create type job_fair_status as enum (
  'upcoming', 'live', 'archived'
);

create type job_fair_tier as enum (
  'standard', 'featured'
);

create type circle_member_status as enum (
  'pending', 'accepted', 'removed'
);

create type circle_point_reason as enum (
  'swap_completed',
  'introduction_submitted',
  'member_active',
  'member_verified'
);

create type notification_channel as enum (
  'push', 'email', 'in_app'
);

create type notification_type as enum (
  'swap_request',
  'swap_approved',
  'swap_declined',
  'swap_expiring',
  'swap_extension_request',
  'swap_available',
  'introduction_received',
  'listing_posted',
  'job_fair_announced',
  'job_fair_live',
  'circle_request',
  'radius_milestone'
);

create type content_report_target as enum (
  'listing', 'introduction', 'user', 'employer'
);

create type subscription_tier as enum (
  'founding', 'base', 'pay_per_post', 'free'
);

create type subscription_status as enum (
  'active', 'expired', 'cancelled'
);

create type onboarding_step as enum (
  'email',
  'verify',
  'profile',
  'location',
  'radius_reveal',
  'resume',
  'circle_intro',
  'find_contacts',
  'follow_business',
  'complete'
);

create type location_display_mode as enum (
  'zip_centroid', 'offset'
);

create type video_transcode_status as enum (
  'pending', 'processing', 'ready', 'error'
);

create type swap_token_action as enum (
  'earned', 'spent', 'daily_reset', 'refunded'
);

create type prompt_category as enum (
  'intro', 'experience', 'motivation', 'closing'
);

create type device_platform as enum (
  'ios', 'android', 'web'
);
