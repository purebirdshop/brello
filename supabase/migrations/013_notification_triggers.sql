-- ─────────────────────────────────────────────
-- 013_notification_triggers.sql
-- RPC and triggers needed by the notification service.
-- ─────────────────────────────────────────────

-- ── hunters_near_point ────────────────────────
-- Returns user_ids of hunters whose current_location
-- falls within radius_miles of a given point.
-- Used by job fair announcement broadcasts.

create or replace function hunters_near_point(
  lat          double precision,
  lng          double precision,
  radius_miles double precision
)
returns table (
  user_id    uuid,
  hunter_id  uuid
)
language sql stable
as $$
  select
    u.id   as user_id,
    hp.id  as hunter_id
  from public.hunter_profiles hp
  join public.users u on u.id = hp.user_id
  where
    hp.current_location is not null
    and hp.deleted_at   is null
    and u.deleted_at    is null
    and ST_DWithin(
      hp.current_location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_miles * 1609.344
    );
$$;

-- ── notify_followers_on_listing_active ────────
-- When a job listing transitions to 'active' status
-- (preview_approved_at set + status flipped),
-- this trigger records a notification_pending event
-- that the API's notification worker picks up.
-- We don't call the Expo API from the DB — we just
-- flag the work for the API layer.

create table if not exists public.notification_queue (
  id                   uuid primary key default uuid_generate_v4(),
  type                 notification_type not null,
  payload              jsonb not null,
  created_at           timestamptz not null default now(),
  processed_at         timestamptz,
  error                text
);

alter table public.notification_queue enable row level security;

-- Only service role can read/write this table
create policy "notification_queue: service role only"
  on public.notification_queue
  using (false);   -- blocks all client access; API uses service role

-- Trigger function: enqueue follower notifications when a listing goes active
create or replace function enqueue_listing_notifications()
returns trigger
language plpgsql
as $$
begin
  -- Only fire when status changes to 'active'
  if NEW.status = 'active' and (OLD.status is distinct from 'active') then
    insert into public.notification_queue (type, payload)
    values (
      'listing_posted',
      jsonb_build_object(
        'listing_id',            NEW.id,
        'employer_location_id',  NEW.employer_location_id,
        'title',                 NEW.title
      )
    );
  end if;
  return NEW;
end;
$$;

create trigger trg_listing_active_notify
  after update of status on public.job_listings
  for each row
  execute function enqueue_listing_notifications();

-- Trigger function: enqueue notifications when job fair goes live
create or replace function enqueue_job_fair_notifications()
returns trigger
language plpgsql
as $$
begin
  if NEW.status = 'live' and OLD.status = 'upcoming' then
    insert into public.notification_queue (type, payload)
    values (
      'job_fair_live',
      jsonb_build_object(
        'fair_id',  NEW.id,
        'name',     NEW.name,
        'lat',      NEW.lat,
        'lng',      NEW.lng
      )
    );
  elsif NEW.status = 'upcoming' and OLD.status is null then
    insert into public.notification_queue (type, payload)
    values (
      'job_fair_announced',
      jsonb_build_object(
        'fair_id',  NEW.id,
        'name',     NEW.name,
        'lat',      NEW.lat,
        'lng',      NEW.lng
      )
    );
  end if;
  return NEW;
end;
$$;

create trigger trg_job_fair_notify
  after insert or update of status on public.job_fairs
  for each row
  execute function enqueue_job_fair_notifications();
