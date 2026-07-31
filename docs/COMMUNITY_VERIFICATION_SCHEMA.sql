-- RideBy Community Verification — fingerprints + soft verification events
-- Run in Supabase → SQL Editor after docs/schema.sql and docs/COMPANY_SCHEMA.sql
-- Safe to re-run.

-- ── Community fingerprints (baseline from first / expanded inspections) ─────
create table if not exists public.community_fingerprints (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references auth.users on delete set null,
  community_key text not null,
  hoa_name text not null,
  -- Detected home identity
  address_keys text[] not null default '{}',
  addresses text[] not null default '{}',
  -- Roads covered (street cores from addresses)
  roads_covered text[] not null default '{}',
  -- Approximate GPS route + soft boundary
  route_points jsonb not null default '[]'::jsonb,
  boundary jsonb not null default '{}'::jsonb,
  -- Community entrance(s) if detectable (route ends / edge points)
  entrances jsonb not null default '[]'::jsonb,
  centroid_lat double precision,
  centroid_lng double precision,
  radius_m integer,
  sample_count integer not null default 0,
  baseline_inspection_id text,
  -- Soft abuse / review signals (never auto-suspend)
  misuse_streak integer not null default 0,
  flagged_for_review boolean not null default false,
  review_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One active fingerprint per company+community (company-scoped when available)
create unique index if not exists community_fingerprints_company_key_uidx
  on public.community_fingerprints (company_id, community_key)
  where company_id is not null;

create unique index if not exists community_fingerprints_user_key_uidx
  on public.community_fingerprints (user_id, community_key)
  where company_id is null and user_id is not null;

create index if not exists community_fingerprints_company_idx
  on public.community_fingerprints (company_id);
create index if not exists community_fingerprints_community_key_idx
  on public.community_fingerprints (community_key);
create index if not exists community_fingerprints_flagged_idx
  on public.community_fingerprints (flagged_for_review)
  where flagged_for_review = true;

-- ── Verification events (every inspection compare) ──────────────────────────
create table if not exists public.community_verification_events (
  id uuid primary key default gen_random_uuid(),
  fingerprint_id uuid references public.community_fingerprints(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  user_id uuid references auth.users on delete set null,
  community_key text not null,
  inspection_id text,
  -- match | small_expansion | large_difference | bootstrap | ignored_new | expanded | new_community_suggested
  outcome text not null,
  match_ratio numeric,
  known_count integer not null default 0,
  new_count integer not null default 0,
  missing_count integer not null default 0,
  new_addresses text[] not null default '{}',
  observed_addresses text[] not null default '{}',
  observed_roads text[] not null default '{}',
  geo_lat double precision,
  geo_lng double precision,
  route_points jsonb not null default '[]'::jsonb,
  -- Soft UX resolution chosen by inspector (nullable until answered)
  resolution text,
  resolution_at timestamptz,
  flagged_for_review boolean not null default false,
  helpful_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists community_verification_events_fingerprint_idx
  on public.community_verification_events (fingerprint_id, created_at desc);
create index if not exists community_verification_events_company_idx
  on public.community_verification_events (company_id, created_at desc);
create index if not exists community_verification_events_inspection_idx
  on public.community_verification_events (inspection_id);
create index if not exists community_verification_events_user_idx
  on public.community_verification_events (user_id, created_at desc);
create index if not exists community_verification_events_flagged_idx
  on public.community_verification_events (flagged_for_review)
  where flagged_for_review = true;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.community_fingerprints enable row level security;
alter table public.community_verification_events enable row level security;

-- Members can read fingerprints for their company; owners of personal rows can read theirs
drop policy if exists "Members read community fingerprints" on public.community_fingerprints;
create policy "Members read community fingerprints" on public.community_fingerprints
  for select using (
    (company_id is not null and public.is_company_member(company_id))
    or (company_id is null and user_id = auth.uid())
  );

drop policy if exists "Members read verification events" on public.community_verification_events;
create policy "Members read verification events" on public.community_verification_events
  for select using (
    (company_id is not null and public.is_company_member(company_id))
    or user_id = auth.uid()
  );

-- Writes go through service role from analyze-inspection / resolve APIs
grant select on public.community_fingerprints to authenticated;
grant select on public.community_verification_events to authenticated;
grant all on public.community_fingerprints to service_role;
grant all on public.community_verification_events to service_role;
