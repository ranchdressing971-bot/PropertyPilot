-- TradeFlow V1 schema
-- Run via Supabase migrations or SQL Editor.
-- Depends on: auth.users (Supabase Auth)

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── updated_at trigger ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ── Helper: businesses the current user belongs to (RLS) ─────────────────────
create or replace function public.get_user_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select bm.business_id
  from public.business_members bm
  where bm.user_id = auth.uid();
$$;

grant execute on function public.get_user_business_ids() to authenticated;
grant execute on function public.get_user_business_ids() to service_role;

-- ── profiles (extends auth.users) ───────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  active_business_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ── businesses ──────────────────────────────────────────────────────────────
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text,
  phone text,
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text not null default 'US',
  default_hourly_labor_rate numeric(12, 2) not null default 125.00,
  default_tax_rate numeric(6, 4) not null default 0.0700,
  logo_url text,
  currency text not null default 'USD',
  invoice_prefix text not null default 'INV',
  invoice_next_number integer not null default 1001,
  default_payment_terms_days integer not null default 14,
  default_invoice_note text,
  reminders_enabled boolean not null default true,
  stripe_customer_id text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint businesses_invoice_next_number_chk check (invoice_next_number > 0),
  constraint businesses_default_tax_rate_chk check (default_tax_rate >= 0 and default_tax_rate <= 1),
  constraint businesses_default_hourly_labor_rate_chk check (default_hourly_labor_rate >= 0),
  constraint businesses_default_payment_terms_days_chk check (default_payment_terms_days >= 0)
);

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute procedure public.set_updated_at();

alter table public.profiles
  drop constraint if exists profiles_active_business_id_fkey;
alter table public.profiles
  add constraint profiles_active_business_id_fkey
  foreign key (active_business_id) references public.businesses (id) on delete set null;

-- ── business_members ────────────────────────────────────────────────────────
create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'employee'
    check (role in ('owner', 'admin', 'employee')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (business_id, user_id)
);

create index if not exists business_members_user_id_idx
  on public.business_members (user_id);
create index if not exists business_members_business_id_idx
  on public.business_members (business_id);

drop trigger if exists business_members_set_updated_at on public.business_members;
create trigger business_members_set_updated_at
  before update on public.business_members
  for each row execute procedure public.set_updated_at();

-- ── customers ───────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  company_name text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists customers_business_id_idx
  on public.customers (business_id);
create index if not exists customers_business_name_idx
  on public.customers (business_id, lower(full_name));

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();

-- ── jobs ────────────────────────────────────────────────────────────────────
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  title text not null,
  description text,
  service_type text not null default 'repair'
    check (service_type in (
      'maintenance',
      'repair',
      'install',
      'diagnostic',
      'tune_up',
      'emergency',
      'inspection',
      'replacement',
      'other'
    )),
  status text not null default 'scheduled'
    check (status in (
      'draft',
      'scheduled',
      'in_progress',
      'completed',
      'cancelled',
      'on_hold'
    )),
  scheduled_date date,
  start_time time,
  estimated_duration_minutes integer,
  assigned_technician_name text,
  labor_hours numeric(8, 2) not null default 0,
  labor_rate numeric(12, 2),
  labor_cost numeric(12, 2) not null default 0,
  parts_cost numeric(12, 2) not null default 0,
  other_cost numeric(12, 2) not null default 0,
  amount_charged numeric(12, 2) not null default 0,
  invoice_status text not null default 'none'
    check (invoice_status in ('none', 'draft', 'sent', 'partial', 'paid', 'void')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'partial', 'paid', 'waived')),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint jobs_labor_hours_chk check (labor_hours >= 0),
  constraint jobs_costs_chk check (
    labor_cost >= 0 and parts_cost >= 0 and other_cost >= 0 and amount_charged >= 0
  ),
  constraint jobs_estimated_duration_chk check (
    estimated_duration_minutes is null or estimated_duration_minutes > 0
  )
);

