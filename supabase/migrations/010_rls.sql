-- ─────────────────────────────────────────────
-- 010_rls.sql
-- Row Level Security policies.
-- Every table is locked down by default.
-- Policies grant only what each role needs.
-- ─────────────────────────────────────────────

-- Enable RLS on all tables
alter table public.users                  enable row level security;
alter table public.hunter_profiles        enable row level security;
alter table public.resumes                enable row level security;
alter table public.employer_profiles      enable row level security;
alter table public.employer_members       enable row level security;
alter table public.employer_locations     enable row level security;
alter table public.employer_subscriptions enable row level security;
alter table public.onboarding_states      enable row level security;
alter table public.device_sessions        enable row level security;
alter table public.radius_milestones      enable row level security;
alter table public.circle_members         enable row level security;
alter table public.circle_point_logs      enable row level security;
alter table public.location_anchors       enable row level security;
alter table public.swap_notify_queue      enable row level security;
alter table public.skill_tags             enable row level security;
alter table public.job_fairs              enable row level security;
alter table public.job_fair_employers     enable row level security;
alter table public.job_listings           enable row level security;
alter table public.listing_skills         enable row level security;
alter table public.hunter_skills          enable row level security;
alter table public.location_follows       enable row level security;
alter table public.saved_listings         enable row level security;
alter table public.swap_requests          enable row level security;
alter table public.swap_token_ledger      enable row level security;
alter table public.video_prompts          enable row level security;
alter table public.video_media            enable row level security;
alter table public.video_applications     enable row level security;
alter table public.notification_logs      enable row level security;
alter table public.content_reports        enable row level security;

-- ── Helper: current user's id ─────────────────
-- auth.uid() is the Supabase built-in for the
-- currently authenticated user's UUID.

-- ── PUBLIC READ policies ──────────────────────
-- Things anyone authenticated can read

create policy "radius_milestones: anyone can read"
  on public.radius_milestones for select
  using (auth.role() = 'authenticated');

create policy "video_prompts: anyone can read active"
  on public.video_prompts for select
  using (auth.role() = 'authenticated' and is_active = true);

create policy "skill_tags: anyone can read active"
  on public.skill_tags for select
  using (auth.role() = 'authenticated' and is_active = true);

create policy "employer_profiles: anyone can read undeleted"
  on public.employer_profiles for select
  using (auth.role() = 'authenticated' and deleted_at is null);

create policy "employer_locations: anyone can read active"
  on public.employer_locations for select
  using (auth.role() = 'authenticated' and is_active = true and deleted_at is null);

create policy "job_listings: anyone can read active"
  on public.job_listings for select
  using (auth.role() = 'authenticated' and status = 'active' and deleted_at is null);

create policy "job_fairs: anyone can read"
  on public.job_fairs for select
  using (auth.role() = 'authenticated');

create policy "job_fair_employers: anyone can read"
  on public.job_fair_employers for select
  using (auth.role() = 'authenticated');

create policy "listing_skills: anyone can read"
  on public.listing_skills for select
  using (auth.role() = 'authenticated');

-- ── USERS ─────────────────────────────────────

create policy "users: read own row"
  on public.users for select
  using (id = auth.uid());

create policy "users: update own row"
  on public.users for update
  using (id = auth.uid());

-- ── HUNTER PROFILES ───────────────────────────

-- Hunters can read any non-deleted profile (for circle / swap discovery)
create policy "hunter_profiles: authenticated can read"
  on public.hunter_profiles for select
  using (auth.role() = 'authenticated' and deleted_at is null);

create policy "hunter_profiles: own update"
  on public.hunter_profiles for update
  using (user_id = auth.uid());

create policy "hunter_profiles: own insert"
  on public.hunter_profiles for insert
  with check (user_id = auth.uid());

-- ── RESUMES ───────────────────────────────────

create policy "resumes: read own"
  on public.resumes for select
  using (
    hunter_id in (
      select id from public.hunter_profiles where user_id = auth.uid()
    )
  );

create policy "resumes: insert own"
  on public.resumes for insert
  with check (
    hunter_id in (
      select id from public.hunter_profiles where user_id = auth.uid()
    )
  );

