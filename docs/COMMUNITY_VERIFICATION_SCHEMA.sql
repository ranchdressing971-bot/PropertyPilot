-- RideBy Community Verification — fingerprints + soft verification events
--
-- RUN ORDER (Supabase → SQL Editor):
--   1. docs/schema.sql          (profiles / core tables)
--   2. docs/COMPANY_SCHEMA.sql  (companies + is_company_member)  ← recommended
--   3. THIS FILE
--
-- Safe to re-run. If COMPANY_SCHEMA has not been applied yet, this script still
-- creates the fingerprint tables (without company FKs) and uses user-scoped RLS.
-- Re-run after COMPANY_SCHEMA to attach company FKs + member-aware policies.
--
-- Product note: fingerprints are organizational only — never suspend or lock accounts.

-- gen_random_uuid() is usually available on Supabase; enable pgcrypto if needed
do $$
begin
  create extension if not exists pgcrypto;
exception
  when others then
    raise notice 'pgcrypto extension: %', SQLERRM;
end $$;

-- ── Community fingerprints (baseline from first / expanded inspections) ─────
create table if not exists public.community_fingerprints (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  user_id uuid references auth.users on delete set null,
  community_key text not null,
  hoa_name text not null,
  address_keys text[] not null default '{}',
  addresses text[] not null default '{}',
  roads_covered text[] not null default '{}',
  route_points jsonb not null default '[]'::jsonb,
  boundary jsonb not null default '{}'::jsonb,
  entrances jsonb not null default '[]'::jsonb,
  centroid_lat double precision,
  centroid_lng double precision,
  radius_m integer,
  sample_count integer not null default 0,
  baseline_inspection_id text,
  -- Soft review signals only (never auto-suspend / never block inspections)
  misuse_streak integer not null default 0,
  flagged_for_review boolean not null default false,
  review_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Evolve columns if an older partial table already exists
alter table public.community_fingerprints
  add column if not exists company_id uuid;
alter table public.community_fingerprints
  add column if not exists user_id uuid;
alter table public.community_fingerprints
  add column if not exists community_key text;
alter table public.community_fingerprints
  add column if not exists hoa_name text;
alter table public.community_fingerprints
  add column if not exists address_keys text[] not null default '{}';
alter table public.community_fingerprints
  add column if not exists addresses text[] not null default '{}';
alter table public.community_fingerprints
  add column if not exists roads_covered text[] not null default '{}';
alter table public.community_fingerprints
  add column if not exists route_points jsonb not null default '[]'::jsonb;
alter table public.community_fingerprints
  add column if not exists boundary jsonb not null default '{}'::jsonb;
alter table public.community_fingerprints
  add column if not exists entrances jsonb not null default '[]'::jsonb;
alter table public.community_fingerprints
  add column if not exists centroid_lat double precision;
alter table public.community_fingerprints
  add column if not exists centroid_lng double precision;
alter table public.community_fingerprints
  add column if not exists radius_m integer;
alter table public.community_fingerprints
  add column if not exists sample_count integer not null default 0;
alter table public.community_fingerprints
  add column if not exists baseline_inspection_id text;
alter table public.community_fingerprints
  add column if not exists misuse_streak integer not null default 0;
alter table public.community_fingerprints
  add column if not exists flagged_for_review boolean not null default false;
alter table public.community_fingerprints
  add column if not exists review_note text;
alter table public.community_fingerprints
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.community_fingerprints
  add column if not exists created_at timestamptz default now();
alter table public.community_fingerprints
  add column if not exists updated_at timestamptz default now();

-- Optional FK → companies (skip quietly if COMPANY_SCHEMA not applied yet)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'companies'
  ) then
    begin
      alter table public.community_fingerprints
        drop constraint if exists community_fingerprints_company_id_fkey;
      alter table public.community_fingerprints
        add constraint community_fingerprints_company_id_fkey
        foreign key (company_id) references public.companies(id) on delete cascade;
    exception
      when others then
        raise notice 'community_fingerprints company FK skipped: %', SQLERRM;
    end;
  else
    raise notice 'public.companies missing — skipped company FK. Run docs/COMPANY_SCHEMA.sql then re-run this file.';
  end if;
end $$;

-- Ensure user_id FK to auth.users (safe if already present)
do $$
begin
  begin
    alter table public.community_fingerprints
      drop constraint if exists community_fingerprints_user_id_fkey;
    alter table public.community_fingerprints
      add constraint community_fingerprints_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  exception
    when others then
      raise notice 'community_fingerprints user_id FK skipped: %', SQLERRM;
  end;
