-- ─────────────────────────────────────────────
-- 008_notifications_moderation.sql
-- Notification log, content reports
-- ─────────────────────────────────────────────

-- ── notification_logs ────────────────────────

create table public.notification_logs (
  id                uuid primary key default uuid_generate_v4(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  type              notification_type not null,
  channel           notification_channel not null,
  reference_id      uuid,         -- id of the related entity (swap, listing, etc.)
  read_at           timestamptz,
  sent_at           timestamptz not null default now()
);

create index idx_notifications_recipient on public.notification_logs(recipient_user_id)
  where read_at is null;

-- ── content_reports ──────────────────────────

create table public.content_reports (
  id          uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  target_type content_report_target not null,
  target_id   uuid not null,
  reason      text not null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