-- ── EMPLOYER PROFILES & MEMBERS ───────────────

create policy "employer_profiles: members can update"
  on public.employer_profiles for update
  using (
    id in (
      select employer_id from public.employer_members
      where user_id = auth.uid()
      and role in ('owner', 'hr_admin')
    )
  );

create policy "employer_members: read own employer"
  on public.employer_members for select
  using (user_id = auth.uid());

-- ── CIRCLE ────────────────────────────────────

create policy "circle_members: read own connections"
  on public.circle_members for select
  using (
    requester_id in (select id from public.hunter_profiles where user_id = auth.uid())
    or
    recipient_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "circle_members: insert own request"
  on public.circle_members for insert
  with check (
    requester_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "circle_members: update own connections"
  on public.circle_members for update
  using (
    requester_id in (select id from public.hunter_profiles where user_id = auth.uid())
    or
    recipient_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "circle_point_logs: read own"
  on public.circle_point_logs for select
  using (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "location_anchors: read own"
  on public.location_anchors for select
  using (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

-- ── SWAPS ─────────────────────────────────────

create policy "swap_requests: read own"
  on public.swap_requests for select
  using (
    requester_id in (select id from public.hunter_profiles where user_id = auth.uid())
    or
    granter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "swap_requests: insert as requester"
  on public.swap_requests for insert
  with check (
    requester_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "swap_requests: update own"
  on public.swap_requests for update
  using (
    requester_id in (select id from public.hunter_profiles where user_id = auth.uid())
    or
    granter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "swap_token_ledger: read own"
  on public.swap_token_ledger for select
  using (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "swap_notify_queue: read own"
  on public.swap_notify_queue for select
  using (
    requesting_hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
    or
    locked_hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

-- ── FOLLOWS & SAVES ───────────────────────────

create policy "location_follows: read own"
  on public.location_follows for select
  using (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "location_follows: insert own"
  on public.location_follows for insert
  with check (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "location_follows: delete own"
  on public.location_follows for delete
  using (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "saved_listings: read own"
  on public.saved_listings for select
  using (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "saved_listings: insert own"
  on public.saved_listings for insert
  with check (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "saved_listings: delete own"
  on public.saved_listings for delete
  using (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

-- ── HUNTER SKILLS ─────────────────────────────

create policy "hunter_skills: read own"
  on public.hunter_skills for select
  using (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "hunter_skills: manage own"
  on public.hunter_skills for all
  using (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

-- ── VIDEO & INTRODUCTIONS ─────────────────────

create policy "video_media: read own"
  on public.video_media for select
  using (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

create policy "video_media: insert own"
  on public.video_media for insert
  with check (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

-- Employers can read video_applications for their listings
create policy "video_applications: hunter reads own"
  on public.video_applications for select
  using (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
    and deleted_at is null
  );

create policy "video_applications: employer reads for their listings"
  on public.video_applications for select
  using (
    listing_id in (
      select jl.id
      from public.job_listings jl
      join public.employer_locations el on el.id = jl.employer_location_id
      join public.employer_members em on em.employer_id = el.employer_id
      where em.user_id = auth.uid()
    )
    and deleted_at is null
  );

create policy "video_applications: hunter inserts own"
  on public.video_applications for insert
  with check (
    hunter_id in (select id from public.hunter_profiles where user_id = auth.uid())
  );

-- ── NOTIFICATIONS ─────────────────────────────

create policy "notification_logs: read own"
  on public.notification_logs for select
  using (recipient_user_id = auth.uid());

-- ── ONBOARDING & DEVICES ──────────────────────

create policy "onboarding_states: read own"
  on public.onboarding_states for select
  using (user_id = auth.uid());

create policy "onboarding_states: upsert own"
  on public.onboarding_states for all
  using (user_id = auth.uid());

create policy "device_sessions: manage own"
  on public.device_sessions for all
  using (user_id = auth.uid());

-- ── CONTENT REPORTS ───────────────────────────

create policy "content_reports: insert own"
  on public.content_reports for insert
  with check (reporter_id = auth.uid());