create index if not exists jobs_business_id_idx on public.jobs (business_id);
create index if not exists jobs_customer_id_idx on public.jobs (customer_id);
create index if not exists jobs_business_status_idx on public.jobs (business_id, status);
create index if not exists jobs_business_scheduled_date_idx
  on public.jobs (business_id, scheduled_date);
create index if not exists jobs_business_payment_status_idx
  on public.jobs (business_id, payment_status);

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute procedure public.set_updated_at();

-- ── job_photos ──────────────────────────────────────────────────────────────
create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  storage_path text not null,
  caption text,
  taken_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists job_photos_job_id_idx on public.job_photos (job_id);
create index if not exists job_photos_business_id_idx on public.job_photos (business_id);

drop trigger if exists job_photos_set_updated_at on public.job_photos;
create trigger job_photos_set_updated_at
  before update on public.job_photos
  for each row execute procedure public.set_updated_at();

-- ── invoices ────────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  job_id uuid references public.jobs (id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft'
    check (status in (
      'draft',
      'sent',
      'viewed',
      'partial',
      'paid',
      'overdue',
      'void',
      'cancelled'
    )),
  issue_date date not null default (timezone('utc', now()))::date,
  due_date date,
  subtotal numeric(12, 2) not null default 0,
  tax_rate numeric(6, 4) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  notes text,
  stripe_payment_intent_id text,
  payment_token text unique,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (business_id, invoice_number),
  constraint invoices_amounts_chk check (
    subtotal >= 0
    and tax_amount >= 0
    and discount_amount >= 0
    and total >= 0
    and amount_paid >= 0
  ),
  constraint invoices_tax_rate_chk check (tax_rate >= 0 and tax_rate <= 1)
);

create index if not exists invoices_business_id_idx on public.invoices (business_id);
create index if not exists invoices_customer_id_idx on public.invoices (customer_id);
create index if not exists invoices_job_id_idx on public.invoices (job_id);
create index if not exists invoices_business_status_idx on public.invoices (business_id, status);
create index if not exists invoices_payment_token_idx on public.invoices (payment_token);

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute procedure public.set_updated_at();

-- ── invoice_items ───────────────────────────────────────────────────────────
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint invoice_items_quantity_chk check (quantity > 0),
  constraint invoice_items_unit_price_chk check (unit_price >= 0),
  constraint invoice_items_line_total_chk check (line_total >= 0)
);

create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index if not exists invoice_items_business_id_idx on public.invoice_items (business_id);

drop trigger if exists invoice_items_set_updated_at on public.invoice_items;
create trigger invoice_items_set_updated_at
  before update on public.invoice_items
  for each row execute procedure public.set_updated_at();

-- ── payments ────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  amount numeric(12, 2) not null,
  method text not null default 'card'
    check (method in ('card', 'cash', 'check', 'ach', 'other')),
  status text not null default 'succeeded'
    check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  stripe_payment_intent_id text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payments_amount_chk check (amount > 0)
);

create index if not exists payments_business_id_idx on public.payments (business_id);
create index if not exists payments_invoice_id_idx on public.payments (invoice_id);
create index if not exists payments_business_paid_at_idx on public.payments (business_id, paid_at);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute procedure public.set_updated_at();

-- ── reminders ───────────────────────────────────────────────────────────────
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  schedule_type text not null
    check (schedule_type in (
      'appointment_day_before',
      'appointment_morning_of',
      'invoice_due_soon',
      'invoice_overdue',
      'follow_up',
      'custom'
    )),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'cancelled')),
  channel text not null default 'email'
    check (channel in ('email', 'sms', 'both')),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  message_preview text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reminders_target_chk check (
    job_id is not null or invoice_id is not null or customer_id is not null
  )
);

create index if not exists reminders_business_id_idx on public.reminders (business_id);
create index if not exists reminders_scheduled_for_idx
  on public.reminders (business_id, status, scheduled_for);

