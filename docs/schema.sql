-- Property Pilot — full Supabase schema
-- Run in Supabase → SQL Editor

-- Profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  hoa_name text,
  notify_violations boolean default true,
  ccr_rules jsonb default '[]'::jsonb,
  onboarding_complete boolean default false,
  stripe_customer_id text,
  subscription_status text default 'none',
  plan text default 'starter',
  terms_accepted_at timestamptz,
  owner_email text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Property roster
create table if not exists public.properties (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  address text not null,
  lot_number text,
  neighborhood text,
  image text default '',
  created_at timestamptz default now(),
  primary key (user_id, id)
);

alter table public.properties enable row level security;

create policy "Users CRUD own properties" on public.properties
  for all using (auth.uid() = user_id);

-- Inspections
create table if not exists public.inspections (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  video_name text,
  neighborhood text,
  results jsonb not null default '[]'::jsonb,
  violations jsonb not null default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.inspections enable row level security;

create policy "Users CRUD own inspections" on public.inspections
  for all using (auth.uid() = user_id);

-- Audit log
create table if not exists public.audit_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.audit_log enable row level security;

create policy "Users read own audit log" on public.audit_log
  for select using (auth.uid() = user_id);
create policy "Users insert own audit log" on public.audit_log
  for insert with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, subscription_status, plan)
  values (new.id, new.email, 'none', 'starter')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Run if profiles table already exists (safe to re-run)
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists subscription_status text default 'none';
alter table public.profiles add column if not exists plan text default 'starter';
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.inspections add column if not exists metadata jsonb default '{}'::jsonb;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Video storage (private — serve via signed URLs)
insert into storage.buckets (id, name, public)
values ('inspection-videos', 'inspection-videos', false)
on conflict (id) do nothing;

create policy "Users upload own videos"
  on storage.objects for insert
  with check (
    bucket_id = 'inspection-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read own videos"
  on storage.objects for select
  using (
    bucket_id = 'inspection-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Evidence frame thumbnails (private — serve via signed URLs)
insert into storage.buckets (id, name, public)
values ('inspection-evidence', 'inspection-evidence', false)
on conflict (id) do nothing;

create policy "Users upload own evidence"
  on storage.objects for insert
  with check (
    bucket_id = 'inspection-evidence'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read own evidence"
  on storage.objects for select
  using (
    bucket_id = 'inspection-evidence'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Required grants (without these, signed-in users cannot save inspections) ──
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all sequences in schema public to postgres, service_role;
grant usage, select on all sequences in schema public to authenticated;
