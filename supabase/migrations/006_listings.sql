-- ─────────────────────────────────────────────
-- 006_listings.sql
-- Job listings, location follows, skill tags,
-- saved listings, and job fairs
-- ─────────────────────────────────────────────

-- ── skill_tags ───────────────────────────────

create table public.skill_tags (
  id        uuid primary key default uuid_generate_v4(),
  label     text not null unique,
  category  text,
  is_active boolean not null default true
);

create index idx_skill_tags_label_trgm on public.skill_tags
  using gin(label gin_trgm_ops);

-- ── job_fairs ────────────────────────────────

create table public.job_fairs (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  description           text,

  lat                   double precision not null,
  lng                   double precision not null,
  display_lat           double precision not null,
  display_lng           double precision not null,

  location              geography(Point, 4326)
    generated always as (
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) stored,

  -- Overrides all hunter personal radii while fair is live.
  -- Any hunter within this distance of the fair pin sees it.
  override_radius_miles double precision not null default 0.5,

  status                job_fair_status not null default 'upcoming',
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  hosted_by             uuid not null references public.users(id),
  created_at            timestamptz not null default now()
);

create index idx_job_fairs_geo on public.job_fairs
  using gist(location)
  where status in ('upcoming', 'live');

-- ── job_fair_employers ───────────────────────

create table public.job_fair_employers (
  id           uuid primary key default uuid_generate_v4(),
  job_fair_id  uuid not null references public.job_fairs(id) on delete cascade,
  employer_id  uuid not null references public.employer_profiles(id) on delete cascade,
  tier         job_fair_tier not null default 'standard',
  confirmed_at timestamptz not null default now(),

  unique(job_fair_id, employer_id)
);

-- ── job_listings ─────────────────────────────

create table public.job_listings (
  id                   uuid primary key default uuid_generate_v4(),
  employer_location_id uuid not null references public.employer_locations(id) on delete cascade,
  job_fair_id          uuid references public.job_fairs(id) on delete set null,
  title                text not null,
  description          text not null,
  tags                 text[] not null default '{}',
  listing_type         listing_type not null default 'standard',
  status               listing_status not null default 'draft',
  application_count    integer not null default 0,   -- denormalized
  preview_approved_at  timestamptz,
  posted_at            timestamptz,
  closes_at            timestamptz,
  deleted_at           timestamptz
);

create index idx_listings_location on public.job_listings(employer_location_id)
  where status = 'active' and deleted_at is null;
create index idx_listings_fair on public.job_listings(job_fair_id)
  where job_fair_id is not null;

-- ── listing_skills ───────────────────────────

create table public.listing_skills (
  id            uuid primary key default uuid_generate_v4(),
  listing_id    uuid not null references public.job_listings(id) on delete cascade,
  skill_tag_id  uuid not null references public.skill_tags(id) on delete cascade,
  required      boolean not null default false,

  unique(listing_id, skill_tag_id)
);

-- ── hunter_skills ────────────────────────────

create table public.hunter_skills (
  id            uuid primary key default uuid_generate_v4(),
  hunter_id     uuid not null references public.hunter_profiles(id) on delete cascade,
  skill_tag_id  uuid not null references public.skill_tags(id) on delete cascade,

  unique(hunter_id, skill_tag_id)
);

-- ── location_follows ─────────────────────────

create table public.location_follows (
  id                   uuid primary key default uuid_generate_v4(),
  hunter_id            uuid not null references public.hunter_profiles(id) on delete cascade,
  employer_location_id uuid not null references public.employer_locations(id) on delete cascade,
  notify_all           boolean not null default true,
  notify_matched_only  boolean not null default false,
  followed_at          timestamptz not null default now(),

  unique(hunter_id, employer_location_id)
);

-- Update employer_locations.follower_count on follow insert/delete
create or replace function update_follower_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.employer_locations
    set follower_count = follower_count + 1
    where id = NEW.employer_location_id;
  elsif TG_OP = 'DELETE' then
    update public.employer_locations
    set follower_count = greatest(follower_count - 1, 0)
    where id = OLD.employer_location_id;
  end if;
  return null;
end;
$$;

create trigger trg_follower_count
  after insert or delete on public.location_follows
  for each row execute function update_follower_count();

-- ── saved_listings ───────────────────────────

create table public.saved_listings (
  id          uuid primary key default uuid_generate_v4(),
  hunter_id   uuid not null references public.hunter_profiles(id) on delete cascade,
  listing_id  uuid not null references public.job_listings(id) on delete cascade,
  saved_at    timestamptz not null default now(),

  unique(hunter_id, listing_id)
);
