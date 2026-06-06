-- ─────────────────────────────────────────────
-- 011_rpc_functions.sql
-- PostGIS helper functions called from the mobile
-- client and API. All radius queries go through here
-- so the precise lat/lng never needs to leave the server.
-- ─────────────────────────────────────────────

-- ── locations_near_point ─────────────────────
-- Returns active employer locations within radius_miles
-- of the given lat/lng. Returns display (fuzzed) coords only.

create or replace function locations_near_point(
  lat          double precision,
  lng          double precision,
  radius_miles double precision,
  limit_count  integer default 50
)
returns table (
  id              uuid,
  employer_id     uuid,
  name            text,
  address         text,
  display_lat     double precision,
  display_lng     double precision,
  is_active       boolean,
  follower_count  integer,
  employer_name   text,
  employer_logo   text,
  distance_miles  double precision
)
language sql stable
as $$
  select
    el.id,
    el.employer_id,
    el.name,
    el.address,
    el.display_lat,
    el.display_lng,
    el.is_active,
    el.follower_count,
    ep.business_name  as employer_name,
    ep.logo_url       as employer_logo,
    ST_Distance(
      el.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) / 1609.344      as distance_miles
  from public.employer_locations el
  join public.employer_profiles  ep on ep.id = el.employer_id
  where
    el.is_active   = true
    and el.deleted_at is null
    and ep.deleted_at is null
    and ST_DWithin(
      el.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      lat * 0 + (radius_miles * 1609.344)   -- miles → meters
    )
  order by distance_miles asc
  limit limit_count;
$$;

-- ── listings_near_point ───────────────────────
-- Returns active job listings whose employer location
-- falls within radius_miles. Core map query for Phase 3.

create or replace function listings_near_point(
  lat          double precision,
  lng          double precision,
  radius_miles double precision,
  limit_count  integer default 100
)
returns table (
  id                   uuid,
  title                text,
  description          text,
  listing_type         listing_type,
  tags                 text[],
  posted_at            timestamptz,
  employer_location_id uuid,
  location_name        text,
  display_lat          double precision,
  display_lng          double precision,
  employer_name        text,
  employer_logo        text,
  distance_miles       double precision
)
language sql stable
as $$
  select
    jl.id,
    jl.title,
    jl.description,
    jl.listing_type,
    jl.tags,
    jl.posted_at,
    el.id            as employer_location_id,
    el.name          as location_name,
    el.display_lat,
    el.display_lng,
    ep.business_name as employer_name,
    ep.logo_url      as employer_logo,
    ST_Distance(
      el.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) / 1609.344     as distance_miles
  from public.job_listings       jl
  join public.employer_locations el on el.id = jl.employer_location_id
  join public.employer_profiles  ep on ep.id = el.employer_id
  where
    jl.status     = 'active'
    and jl.deleted_at  is null
    and el.is_active   = true
    and el.deleted_at  is null
    and ep.deleted_at  is null
    and ST_DWithin(
      el.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_miles * 1609.344
    )
  order by distance_miles asc
  limit limit_count;
$$;

-- ── circle_members_near_location ──────────────
-- For the "people in my circle near this listing" bottom sheet.
-- Returns accepted circle members who are within proximity
-- of a given employer location, ordered by distance.
-- Uses display coords for the member (fuzzed) — never precise.

create or replace function circle_members_near_location(
  hunter_profile_id    uuid,
  employer_location_id uuid,
  proximity_miles      double precision default 3.0
)
returns table (
  member_hunter_id  uuid,
  display_name      text,
  avatar_url        text,
  swap_status       hunter_swap_status,
  distance_miles    double precision
)
language sql stable
as $$
  select
    hp.id           as member_hunter_id,
    hp.display_name,
    hp.avatar_url,
    hp.swap_status,
    ST_Distance(
      hp.current_location,
      el.location
    ) / 1609.344    as distance_miles
  from public.circle_members cm
  join public.hunter_profiles hp on (
    -- join whichever side of the relationship is the other person
    case
      when cm.requester_id = hunter_profile_id then cm.recipient_id
      else cm.requester_id
    end = hp.id
  )
  join public.employer_locations el on el.id = employer_location_id
  where
    (cm.requester_id = hunter_profile_id or cm.recipient_id = hunter_profile_id)
    and cm.status = 'accepted'
    and hp.current_location is not null
    and ST_DWithin(
      hp.current_location,
      el.location,
      proximity_miles * 1609.344
    )
  order by distance_miles asc;
$$;

-- ── evaluate_radius_milestone ─────────────────
-- Called by the API radius engine after circle_points changes.
-- Returns the correct radius_miles for a given point total.

create or replace function evaluate_radius_milestone(
  points integer
)
returns double precision
language sql stable
as $$
  select radius_miles
  from public.radius_milestones
  where points_required <= points
  order by points_required desc
  limit 1;
$$;
