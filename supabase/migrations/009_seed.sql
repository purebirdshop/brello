-- ─────────────────────────────────────────────
-- 009_seed.sql
-- Seed data: radius milestones (Fibonacci curve),
-- video prompts, and the founder user placeholder.
-- ─────────────────────────────────────────────

-- ── radius_milestones ────────────────────────
-- Point thresholds follow a Fibonacci-inspired curve.
-- Early milestones come quickly (2, 3, 5, 8) to reward
-- new users fast. Later milestones (89, 144, 233+) require
-- a genuinely active, high-quality circle to unlock.
--
-- Radius steps from 1.0 to 5.0 miles in 0.25 increments = 16 steps.
-- We spread those across 16 Fibonacci-adjacent thresholds.

insert into public.radius_milestones (points_required, radius_miles, label) values
  (0,   1.00, 'Welcome — your first ring'),
  (2,   1.25, 'First connection'),
  (3,   1.50, 'Growing'),
  (5,   1.75, 'First swap'),
  (8,   2.00, 'Active circle'),
  (13,  2.25, 'Trusted connections'),
  (21,  2.50, 'Halfway there'),
  (34,  2.75, 'Well networked'),
  (55,  3.00, 'Strong circle'),
  (89,  3.25, 'Community builder'),
  (144, 3.50, 'Connector'),
  (233, 3.75, 'Hub'),
  (377, 4.00, 'Pillar'),
  (610, 4.25, 'Legend'),
  (987, 4.50, 'Icon'),
  (1597, 4.75, 'Founder level'),
  (2584, 5.00, 'Max radius — you made it');

-- ── video_prompts ────────────────────────────
-- Shown during the introduction recording flow.
-- App picks one per category and presents them
-- as optional on-screen nudges, not hard requirements.

insert into public.video_prompts (prompt_text, category, is_active) values
  -- Intro
  ('Start with your name and one thing you love about your work.', 'intro', true),
  ('Who are you and what do you do best?', 'intro', true),
  ('Say hi and tell us where you''re coming from — literally and professionally.', 'intro', true),

  -- Experience
  ('What''s the most interesting problem you''ve solved recently?', 'experience', true),
  ('Walk us through something you built or created that you''re proud of.', 'experience', true),
  ('What does a typical great day at work look like for you?', 'experience', true),

  -- Motivation
  ('Why does this place in particular interest you?', 'motivation', true),
  ('What drew you to this opportunity today?', 'motivation', true),
  ('Tell us something about this business that genuinely excites you.', 'motivation', true),

  -- Closing
  ('What would you want them to know that your resume doesn''t show?', 'closing', true),
  ('Leave them with one reason to want to keep talking.', 'closing', true),
  ('What are you hoping this opportunity leads to for you?', 'closing', true);

-- ── alpha / beta role note ───────────────────
-- The founder user is created at runtime during first auth,
-- not seeded here — their auth.users record doesn't exist yet.
-- The API's post-signup hook sets is_founder = true and
-- inserts an auto-accepted circle_member record pairing
-- the founder with every new hunter. See api/services/auth.ts.
