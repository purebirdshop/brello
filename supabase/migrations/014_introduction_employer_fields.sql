-- ─────────────────────────────────────────────
-- 014_introduction_employer_fields.sql
-- Adds employer-side fields to video_applications
-- and resubmission control to job_listings.
-- ─────────────────────────────────────────────

-- Employer status enum
create type employer_intro_status as enum (
  'new',
  'viewed',
  'follow_up',
  'move_forward',
  'modest_match',
  'passed'
);

-- Add employer fields to video_applications
alter table public.video_applications
  add column if not exists employer_status employer_intro_status not null default 'new',
  add column if not exists employer_notes  jsonb not null default '[]'::jsonb;

-- Add resubmission cap to job_listings
-- null = unlimited resubmissions allowed
alter table public.job_listings
  add column if not exists resubmission_cap integer;

-- Index for fast employer dashboard queries
create index if not exists idx_applications_employer_status
  on public.video_applications(employer_status)
  where deleted_at is null;

-- Update RLS: employers can update employer_status and employer_notes
create policy "video_applications: employer can update status and notes"
  on public.video_applications for update
  using (
    listing_id in (
      select jl.id
      from public.job_listings jl
      join public.employer_locations el on el.id = jl.employer_location_id
      join public.employer_members   em on em.employer_id = el.employer_id
      where em.user_id = auth.uid()
    )
  );
