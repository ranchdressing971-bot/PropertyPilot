-- Nexus / Atlas — phase 2 schema (Research Hand + Outreach Hand drafting)
-- Run in Supabase → SQL Editor after NEXUS_SCHEMA.sql (safe to re-run)
--
-- Adds crawl bookkeeping to companies and a draft review queue. Nothing here
-- sends email: drafts are written for human approval only.

-- ── Research bookkeeping on companies ───────────────────────────────────────
alter table public.nexus_companies
  -- 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  add column if not exists research_status text not null default 'pending';

alter table public.nexus_companies
  add column if not exists research_error text;

-- How many pages the crawler actually fetched, for spotting sites that block us.
alter table public.nexus_companies
  add column if not exists research_pages integer not null default 0;

create index if not exists nexus_companies_research_idx
  on public.nexus_companies (research_status);

-- ── Drafts (Outreach Hand output, pending human approval) ───────────────────
create table if not exists public.nexus_drafts (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references public.nexus_companies on delete cascade not null,
  contact_id uuid references public.nexus_contacts on delete set null,
  -- Denormalized so a draft still shows who it was for if the contact is purged.
  to_email text not null,
  subject text not null,
  body text not null,
  model text,
  -- 'pending_approval' | 'approved' | 'rejected' | 'sent'
  status text not null default 'pending_approval',
  -- 0-100 from the confidence engine; low scores should never auto-anything.
  confidence integer,
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by text,
  sent_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists nexus_drafts_status_idx
  on public.nexus_drafts (status);
create index if not exists nexus_drafts_company_idx
  on public.nexus_drafts (company_id);
create index if not exists nexus_drafts_created_idx
  on public.nexus_drafts (created_at desc);

-- One live draft per recipient. Rejected drafts are kept for the audit trail but
-- must not block writing a better one, so they are excluded from the constraint.
create unique index if not exists nexus_drafts_open_recipient_idx
  on public.nexus_drafts (lower(to_email))
  where status in ('pending_approval', 'approved');

alter table public.nexus_drafts enable row level security;
-- No policies on purpose: service_role only, same as every other Nexus table.

grant all on public.nexus_drafts to service_role;
