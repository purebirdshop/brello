-- ─────────────────────────────────────────────
-- 004_employer_locations.sql
-- Employer locations, subscriptions, and the
-- location_scope FK back-reference on employer_members
-- ─────────────────────────────────────────────

-- ── employer_locations ───────────────────────

create table public.employer_locations (
  id              uuid primary key default uuid_generate_v4(),
  employer_id     uuid not null references public.employer_profiles(id) on delete cascade,
  name            text not null,
  address         text not null,

  -- precise — used for server-side radius queries only
  lat             double precision not null,
  lng             double precision not null,

  -- fuzzed — safe to send to clients
  display_lat     double precision not null,
  display_lng     double precision not null,
  display_mode    location_display_mode not null default 'zip_centroid',

  -- PostGIS geography column for spatial indexing
  location        geography(Point, 4326)
    generated always as (
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) stored,

  is_active       boolean not null default true,
  follower_count  integer not null default 0,    -- denormalized, updated via trigger
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_employer_location_geo on public.employer_locations
  using gist(location)
  where deleted_at is null and is_active = true;

create index idx_employer_location_employer on public.employer_locations(employer_id)
  where deleted_at is null;

-- Now that employer_locations exists, add the FK to employer_members
alter table public.employer_members
  add constraint fk_employer_members_location_scope
  foreign key (location_scope)
  references public.employer_locations(id)
  on delete set null;

-- ── employer_subscriptions ───────────────────

create table public.employer_subscriptions (
  id           uuid primary key default uuid_generate_v4(),
  employer_id  uuid not null references public.employer_profiles(id) on delete cascade,
  tier         subscription_tier not null default 'free',
  status       subscription_status not null default 'active',
  monthly_cap  integer,                          -- null = unlimited
  started_at   timestamptz not null default now(),
  expires_at   timestamptz,

  unique(employer_id)
);
