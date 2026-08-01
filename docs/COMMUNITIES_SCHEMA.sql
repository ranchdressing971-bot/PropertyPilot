-- RideBy communities (HOAs managed under a company workspace)
-- Run in Supabase → SQL Editor after docs/COMPANY_SCHEMA.sql
-- Safe to re-run.
--
-- Billing: profiles.community_count = how many communities the account may create.
-- Trial / unpaid: at most 1 community. Paid: up to community_count.

-- ── Communities table ───────────────────────────────────────────────────────
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  community_key text not null,
  created_at timestamptz default now()
);

create index if not exists communities_company_id_idx
  on public.communities (company_id);
create index if not exists communities_user_id_idx
  on public.communities (user_id);
create index if not exists communities_community_key_idx
  on public.communities (community_key);

-- One community key per company (shared workspace)
create unique index if not exists communities_company_key_uidx
  on public.communities (company_id, community_key)
  where company_id is not null;

-- Personal fallback when no company yet
create unique index if not exists communities_user_key_uidx
  on public.communities (user_id, community_key)
  where company_id is null;

-- ── Link properties + inspections ───────────────────────────────────────────
alter table public.properties
  add column if not exists community_id uuid references public.communities(id) on delete set null;

alter table public.inspections
  add column if not exists community_id uuid references public.communities(id) on delete set null;

create index if not exists properties_community_id_idx
  on public.properties (community_id);
create index if not exists inspections_community_id_idx
  on public.inspections (community_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.communities enable row level security;

drop policy if exists "Members CRUD communities" on public.communities;
create policy "Members CRUD communities" on public.communities
  for all using (
    (company_id is not null and public.is_company_member(company_id))
    or (company_id is null and auth.uid() = user_id)
  );

grant select, insert, update, delete on public.communities to authenticated;
grant all on public.communities to service_role;

-- ── Backfill: one community from each company / profile HOA name ────────────
insert into public.communities (company_id, user_id, name, community_key)
select
  c.id,
  coalesce(c.created_by, cm.user_id),
  coalesce(nullif(trim(c.hoa_name), ''), nullif(trim(c.name), ''), 'My Community'),
  coalesce(
    nullif(trim(c.community_key), ''),
    regexp_replace(
      lower(coalesce(nullif(trim(c.hoa_name), ''), c.name, 'mycommunity')),
      '[^a-z0-9]+',
      '',
      'g'
    )
  )
from public.companies c
left join lateral (
  select user_id
  from public.company_members
  where company_id = c.id and status = 'active'
  order by case role when 'owner' then 0 when 'admin' then 1 else 2 end
  limit 1
) cm on true
where coalesce(c.created_by, cm.user_id) is not null
  and not exists (
    select 1 from public.communities x
    where x.company_id = c.id
  )
on conflict do nothing;

-- Attach unscoped properties / inspections by matching neighborhood → community name
update public.properties p
set community_id = c.id
from public.communities c
where p.community_id is null
  and p.company_id is not null
  and c.company_id = p.company_id
  and lower(trim(coalesce(p.neighborhood, ''))) = lower(trim(c.name));

update public.inspections i
set community_id = c.id
from public.communities c
where i.community_id is null
  and i.company_id is not null
  and c.company_id = i.company_id
  and lower(trim(coalesce(i.neighborhood, ''))) = lower(trim(c.name));
