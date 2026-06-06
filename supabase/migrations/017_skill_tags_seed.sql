-- ─────────────────────────────────────────────
-- 017_skill_tags_seed.sql
-- Seed the skill_tags table with a broad set of
-- common job skills across categories.
-- ─────────────────────────────────────────────

insert into public.skill_tags (label, category, is_active) values
  -- Technology
  ('JavaScript',        'Technology', true),
  ('TypeScript',        'Technology', true),
  ('React',             'Technology', true),
  ('React Native',      'Technology', true),
  ('Node.js',           'Technology', true),
  ('Python',            'Technology', true),
  ('SQL',               'Technology', true),
  ('PostgreSQL',        'Technology', true),
  ('Git',               'Technology', true),
  ('REST APIs',         'Technology', true),
  ('GraphQL',           'Technology', true),
  ('AWS',               'Technology', true),
  ('Docker',            'Technology', true),
  ('iOS Development',   'Technology', true),
  ('Android Development','Technology',true),
  ('Machine Learning',  'Technology', true),
  ('Data Analysis',     'Technology', true),
  ('Cybersecurity',     'Technology', true),
  ('UI/UX Design',      'Technology', true),
  ('Figma',             'Technology', true),

  -- Business & Operations
  ('Project Management','Business',   true),
  ('Customer Service',  'Business',   true),
  ('Sales',             'Business',   true),
  ('Marketing',         'Business',   true),
  ('Social Media',      'Business',   true),
  ('Content Creation',  'Business',   true),
  ('SEO',               'Business',   true),
  ('Copywriting',       'Business',   true),
  ('Email Marketing',   'Business',   true),
  ('Data Entry',        'Business',   true),
  ('Microsoft Office',  'Business',   true),
  ('Google Workspace',  'Business',   true),
  ('Accounting',        'Business',   true),
  ('Bookkeeping',       'Business',   true),
  ('HR Management',     'Business',   true),
  ('Recruiting',        'Business',   true),
  ('Event Planning',    'Business',   true),
  ('Public Relations',  'Business',   true),
  ('Negotiation',       'Business',   true),
  ('Leadership',        'Business',   true),

  -- Trades & Services
  ('Barista',           'Service',    true),
  ('Food Service',      'Service',    true),
  ('Bartending',        'Service',    true),
  ('Retail',            'Service',    true),
  ('Cashier',           'Service',    true),
  ('Inventory Management','Service',  true),
  ('Forklift',          'Trade',      true),
  ('Warehouse',         'Trade',      true),
  ('Delivery',          'Trade',      true),
  ('Driving',           'Trade',      true),
  ('CDL',               'Trade',      true),
  ('Electrical',        'Trade',      true),
  ('Plumbing',          'Trade',      true),
  ('HVAC',              'Trade',      true),
  ('Carpentry',         'Trade',      true),
  ('Welding',           'Trade',      true),
  ('Landscaping',       'Trade',      true),
  ('Construction',      'Trade',      true),
  ('Painting',          'Trade',      true),
  ('Cleaning',          'Trade',      true),

  -- Healthcare & Education
  ('Nursing',           'Healthcare', true),
  ('CNA',               'Healthcare', true),
  ('Medical Assistant', 'Healthcare', true),
  ('CPR Certified',     'Healthcare', true),
  ('Teaching',          'Education',  true),
  ('Tutoring',          'Education',  true),
  ('Childcare',         'Education',  true),
  ('Special Education', 'Education',  true),

  -- Creative
  ('Photography',       'Creative',   true),
  ('Video Editing',     'Creative',   true),
  ('Graphic Design',    'Creative',   true),
  ('Illustration',      'Creative',   true),
  ('Music',             'Creative',   true),
  ('Writing',           'Creative',   true),
  ('Translation',       'Creative',   true),

  -- Soft Skills
  ('Communication',     'Soft Skills',true),
  ('Teamwork',          'Soft Skills',true),
  ('Problem Solving',   'Soft Skills',true),
  ('Time Management',   'Soft Skills',true),
  ('Bilingual',         'Soft Skills',true),
  ('Spanish',           'Soft Skills',true),
  ('Mandarin',          'Soft Skills',true),
  ('French',            'Soft Skills',true)

on conflict (label) do nothing;
