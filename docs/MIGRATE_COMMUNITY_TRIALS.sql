-- One free trial per community (prevents email-farming the 3 free inspections)
-- Run in Supabase → SQL Editor after schema.sql

alter table public.profiles
  add column if not exists community_key text;

create index if not exists profiles_community_key_idx
  on public.profiles (community_key);

create table if not exists public.community_trials (
  community_key text primary key,
  claimed_by uuid references auth.users on delete set null,
  hoa_name text not null,
  claimed_at timestamptz default now()
);

alter table public.community_trials enable row level security;

-- Users can read whether a key is claimed (needed for UX); writes go through service role
drop policy if exists "Anyone authenticated can read community trials" on public.community_trials;
create policy "Anyone authenticated can read community trials"
  on public.community_trials for select
  to authenticated
  using (true);

grant select on public.community_trials to authenticated;
grant all on public.community_trials to service_role;