drop trigger if exists reminders_set_updated_at on public.reminders;
create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute procedure public.set_updated_at();

-- ── activity_logs ───────────────────────────────────────────────────────────
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  entity_type text not null
    check (entity_type in (
      'business',
      'customer',
      'job',
      'invoice',
      'payment',
      'reminder',
      'member'
    )),
  entity_id uuid,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists activity_logs_business_id_idx
  on public.activity_logs (business_id, created_at desc);
create index if not exists activity_logs_entity_idx
  on public.activity_logs (business_id, entity_type, entity_id);

drop trigger if exists activity_logs_set_updated_at on public.activity_logs;
create trigger activity_logs_set_updated_at
  before update on public.activity_logs
  for each row execute procedure public.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.customers enable row level security;
alter table public.jobs enable row level security;
alter table public.job_photos enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.reminders enable row level security;
alter table public.activity_logs enable row level security;

-- profiles: users manage their own row
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- businesses: members can read; owners/admins can update; authenticated can create
drop policy if exists businesses_select_member on public.businesses;
create policy businesses_select_member on public.businesses
  for select to authenticated
  using (id in (select public.get_user_business_ids()));

drop policy if exists businesses_insert_authenticated on public.businesses;
create policy businesses_insert_authenticated on public.businesses
  for insert to authenticated
  with check (true);

drop policy if exists businesses_update_member on public.businesses;
create policy businesses_update_member on public.businesses
  for update to authenticated
  using (id in (select public.get_user_business_ids()))
  with check (id in (select public.get_user_business_ids()));

-- business_members
drop policy if exists business_members_select_member on public.business_members;
create policy business_members_select_member on public.business_members
  for select to authenticated
  using (business_id in (select public.get_user_business_ids()));

drop policy if exists business_members_insert_member on public.business_members;
create policy business_members_insert_member on public.business_members
  for insert to authenticated
  with check (
    business_id in (select public.get_user_business_ids())
    or user_id = auth.uid()
  );

drop policy if exists business_members_update_member on public.business_members;
create policy business_members_update_member on public.business_members
  for update to authenticated
  using (business_id in (select public.get_user_business_ids()))
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists business_members_delete_member on public.business_members;
create policy business_members_delete_member on public.business_members
  for delete to authenticated
  using (business_id in (select public.get_user_business_ids()));

-- Generic business-scoped CRUD helper pattern for owned tables
-- customers
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated
  using (business_id in (select public.get_user_business_ids()));

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
  for insert to authenticated
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update to authenticated
  using (business_id in (select public.get_user_business_ids()))
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers
  for delete to authenticated
  using (business_id in (select public.get_user_business_ids()));

-- jobs
drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
  for select to authenticated
  using (business_id in (select public.get_user_business_ids()));

drop policy if exists jobs_insert on public.jobs;
create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists jobs_update on public.jobs;
create policy jobs_update on public.jobs
  for update to authenticated
  using (business_id in (select public.get_user_business_ids()))
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists jobs_delete on public.jobs;
create policy jobs_delete on public.jobs
  for delete to authenticated
  using (business_id in (select public.get_user_business_ids()));

-- job_photos
drop policy if exists job_photos_select on public.job_photos;
create policy job_photos_select on public.job_photos
  for select to authenticated
  using (business_id in (select public.get_user_business_ids()));

drop policy if exists job_photos_insert on public.job_photos;
create policy job_photos_insert on public.job_photos
  for insert to authenticated
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists job_photos_update on public.job_photos;
create policy job_photos_update on public.job_photos
  for update to authenticated
  using (business_id in (select public.get_user_business_ids()))
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists job_photos_delete on public.job_photos;
create policy job_photos_delete on public.job_photos
  for delete to authenticated
  using (business_id in (select public.get_user_business_ids()));

