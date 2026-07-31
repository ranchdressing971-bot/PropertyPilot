-- RideBy company workspaces (shared HOA + inspectors)
-- Run in Supabase → SQL Editor after docs/schema.sql
-- Safe to re-run.

-- ── Companies ───────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hoa_name text,
  community_key text,
  created_by uuid references auth.users on delete set null,
  stripe_customer_id text,
  subscription_status text default 'none',
  plan text default 'starter',
  created_at timestamptz default now()
);

create index if not exists companies_community_key_idx
  on public.companies (community_key);

-- ── Membership ──────────────────────────────────────────────────────────────
create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('owner', 'admin', 'inspector')),
  status text not null default 'active' check (status in ('active', 'invited')),
  created_at timestamptz default now(),
  unique (company_id, user_id)
);

create index if not exists company_members_user_idx
  on public.company_members (user_id);
create index if not exists company_members_company_idx
  on public.company_members (company_id);

-- ── Invites ─────────────────────────────────────────────────────────────────
create table if not exists public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'inspector')),
  token text not null unique,
  invited_by uuid references auth.users on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists company_invites_token_idx
  on public.company_invites (token);
create index if not exists company_invites_email_idx
  on public.company_invites (lower(email));

-- ── Profile active workspace ────────────────────────────────────────────────
alter table public.profiles
  add column if not exists active_company_id uuid references public.companies(id) on delete set null;

-- ── Scope operational tables ────────────────────────────────────────────────
alter table public.properties
  add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.properties
  add column if not exists created_by uuid references auth.users on delete set null;

alter table public.inspections
  add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.inspections
  add column if not exists created_by uuid references auth.users on delete set null;

alter table public.audit_log
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists properties_company_id_idx on public.properties (company_id);
create index if not exists inspections_company_id_idx on public.inspections (company_id);
create index if not exists audit_log_company_id_idx on public.audit_log (company_id);

-- ── Helpers ─────────────────────────────────────────────────────────────────
create or replace function public.is_company_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = cid
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.company_role(cid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.company_members m
  where m.company_id = cid
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

-- ── Backfill: one company per existing HOA profile ──────────────────────────
do $$
declare
  r record;
  new_company_id uuid;
begin
  for r in
    select
      p.id as user_id,
      coalesce(nullif(trim(p.hoa_name), ''), nullif(trim(p.full_name), ''), 'My HOA') as company_name,
      nullif(trim(p.hoa_name), '') as hoa_name,
      nullif(trim(p.community_key), '') as community_key,
      p.stripe_customer_id,
      p.subscription_status,
      p.plan,
      p.active_company_id
    from public.profiles p
    where p.active_company_id is null
  loop
    -- Reuse membership if user already belongs somewhere
    select cm.company_id into new_company_id
    from public.company_members cm
    where cm.user_id = r.user_id
      and cm.status = 'active'
    order by case cm.role when 'owner' then 0 when 'admin' then 1 else 2 end
    limit 1;

    if new_company_id is null then
      insert into public.companies (
        name, hoa_name, community_key, created_by,
        stripe_customer_id, subscription_status, plan
      )
      values (
        r.company_name,
        r.hoa_name,
        r.community_key,
        r.user_id,
        r.stripe_customer_id,
        coalesce(r.subscription_status, 'none'),
        coalesce(r.plan, 'starter')
      )
      returning id into new_company_id;

      insert into public.company_members (company_id, user_id, role, status)
      values (new_company_id, r.user_id, 'owner', 'active')
      on conflict (company_id, user_id) do nothing;
    end if;

    update public.profiles
    set active_company_id = new_company_id
    where id = r.user_id
      and active_company_id is null;
  end loop;
end $$;

-- Copy company_id onto existing rows from the owner's membership
update public.properties prop
set
  company_id = coalesce(prop.company_id, cm.company_id),
  created_by = coalesce(prop.created_by, prop.user_id)
from public.company_members cm
where cm.user_id = prop.user_id
  and cm.status = 'active'
  and (prop.company_id is null or prop.created_by is null);

update public.inspections insp
set
  company_id = coalesce(insp.company_id, cm.company_id),
  created_by = coalesce(insp.created_by, insp.user_id)
from public.company_members cm
where cm.user_id = insp.user_id
  and cm.status = 'active'
  and (insp.company_id is null or insp.created_by is null);

update public.audit_log al
set company_id = coalesce(al.company_id, cm.company_id)
from public.company_members cm
where cm.user_id = al.user_id
  and cm.status = 'active'
  and al.company_id is null;

-- Prefer company-scoped uniqueness for the shared roster.
-- Deduplicate (company_id, id) keeping the earliest created_at / any row.
delete from public.properties a
using public.properties b
where a.company_id is not null
  and b.company_id is not null
  and a.company_id = b.company_id
  and a.id = b.id
  and a.ctid < b.ctid;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'properties'
      and constraint_name = 'properties_pkey'
  ) then
    -- Switch PK to (company_id, id) when every row has a company
    if not exists (select 1 from public.properties where company_id is null) then
      alter table public.properties drop constraint properties_pkey;
      alter table public.properties
        alter column company_id set not null;
      alter table public.properties
        add primary key (company_id, id);
    else
      -- Partial unique index until orphans are cleaned
      create unique index if not exists properties_company_id_id_uidx
        on public.properties (company_id, id)
        where company_id is not null;
    end if;
  end if;
