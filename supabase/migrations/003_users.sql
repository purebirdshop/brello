-- ─────────────────────────────────────────────
-- 003_users.sql
-- Core user identity and profile tables
-- ─────────────────────────────────────────────

-- ── users ────────────────────────────────────
-- Extends Supabase auth.users via foreign key.
-- One row per authenticated user.

create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null unique,
  phone           text,
  role            user_role not null default 'hunter',
  is_founder      boolean not null default false,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  last_active_at  timestamptz not null default now()
);

-- ── hunter_profiles ──────────────────────────

create table public.hunter_profiles (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references public.users(id) on delete cascade,
  display_name         text not null,
  bio                  text,
  avatar_url           text,
  linkedin_url         text,
  github_url           text,
  other_links          text[] not null default '{}',

  -- location — precise, never sent to client raw
  current_lat          double precision,
  current_lng          double precision,
  location_updated_at  timestamptz,

  -- geo column for PostGIS radius queries
  current_location     geography(Point, 4326)
    generated always as (
      case
        when current_lat is not null and current_lng is not null
        then ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326)::geography
        else null
      end
    ) stored,

  -- radius system
  radius_miles         double precision not null default 1.0,
  circle_points        integer not null default 0,
  swap_status          hunter_swap_status not null default 'available',

  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),

  unique(user_id)
);

create index idx_hunter_location on public.hunter_profiles
  using gist(current_location)
  where deleted_at is null;

-- ── resumes ──────────────────────────────────

create table public.resumes (
  id               uuid primary key default uuid_generate_v4(),
  hunter_id        uuid not null references public.hunter_profiles(id) on delete cascade,
  source           resume_source not null,
  file_url         text,
  linkedin_raw_json jsonb,
  imported_at      timestamptz not null default now()
);

-- ── employer_profiles ────────────────────────

create table public.employer_profiles (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.users(id) on delete cascade,
  business_name  text not null,
  logo_url       text,
  website        text,
  description    text,
  verified_at    timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),

  unique(user_id)
);

-- ── employer_members ─────────────────────────
-- Users who belong to an employer account with a specific role.

create table public.employer_members (
  id             uuid primary key default uuid_generate_v4(),
  employer_id    uuid not null references public.employer_profiles(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  role           employer_member_role not null default 'viewer',
  location_scope uuid,              -- fk to employer_locations added in 004
  joined_at      timestamptz not null default now(),

  unique(employer_id, user_id)
);

-- ── onboarding_states ────────────────────────

create table public.onboarding_states (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references public.users(id) on delete cascade,
  current_step     onboarding_step not null default 'email',
  completed_steps  onboarding_step[] not null default '{}',
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),

  unique(user_id)
);

-- ── device_sessions ──────────────────────────

create table public.device_sessions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,
  push_token    text,
  platform      device_platform not null,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index idx_device_sessions_user on public.device_sessions(user_id);
