-- Property Pilot — run this in Supabase → SQL Editor if scans won't save / disappear on refresh
-- Safe to re-run

-- ── 1. Table grants (most common fix: "permission denied for table inspections") ──
grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;

grant all on all sequences in schema public to postgres, service_role;
grant usage, select on all sequences in schema public to authenticated;

-- ── 2. Inspections RLS (explicit insert/update checks) ──
drop policy if exists "Users CRUD own inspections" on public.inspections;
drop policy if exists "inspections_select_own" on public.inspections;
drop policy if exists "inspections_insert_own" on public.inspections;
drop policy if exists "inspections_update_own" on public.inspections;
drop policy if exists "inspections_delete_own" on public.inspections;

create policy "inspections_select_own" on public.inspections
  for select to authenticated using (auth.uid() = user_id);

create policy "inspections_insert_own" on public.inspections
  for insert to authenticated with check (auth.uid() = user_id);

create policy "inspections_update_own" on public.inspections
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "inspections_delete_own" on public.inspections
  for delete to authenticated using (auth.uid() = user_id);

-- ── 3. Properties RLS ──
drop policy if exists "Users CRUD own properties" on public.properties;
drop policy if exists "properties_select_own" on public.properties;
drop policy if exists "properties_insert_own" on public.properties;
drop policy if exists "properties_update_own" on public.properties;
drop policy if exists "properties_delete_own" on public.properties;

create policy "properties_select_own" on public.properties
  for select to authenticated using (auth.uid() = user_id);

create policy "properties_insert_own" on public.properties
  for insert to authenticated with check (auth.uid() = user_id);

create policy "properties_update_own" on public.properties
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "properties_delete_own" on public.properties
  for delete to authenticated using (auth.uid() = user_id);

-- ── 4. Metadata column (if missing) ──
alter table public.inspections add column if not exists metadata jsonb default '{}'::jsonb;

-- ── 5. Evidence storage bucket ──
insert into storage.buckets (id, name, public)
values ('inspection-evidence', 'inspection-evidence', true)
on conflict (id) do nothing;

drop policy if exists "Users upload own evidence" on storage.objects;
drop policy if exists "Public read inspection evidence" on storage.objects;

create policy "Users upload own evidence"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inspection-evidence'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Public read inspection evidence"
  on storage.objects for select
  using (bucket_id = 'inspection-evidence');