end $$;

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
  fingerprint_id uuid,
  company_id uuid,
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
  resolution text,
  resolution_at timestamptz,
  flagged_for_review boolean not null default false,
  helpful_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.community_verification_events
  add column if not exists fingerprint_id uuid;
alter table public.community_verification_events
  add column if not exists company_id uuid;
alter table public.community_verification_events
  add column if not exists user_id uuid;
alter table public.community_verification_events
  add column if not exists community_key text;
alter table public.community_verification_events
  add column if not exists inspection_id text;
alter table public.community_verification_events
  add column if not exists outcome text;
alter table public.community_verification_events
  add column if not exists match_ratio numeric;
alter table public.community_verification_events
  add column if not exists known_count integer not null default 0;
alter table public.community_verification_events
  add column if not exists new_count integer not null default 0;
alter table public.community_verification_events
  add column if not exists missing_count integer not null default 0;
alter table public.community_verification_events
  add column if not exists new_addresses text[] not null default '{}';
alter table public.community_verification_events
  add column if not exists observed_addresses text[] not null default '{}';
alter table public.community_verification_events
  add column if not exists observed_roads text[] not null default '{}';
alter table public.community_verification_events
  add column if not exists geo_lat double precision;
alter table public.community_verification_events
  add column if not exists geo_lng double precision;
alter table public.community_verification_events
  add column if not exists route_points jsonb not null default '[]'::jsonb;
alter table public.community_verification_events
  add column if not exists resolution text;
alter table public.community_verification_events
  add column if not exists resolution_at timestamptz;
alter table public.community_verification_events
  add column if not exists flagged_for_review boolean not null default false;
alter table public.community_verification_events
  add column if not exists helpful_message text;
alter table public.community_verification_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.community_verification_events
  add column if not exists created_at timestamptz default now();

do $$
begin
  begin
    alter table public.community_verification_events
      drop constraint if exists community_verification_events_fingerprint_id_fkey;
    alter table public.community_verification_events
      add constraint community_verification_events_fingerprint_id_fkey
      foreign key (fingerprint_id) references public.community_fingerprints(id) on delete set null;
  exception
    when others then
      raise notice 'verification_events fingerprint FK skipped: %', SQLERRM;
  end;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'companies'
  ) then
    begin
      alter table public.community_verification_events
        drop constraint if exists community_verification_events_company_id_fkey;
      alter table public.community_verification_events
        add constraint community_verification_events_company_id_fkey
        foreign key (company_id) references public.companies(id) on delete set null;
    exception
      when others then
        raise notice 'verification_events company FK skipped: %', SQLERRM;
    end;
  end if;

  begin
    alter table public.community_verification_events
      drop constraint if exists community_verification_events_user_id_fkey;
    alter table public.community_verification_events
      add constraint community_verification_events_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  exception
    when others then
      raise notice 'verification_events user_id FK skipped: %', SQLERRM;
  end;
end $$;

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

-- Stub membership helper only if COMPANY_SCHEMA has not defined it yet
do $$
begin
  if to_regprocedure('public.is_company_member(uuid)') is null then
    create function public.is_company_member(cid uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $fn$
      select false;
    $fn$;
    raise notice 'Created stub public.is_company_member — replace by running docs/COMPANY_SCHEMA.sql';
  end if;
end $$;

drop policy if exists "Members read community fingerprints" on public.community_fingerprints;
create policy "Members read community fingerprints" on public.community_fingerprints
  for select to authenticated using (
    (company_id is not null and public.is_company_member(company_id))
    or user_id = auth.uid()
  );

drop policy if exists "Members read verification events" on public.community_verification_events;
create policy "Members read verification events" on public.community_verification_events
  for select to authenticated using (
    (company_id is not null and public.is_company_member(company_id))
    or user_id = auth.uid()
  );

-- Writes go through service role from analyze-inspection / resolve APIs
grant usage on schema public to authenticated, service_role;
grant select on public.community_fingerprints to authenticated;
grant select on public.community_verification_events to authenticated;
grant all on public.community_fingerprints to service_role;
grant all on public.community_verification_events to service_role;

-- Done. Enable product behavior with COMMUNITY_VERIFICATION_ENABLED=true after this succeeds.
