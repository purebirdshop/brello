-- ─────────────────────────────────────────────
-- 001_extensions.sql
-- Enable required PostgreSQL extensions
-- ─────────────────────────────────────────────

create extension if not exists "uuid-ossp";      -- uuid_generate_v4()
create extension if not exists "postgis";         -- geography, ST_DWithin, ST_Distance
create extension if not exists "pg_trgm";         -- trigram search for skill tags / listings
