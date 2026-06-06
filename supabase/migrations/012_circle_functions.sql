-- ─────────────────────────────────────────────
-- 012_circle_functions.sql
-- Server-side functions for circle point
-- management and swap notify queue.
-- ─────────────────────────────────────────────

-- ── increment_circle_points ──────────────────
-- Atomically increments circle_points and re-evaluates
-- the hunter's radius milestone. Called after any
-- point-earning event (swap completed, member accepted).

create or replace function increment_circle_points(
  p_hunter_id uuid,
  p_delta     integer
)
returns void
language plpgsql
as $$
declare
  new_points  integer;
  new_radius  double precision;
begin
  -- Increment points
  update public.hunter_profiles
  set    circle_points = circle_points + p_delta
  where  id = p_hunter_id
  returning circle_points into new_points;

  -- Evaluate milestone
  select radius_miles
  into   new_radius
  from   public.radius_milestones
  where  points_required <= new_points
  order  by points_required desc
  limit  1;

  -- Update radius if milestone crossed
  if new_radius is not null then
    update public.hunter_profiles
    set    radius_miles = new_radius
    where  id = p_hunter_id
      and  radius_miles < new_radius;   -- only ever grows
  end if;
end;
$$;

-- ── notify_swap_queue_on_unlock ───────────────
-- When a hunter's swap_status changes to 'available',
-- check the swap_notify_queue for anyone waiting on them
-- and mark them for notification dispatch (Phase 5 picks these up).

create or replace function notify_swap_queue_on_unlock()
returns trigger
language plpgsql
as $$
begin
  if NEW.swap_status = 'available' and OLD.swap_status = 'swap_locked' then
    -- Mark queued notifications as ready (Phase 5 notification service polls this)
    update public.swap_notify_queue
    set    notified_at = now()
    where  locked_hunter_id = NEW.id
      and  notified_at is null;
  end if;
  return NEW;
end;
$$;

create trigger trg_notify_on_unlock
  after update of swap_status on public.hunter_profiles
  for each row
  when (NEW.swap_status = 'available' and OLD.swap_status = 'swap_locked')
  execute function notify_swap_queue_on_unlock();

-- ── quality_weight_update ─────────────────────
-- Recalculates quality_weight for a circle relationship
-- based on swap history and member activity.
-- Called nightly by a cron job (Phase 5).
-- Weight formula:
--   0.4 * swap_ratio          (completed swaps / max(1, days_known / 30))
--   0.4 * activity_score      (1.0 if active in last 7d, decays to 0)
--   0.2 * verified_bonus      (1.0 if both profiles have resumes)

create or replace function refresh_quality_weights()
returns void
language plpgsql
as $$
begin
  update public.circle_members cm
  set quality_weight = least(1.0, greatest(0.0,
    -- Swap component (40%)
    0.4 * least(1.0,
      cm.completed_swaps::float /
      greatest(1.0, extract(epoch from (now() - cm.created_at)) / (30 * 86400))
    )
    +
    -- Activity component (40%): decays over 60 days of inactivity
    0.4 * greatest(0.0,
      1.0 - (
        extract(epoch from (now() - coalesce(hp_req.last_active_at, cm.created_at))) /
        (60 * 86400)
      ) * 0.5
      - (
        extract(epoch from (now() - coalesce(hp_rec.last_active_at, cm.created_at))) /
        (60 * 86400)
      ) * 0.5
    )
    +
    -- Verified bonus (20%): both have resumes
    0.2 * case
      when exists (select 1 from public.resumes where hunter_id = hp_req.id)
       and exists (select 1 from public.resumes where hunter_id = hp_rec.id)
      then 1.0
      else 0.0
    end
  ))
  from
    public.hunter_profiles hp_req on hp_req.id = cm.requester_id,
    public.hunter_profiles hp_rec on hp_rec.id = cm.recipient_id
  where cm.status = 'accepted';
end;
$$;
