-- ─────────────────────────────────────────────
-- 005_circle.sql
-- Circle social graph, radius milestones,
-- location anchors, and swap notify queue
-- ─────────────────────────────────────────────

-- ── radius_milestones ────────────────────────
-- Seed data inserted in 009_seed.sql.
-- Fibonacci-derived point thresholds that unlock
-- radius expansions.

create table public.radius_milestones (
  id              uuid primary key default uuid_generate_v4(),
  points_required integer not null unique,
  radius_miles    double precision not null,
  label           text not null
);

-- ── circle_members ───────────────────────────
-- Self-referential join on hunter_profiles.
-- Both directions must be accepted (mutual).

create table public.circle_members (
  id                    uuid primary key default uuid_generate_v4(),
  requester_id          uuid not null references public.hunter_profiles(id) on delete cascade,
  recipient_id          uuid not null references public.hunter_profiles(id) on delete cascade,
  status                circle_member_status not null default 'pending',

  -- Quality weight: computed by the radius engine service.
  -- 0.0 = dormant stranger, 1.0 = highly active swap partner.
  quality_weight        double precision not null default 0.0,
  completed_swaps       integer not null default 0,
  last_active_together  timestamptz,
  created_at            timestamptz not null default now(),

  -- Prevent duplicate pairs in either direction
  unique(requester_id, recipient_id),
  check(requester_id <> recipient_id)
);

create index idx_circle_requester on public.circle_members(requester_id)
  where status = 'accepted';
create index idx_circle_recipient on public.circle_members(recipient_id)
  where status = 'accepted';

-- ── circle_point_logs ────────────────────────

create table public.circle_point_logs (
  id           uuid primary key default uuid_generate_v4(),
  hunter_id    uuid not null references public.hunter_profiles(id) on delete cascade,
  reason       circle_point_reason not null,
  delta        integer not null,
  reference_id uuid,               -- swap_request.id or video_application.id
  created_at   timestamptz not null default now()
);

create index idx_circle_points_hunter on public.circle_point_logs(hunter_id);

-- ── location_anchors ─────────────────────────
-- Created when a circle member is a verified employee
-- at an employer location. Gives the watching hunter
-- a hyper-local radius bonus toward that location only.

create table public.location_anchors (
  id                   uuid primary key default uuid_generate_v4(),
  hunter_id            uuid not null references public.hunter_profiles(id) on delete cascade,
  employer_location_id uuid not null references public.employer_locations(id) on delete cascade,
  via_member_id        uuid not null references public.circle_members(id) on delete cascade,
  anchor_strength      double precision not null default 1.0,  -- decays with inactivity
  extra_radius_miles   double precision not null default 1.0,
  last_reinforced_at   timestamptz not null default now(),

  unique(hunter_id, employer_location_id, via_member_id)
);

-- ── swap_notify_queue ────────────────────────
-- When a hunter taps a swap_locked circle member
-- and opts in to "notify me when available".

create table public.swap_notify_queue (
  id                   uuid primary key default uuid_generate_v4(),
  requesting_hunter_id uuid not null references public.hunter_profiles(id) on delete cascade,
  locked_hunter_id     uuid not null references public.hunter_profiles(id) on delete cascade,
  notified_at          timestamptz,
  created_at           timestamptz not null default now(),

  unique(requesting_hunter_id, locked_hunter_id),
  check(requesting_hunter_id <> locked_hunter_id)
);
