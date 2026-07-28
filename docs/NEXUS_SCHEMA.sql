-- Nexus / Atlas — outreach system schema
-- Run in Supabase → SQL Editor (safe to re-run)
--
-- Nexus is internal tooling: every table is service-role only. RLS is enabled
-- with no policies for `authenticated`, so the anon/authenticated keys can read
-- nothing. All access goes through createAdminClient() in server routes.

-- ── Companies (Lead Hand output) ──────────────────────────────────────────────
create table if not exists public.nexus_companies (
  id uuid default gen_random_uuid() primary key,
  -- Google Place ID: the dedupe key. Google permits storing this indefinitely.
  place_id text unique,
  name text not null,
  website text,
  phone text,
  address text,
  city text,
  state text,
  -- Where this row came from: 'places' | 'manual' | 'import'
  source text not null default 'places',
  search_query text,
  -- Pipeline position: new → researching → ready → queued → contacted → replied → won | lost
  stage text not null default 'new',
  -- 'active' | 'paused' | 'disqualified'
  status text not null default 'active',
  disqualified_reason text,
  -- Google-sourced fields other than place_id should be refreshed, not treated
  -- as permanent. This records when we last pulled them.
  places_synced_at timestamptz,
  researched_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists nexus_companies_stage_idx
  on public.nexus_companies (stage);
create index if not exists nexus_companies_status_idx
  on public.nexus_companies (status);
create index if not exists nexus_companies_created_idx
  on public.nexus_companies (created_at desc);

-- ── Contacts (Research Hand output; table ships now so hands can rely on it) ──
create table if not exists public.nexus_contacts (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references public.nexus_companies on delete cascade not null,
  email text not null,
  name text,
  role text,
  -- Every piece of contact info records the page it came from.
  source_url text,
  -- 0-100: how sure we are this address is a real, correct contact
  confidence integer default 0,
  verified_at timestamptz,
  created_at timestamptz default now(),
  unique (company_id, email)
);

create index if not exists nexus_contacts_company_idx
  on public.nexus_contacts (company_id);
create index if not exists nexus_contacts_email_idx
  on public.nexus_contacts (lower(email));

-- ── Job queue (every hand runs as jobs, never as a long request) ─────────────
create table if not exists public.nexus_jobs (
  id uuid default gen_random_uuid() primary key,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  -- 'queued' | 'running' | 'done' | 'failed'
  status text not null default 'queued',
  run_after timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  locked_at timestamptz,
  last_error text,
  -- Optional idempotency key so the same work can't be queued twice
  dedupe_key text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists nexus_jobs_claim_idx
  on public.nexus_jobs (status, run_after);
create index if not exists nexus_jobs_created_idx
  on public.nexus_jobs (created_at desc);

-- ── Action log (append-only: nothing should happen invisibly) ────────────────
create table if not exists public.nexus_actions (
  id uuid default gen_random_uuid() primary key,
  -- 'nexus' for autonomous actions, 'isaac' for human ones
  actor text not null default 'nexus',
  action text not null,
  entity_type text,
  entity_id text,
  -- 0-100 when a decision was scored by the confidence engine
  confidence integer,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists nexus_actions_created_idx
  on public.nexus_actions (created_at desc);
create index if not exists nexus_actions_entity_idx
  on public.nexus_actions (entity_type, entity_id);

-- ── Suppressions (never contact twice, honor opt-outs forever) ───────────────
-- Ships before any sending exists so no hand can be written without it.
create table if not exists public.nexus_suppressions (
  id uuid default gen_random_uuid() primary key,
  -- Store either a full address or a bare domain; check both before sending.
  email text,
  domain text,
  -- 'unsubscribed' | 'bounced' | 'complained' | 'manual' | 'not_interested'
  reason text not null,
  notes text,
  created_at timestamptz default now()
);

create unique index if not exists nexus_suppressions_email_idx
  on public.nexus_suppressions (lower(email)) where email is not null;
create unique index if not exists nexus_suppressions_domain_idx
  on public.nexus_suppressions (lower(domain)) where domain is not null;

-- ── Row level security: internal only ───────────────────────────────────────
alter table public.nexus_companies enable row level security;
alter table public.nexus_contacts enable row level security;
alter table public.nexus_jobs enable row level security;
alter table public.nexus_actions enable row level security;
alter table public.nexus_suppressions enable row level security;

-- No policies are created on purpose. service_role bypasses RLS; anon and
-- authenticated therefore get nothing, which is what we want for internal data.

-- ── Atomic job claim ────────────────────────────────────────────────────────
-- `for update skip locked` is what makes overlapping ticks safe: a second tick
-- skips rows the first already claimed instead of blocking on them, so a job
-- can never be handed to two workers (and an email can never send twice).
create or replace function public.nexus_claim_jobs(batch_size integer default 5)
returns setof public.nexus_jobs as $$
  update public.nexus_jobs
  set status = 'running',
      locked_at = now(),
      attempts = attempts + 1,
      updated_at = now()
  where id in (
    select id from public.nexus_jobs
    where status = 'queued'
      and run_after <= now()
    order by run_after
    limit batch_size
    for update skip locked
  )
  returning *;
$$ language sql volatile security definer;

-- Requeue jobs whose worker died mid-run (function timeout, deploy, crash).
create or replace function public.nexus_requeue_stale_jobs(stale_minutes integer default 10)
returns integer as $$
declare
  affected integer;
begin
  update public.nexus_jobs
  set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
      last_error = coalesce(last_error, 'Worker timed out'),
      locked_at = null,
      updated_at = now()
  where status = 'running'
    and locked_at < now() - (stale_minutes || ' minutes')::interval;
  get diagnostics affected = row_count;
  return affected;
end;
$$ language plpgsql volatile security definer;

revoke all on function public.nexus_claim_jobs(integer) from public, anon, authenticated;
revoke all on function public.nexus_requeue_stale_jobs(integer) from public, anon, authenticated;
grant execute on function public.nexus_claim_jobs(integer) to service_role;
grant execute on function public.nexus_requeue_stale_jobs(integer) to service_role;

-- ── Grants ──────────────────────────────────────────────────────────────────
grant all on public.nexus_companies to service_role;
grant all on public.nexus_contacts to service_role;
grant all on public.nexus_jobs to service_role;
grant all on public.nexus_actions to service_role;
grant all on public.nexus_suppressions to service_role;
