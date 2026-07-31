-- Nova — AI outreach manager memory (on top of Nexus tools)
-- Run in Supabase → SQL Editor after NEXUS_SCHEMA.sql + PHASE2 (safe to re-run)

-- Chat transcript for the /nova cockpit
create table if not exists public.nova_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  tool_name text,
  tool_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nova_messages_created_idx
  on public.nova_messages (created_at desc);

alter table public.nova_messages enable row level security;
grant all on public.nova_messages to service_role;

-- Long-lived facts, trial notes, strategy preferences Nova should remember
create table if not exists public.nova_memory (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'note'
    check (kind in ('note', 'trial', 'preference', 'fact')),
  key text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nova_memory_kind_idx
  on public.nova_memory (kind, created_at desc);

create unique index if not exists nova_memory_key_uidx
  on public.nova_memory (key)
  where key is not null;

alter table public.nova_memory enable row level security;
grant all on public.nova_memory to service_role;