-- invoices
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select to authenticated
  using (business_id in (select public.get_user_business_ids()));

drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
  for update to authenticated
  using (business_id in (select public.get_user_business_ids()))
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices
  for delete to authenticated
  using (business_id in (select public.get_user_business_ids()));

-- Public pay-link reads can be added later via a SECURITY DEFINER RPC keyed by payment_token.
-- Do not expose full invoice rows to anon without a narrow token-scoped function.

-- invoice_items
drop policy if exists invoice_items_select on public.invoice_items;
create policy invoice_items_select on public.invoice_items
  for select to authenticated
  using (business_id in (select public.get_user_business_ids()));

drop policy if exists invoice_items_insert on public.invoice_items;
create policy invoice_items_insert on public.invoice_items
  for insert to authenticated
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists invoice_items_update on public.invoice_items;
create policy invoice_items_update on public.invoice_items
  for update to authenticated
  using (business_id in (select public.get_user_business_ids()))
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists invoice_items_delete on public.invoice_items;
create policy invoice_items_delete on public.invoice_items
  for delete to authenticated
  using (business_id in (select public.get_user_business_ids()));

-- payments
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated
  using (business_id in (select public.get_user_business_ids()));

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert to authenticated
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
  for update to authenticated
  using (business_id in (select public.get_user_business_ids()))
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete to authenticated
  using (business_id in (select public.get_user_business_ids()));

-- reminders
drop policy if exists reminders_select on public.reminders;
create policy reminders_select on public.reminders
  for select to authenticated
  using (business_id in (select public.get_user_business_ids()));

drop policy if exists reminders_insert on public.reminders;
create policy reminders_insert on public.reminders
  for insert to authenticated
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists reminders_update on public.reminders;
create policy reminders_update on public.reminders
  for update to authenticated
  using (business_id in (select public.get_user_business_ids()))
  with check (business_id in (select public.get_user_business_ids()));

drop policy if exists reminders_delete on public.reminders;
create policy reminders_delete on public.reminders
  for delete to authenticated
  using (business_id in (select public.get_user_business_ids()));

-- activity_logs (append + read; no client deletes)
drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs
  for select to authenticated
  using (business_id in (select public.get_user_business_ids()));

drop policy if exists activity_logs_insert on public.activity_logs;
create policy activity_logs_insert on public.activity_logs
  for insert to authenticated
  with check (business_id in (select public.get_user_business_ids()));

-- ── Storage bucket notes (optional; apply in Dashboard or Storage SQL) ───────
-- Create private buckets: business-logos, job-photos
--
-- Suggested path conventions:
--   business-logos/{business_id}/logo.{ext}
--   job-photos/{business_id}/{job_id}/{photo_id}.{ext}
--
-- Example policies (Storage API; adjust bucket names as needed):
--
-- insert into storage.buckets (id, name, public) values
--   ('business-logos', 'business-logos', false),
--   ('job-photos', 'job-photos', false)
-- on conflict (id) do nothing;
--
-- create policy "business logos read for members"
-- on storage.objects for select to authenticated
-- using (
--   bucket_id = 'business-logos'
--   and (storage.foldername(name))[1]::uuid in (select public.get_user_business_ids())
-- );
--
-- create policy "business logos write for members"
-- on storage.objects for insert to authenticated
-- with check (
--   bucket_id = 'business-logos'
--   and (storage.foldername(name))[1]::uuid in (select public.get_user_business_ids())
-- );
--
-- create policy "job photos read for members"
-- on storage.objects for select to authenticated
-- using (
--   bucket_id = 'job-photos'
--   and (storage.foldername(name))[1]::uuid in (select public.get_user_business_ids())
-- );
--
-- create policy "job photos write for members"
-- on storage.objects for insert to authenticated
-- with check (
--   bucket_id = 'job-photos'
--   and (storage.foldername(name))[1]::uuid in (select public.get_user_business_ids())
-- );
