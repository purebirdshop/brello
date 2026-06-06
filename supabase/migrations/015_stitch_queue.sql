-- ─────────────────────────────────────────────
-- 015_stitch_queue.sql
-- Tracks individual phase uploads and the stitch job queue.
-- Each introduction has up to 3 phase clips before stitching.
-- ─────────────────────────────────────────────

-- ── introduction_phases ──────────────────────
-- Stores each recorded phase clip separately before stitching.
-- Once all 3 phases are uploaded and ready, the stitch job runs.

create table public.introduction_phases (
  id                uuid primary key default uuid_generate_v4(),
  application_id    uuid not null references public.video_applications(id) on delete cascade,
  phase_index       integer not null check (phase_index in (0, 1, 2)),
  mux_upload_id     text not null,
  mux_asset_id      text,
  mux_playback_id   text,
  prompt_id         uuid references public.video_prompts(id),
  prompt_text       text,
  duration_seconds  integer,
  transcode_status  video_transcode_status not null default 'pending',
  created_at        timestamptz not null default now(),

  unique(application_id, phase_index)
);

create index idx_phases_application on public.introduction_phases(application_id);
create index idx_phases_asset on public.introduction_phases(mux_asset_id)
  where mux_asset_id is not null;

-- ── stitch_jobs ───────────────────────────────
-- Queue for stitch operations. The API worker polls this
-- and calls muxStitchService when all 3 phases are ready.

create type stitch_job_status as enum (
  'pending',    -- waiting for all phases to be ready
  'processing', -- stitch in progress
  'done',       -- stitched asset ready
  'failed'      -- error during stitch
);

create table public.stitch_jobs (
  id              uuid primary key default uuid_generate_v4(),
  application_id  uuid not null references public.video_applications(id) on delete cascade,
  video_media_id  uuid not null references public.video_media(id),
  hunter_username text not null,
  status          stitch_job_status not null default 'pending',
  error           text,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,

  unique(application_id)
);

-- RLS: service role only
alter table public.introduction_phases enable row level security;
alter table public.stitch_jobs         enable row level security;

-- Hunters can read their own phase records
create policy "introduction_phases: hunter reads own"
  on public.introduction_phases for select
  using (
    application_id in (
      select va.id from public.video_applications va
      join public.hunter_profiles hp on hp.id = va.hunter_id
      where hp.user_id = auth.uid()
    )
  );

create policy "introduction_phases: hunter inserts own"
  on public.introduction_phases for insert
  with check (
    application_id in (
      select va.id from public.video_applications va
      join public.hunter_profiles hp on hp.id = va.hunter_id
      where hp.user_id = auth.uid()
    )
  );

-- ── Trigger: enqueue stitch when all 3 phases ready ──
-- Fires after each introduction_phases row is updated.
-- When all 3 phases for an application have status = 'ready',
-- inserts a stitch_jobs row.

create or replace function maybe_enqueue_stitch()
returns trigger
language plpgsql
as $$
declare
  ready_count integer;
  app_row     record;
  media_row   record;
  username    text;
begin
  -- Count ready phases for this application
  select count(*) into ready_count
  from public.introduction_phases
  where application_id = NEW.application_id
    and transcode_status = 'ready';

  -- Only proceed when all 3 are ready
  if ready_count < 3 then
    return NEW;
  end if;

  -- Check if stitch job already exists
  if exists (
    select 1 from public.stitch_jobs
    where application_id = NEW.application_id
  ) then
    return NEW;
  end if;

  -- Get application and media info
  select va.*, hp.user_id
  into app_row
  from public.video_applications va
  join public.hunter_profiles hp on hp.id = va.hunter_id
  where va.id = NEW.application_id;

  select * into media_row
  from public.video_media
  where id = app_row.video_media_id;

  -- Get hunter username from users table
  select split_part(email, '@', 1) into username
  from public.users
  where id = app_row.user_id;

  -- Enqueue stitch job
  insert into public.stitch_jobs (
    application_id,
    video_media_id,
    hunter_username,
    status
  ) values (
    NEW.application_id,
    media_row.id,
    username,
    'pending'
  );

  return NEW;
end;
$$;

create trigger trg_maybe_enqueue_stitch
  after update of transcode_status on public.introduction_phases
  for each row
  when (NEW.transcode_status = 'ready')
  execute function maybe_enqueue_stitch();
