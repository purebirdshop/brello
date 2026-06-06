-- ─────────────────────────────────────────────
-- 016_phase8.sql
-- Storage policies, employer analytics snapshots,
-- LinkedIn import tracking, and subscription plan details.
-- ─────────────────────────────────────────────

-- ── Supabase Storage buckets ──────────────────
-- Created via SQL so migrations are self-contained.
-- avatars: hunter profile photos (public read)
-- resumes:  hunter resume PDFs (private, owner only)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true,  2097152,  array['image/jpeg','image/png','image/webp']),
  ('resumes', 'resumes', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Storage RLS: anyone can read avatars
create policy "avatars: public read"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Storage RLS: owner can upload/delete their own avatar
create policy "avatars: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: only owner can read/write their resume
create policy "resumes: owner read"
  on storage.objects for select
  using (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "resumes: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Employer analytics snapshots ─────────────
-- Nightly snapshot of per-location metrics.
-- Drives the employer analytics dashboard.

create table public.location_analytics_snapshots (
  id                   uuid primary key default uuid_generate_v4(),
  employer_location_id uuid not null references public.employer_locations(id) on delete cascade,
  snapshot_date        date not null,
  follower_count       integer not null default 0,
  active_listing_count integer not null default 0,
  new_intro_count      integer not null default 0,   -- intros received that day
  total_intro_count    integer not null default 0,
  created_at           timestamptz not null default now(),

  unique(employer_location_id, snapshot_date)
);

create index idx_analytics_location_date
  on public.location_analytics_snapshots(employer_location_id, snapshot_date desc);

alter table public.location_analytics_snapshots enable row level security;

create policy "analytics: employer members can read"
  on public.location_analytics_snapshots for select
  using (
    employer_location_id in (
      select el.id
      from public.employer_locations el
      join public.employer_members em on em.employer_id = el.employer_id
      where em.user_id = auth.uid()
    )
  );

-- ── LinkedIn import tracking ──────────────────
-- Tracks import sessions so we can surface
-- last-imported date and import status to the user.

create type linkedin_import_status as enum (
  'pending', 'processing', 'done', 'failed'
);

create table public.linkedin_imports (
  id          uuid primary key default uuid_generate_v4(),
  hunter_id   uuid not null references public.hunter_profiles(id) on delete cascade,
  status      linkedin_import_status not null default 'pending',
  raw_payload jsonb,
  error       text,
  imported_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.linkedin_imports enable row level security;

create policy "linkedin_imports: own read"
  on public.linkedin_imports for select
  using (
    hunter_id in (
      select id from public.hunter_profiles where user_id = auth.uid()
    )
  );

-- ── Subscription plan details ─────────────────
-- Lookup table for subscription plan features.
-- Values are read by the mobile app to gate features.

create table public.subscription_plans (
  tier              subscription_tier primary key,
  display_name      text not null,
  monthly_price_usd numeric(8,2),
  listing_cap       integer,          -- null = unlimited
  featured_fairs    boolean not null default false,
  analytics_access  boolean not null default false,
  stripe_price_id   text               -- set after Stripe products created
);

insert into public.subscription_plans
  (tier, display_name, monthly_price_usd, listing_cap, featured_fairs, analytics_access)
values
  ('free',         'Free',              0,     3,    false, false),
  ('founding',     'Founding Member',   0,     null, true,  true),
  ('pay_per_post', 'Pay Per Post',      9.99,  1,    false, false),
  ('base',         'Base',              49.00, null, false, true);

alter table public.subscription_plans enable row level security;

create policy "subscription_plans: anyone can read"
  on public.subscription_plans for select
  using (auth.role() = 'authenticated');

-- ── Analytics snapshot function ───────────────
-- Called nightly by the cron worker to record
-- per-location metrics into the snapshots table.

create or replace function snapshot_location_analytics()
returns void
language plpgsql
as $$
declare
  today date := current_date;
begin
  insert into public.location_analytics_snapshots (
    employer_location_id,
    snapshot_date,
    follower_count,
    active_listing_count,
    new_intro_count,
    total_intro_count
  )
  select
    el.id,
    today,
    el.follower_count,
    (
      select count(*) from public.job_listings jl
      where jl.employer_location_id = el.id
        and jl.status = 'active'
        and jl.deleted_at is null
    ),
    (
      select count(*) from public.video_applications va
      join public.job_listings jl on jl.id = va.listing_id
      where jl.employer_location_id = el.id
        and va.submitted_at::date = today
        and va.deleted_at is null
    ),
    (
      select count(*) from public.video_applications va
      join public.job_listings jl on jl.id = va.listing_id
      where jl.employer_location_id = el.id
        and va.deleted_at is null
    )
  from public.employer_locations el
  where el.is_active = true
    and el.deleted_at is null
  on conflict (employer_location_id, snapshot_date)
  do update set
    follower_count       = excluded.follower_count,
    active_listing_count = excluded.active_listing_count,
    new_intro_count      = excluded.new_intro_count,
    total_intro_count    = excluded.total_intro_count;
end;
$$;
