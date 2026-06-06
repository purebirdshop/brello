-- ─────────────────────────────────────────────
-- 007_swaps_introductions.sql
-- Swap requests, token ledger, video media,
-- video prompts, and video applications (introductions)
-- ─────────────────────────────────────────────

-- ── swap_requests ────────────────────────────

create table public.swap_requests (
  id                      uuid primary key default uuid_generate_v4(),
  requester_id            uuid not null references public.hunter_profiles(id) on delete cascade,
  granter_id              uuid not null references public.hunter_profiles(id) on delete cascade,
  listing_id              uuid not null references public.job_listings(id) on delete cascade,
  status                  swap_status not null default 'pending',

  -- Fuzzed granter location — precise coords never stored here
  granter_display_lat     double precision not null,
  granter_display_lng     double precision not null,

  expires_at              timestamptz not null,
  accepted_at             timestamptz,
  completed_at            timestamptz,

  -- Extension flow
  extension_requested_at  timestamptz,
  extension_approved_at   timestamptz,
  extension_declined_at   timestamptz,
  extended_expires_at     timestamptz,

  created_at              timestamptz not null default now(),

  check(requester_id <> granter_id)
);

create index idx_swap_requester on public.swap_requests(requester_id);
create index idx_swap_granter on public.swap_requests(granter_id);
create index idx_swap_status on public.swap_requests(status) where status = 'active';

-- ── swap_token_ledger ────────────────────────

create table public.swap_token_ledger (
  id           uuid primary key default uuid_generate_v4(),
  hunter_id    uuid not null references public.hunter_profiles(id) on delete cascade,
  balance      integer not null default 0,
  daily_used   integer not null default 0,
  daily_cap    integer,                      -- null = unlimited (launch default)
  last_action  swap_token_action not null default 'earned',
  updated_at   timestamptz not null default now(),

  unique(hunter_id)
);

-- ── video_prompts ────────────────────────────

create table public.video_prompts (
  id           uuid primary key default uuid_generate_v4(),
  prompt_text  text not null,
  category     prompt_category not null,
  is_active    boolean not null default true
);

-- ── video_media ──────────────────────────────
-- Separate from the application record so media can be
-- managed, transcoded, and deleted independently.

create table public.video_media (
  id                uuid primary key default uuid_generate_v4(),
  hunter_id         uuid not null references public.hunter_profiles(id) on delete cascade,
  raw_url           text not null,
  playback_url      text,
  thumbnail_url     text,
  watermarked_url   text,
  duration_seconds  integer,
  file_size_bytes   bigint,
  transcode_status  video_transcode_status not null default 'pending',
  mux_asset_id      text,
  mux_playback_id   text,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now()
);

-- ── video_applications (introductions) ───────

create table public.video_applications (
  id              uuid primary key default uuid_generate_v4(),
  listing_id      uuid not null references public.job_listings(id) on delete cascade,
  hunter_id       uuid not null references public.hunter_profiles(id) on delete cascade,
  video_media_id  uuid not null references public.video_media(id),
  swap_used_id    uuid references public.swap_requests(id) on delete set null,
  prompt_ids_used uuid[] not null default '{}',
  status          introduction_status not null default 'sent',
  is_repeat       boolean not null default false,
  repeat_count    integer not null default 0,
  deleted_at      timestamptz,
  submitted_at    timestamptz not null default now()
);

create index idx_applications_listing on public.video_applications(listing_id)
  where deleted_at is null;
create index idx_applications_hunter on public.video_applications(hunter_id)
  where deleted_at is null;

-- Increment listing application_count on new introduction
create or replace function increment_application_count()
returns trigger language plpgsql as $$
begin
  update public.job_listings
  set application_count = application_count + 1
  where id = NEW.listing_id;
  return null;
end;
$$;

create trigger trg_application_count
  after insert on public.video_applications
  for each row execute function increment_application_count();

-- Detect repeat applications and set is_repeat / repeat_count
create or replace function mark_repeat_application()
returns trigger language plpgsql as $$
declare
  prior_count integer;
begin
  select count(*) into prior_count
  from public.video_applications
  where listing_id  = NEW.listing_id
    and hunter_id   = NEW.hunter_id
    and id         <> NEW.id
    and deleted_at is null;

  if prior_count > 0 then
    NEW.is_repeat    := true;
    NEW.repeat_count := prior_count;
  end if;

  return NEW;
end;
$$;

create trigger trg_mark_repeat
  before insert on public.video_applications
  for each row execute function mark_repeat_application();