exception when others then
  -- Keep migration non-fatal if PK already migrated
  raise notice 'properties PK migration skipped: %', sqlerrm;
end $$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.company_invites enable row level security;

drop policy if exists "Members read company" on public.companies;
create policy "Members read company" on public.companies
  for select using (public.is_company_member(id));

drop policy if exists "Owners update company" on public.companies;
create policy "Owners update company" on public.companies
  for update using (public.company_role(id) in ('owner', 'admin'));

drop policy if exists "Members read membership" on public.company_members;
create policy "Members read membership" on public.company_members
  for select using (public.is_company_member(company_id) or user_id = auth.uid());

drop policy if exists "Admins manage membership" on public.company_members;
create policy "Admins manage membership" on public.company_members
  for all using (public.company_role(company_id) in ('owner', 'admin'));

drop policy if exists "Members read invites" on public.company_invites;
create policy "Members read invites" on public.company_invites
  for select using (public.company_role(company_id) in ('owner', 'admin'));

drop policy if exists "Admins manage invites" on public.company_invites;
create policy "Admins manage invites" on public.company_invites
  for all using (public.company_role(company_id) in ('owner', 'admin'));

-- Replace user-only policies with company membership (keep user fallback for unmigrated rows)
drop policy if exists "Users CRUD own properties" on public.properties;
drop policy if exists "Company members CRUD properties" on public.properties;
create policy "Company members CRUD properties" on public.properties
  for all using (
    (company_id is not null and public.is_company_member(company_id))
    or (company_id is null and auth.uid() = user_id)
  );

drop policy if exists "Users CRUD own inspections" on public.inspections;
drop policy if exists "Company members CRUD inspections" on public.inspections;
create policy "Company members CRUD inspections" on public.inspections
  for all using (
    (company_id is not null and public.is_company_member(company_id))
    or (company_id is null and auth.uid() = user_id)
  );

drop policy if exists "Users read own audit log" on public.audit_log;
drop policy if exists "Users insert own audit log" on public.audit_log;
drop policy if exists "Company members read audit log" on public.audit_log;
drop policy if exists "Company members insert audit log" on public.audit_log;
create policy "Company members read audit log" on public.audit_log
  for select using (
    (company_id is not null and public.is_company_member(company_id))
    or (company_id is null and auth.uid() = user_id)
  );
create policy "Company members insert audit log" on public.audit_log
  for insert with check (
    (company_id is not null and public.is_company_member(company_id))
    or (company_id is null and auth.uid() = user_id)
  );

-- Profiles: users still manage their own row (including active_company_id)
-- (existing profile policies unchanged)

grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update, delete on public.company_members to authenticated;
grant select, insert, update, delete on public.company_invites to authenticated;
grant all on public.companies to service_role;
grant all on public.company_members to service_role;
grant all on public.company_invites to service_role;
