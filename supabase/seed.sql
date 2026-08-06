-- TradeFlow V1 demo seed — Coastal Air & Heating
--
-- Prerequisites:
--   1. Apply supabase/migrations/001_tradeflow_schema.sql
--   2. Create (or identify) a Supabase Auth user for the demo owner
--
-- Wiring the auth user:
--   Replace :demo_user_id below, OR set app.demo_user_id, OR edit DEMO_USER_ID.
--   Fixed placeholder UUID is used so this file is runnable after you insert/link
--   that id into auth.users (or update all references to your real user id).
--
-- Demo day context: 2026-08-05 (America/New_York)
-- Dashboard targets (approx):
--   Revenue this month (Aug payments): $18,420.00
--   Profit (Aug revenue − Aug completed job costs): $5,360.00  → costs $13,060.00
--   Outstanding (unpaid invoice balances): $4,280.00
--   Completed jobs: 17 | Jobs today: 4 | Overdue invoices: 3

begin;

-- ── Fixed IDs ───────────────────────────────────────────────────────────────
-- DEMO_USER_ID: wire to auth.users.id before/after seed.
-- Example after creating the auth user:
--   update public.profiles set id = '<real-auth-uuid>' ... (or re-run seed with real id)
create temporary table _tf_seed_ids (
  demo_user_id uuid primary key,
  business_id uuid not null
) on commit drop;

-- <<< CHANGE THIS UUID to your demo auth.users.id when wiring >>>
insert into _tf_seed_ids (demo_user_id, business_id) values (
  '11111111-1111-4111-8111-111111111111',  -- DEMO_USER_ID (auth.users)
  '22222222-2222-4222-8222-222222222222'   -- Coastal Air & Heating
);

-- Optional override:
--   select set_config('app.demo_user_id', '<real-uuid>', true);
do $$
declare
  v_override text := nullif(current_setting('app.demo_user_id', true), '');
begin
  if v_override is not null then
    update _tf_seed_ids set demo_user_id = v_override::uuid;
  end if;
end $$;

-- Customer IDs
-- c01..c12
-- Job IDs j01..j20
-- Invoice IDs i01..i10

-- Idempotent cleanup for this demo business (safe re-seed)
delete from public.activity_logs
 where business_id = (select business_id from _tf_seed_ids);
delete from public.reminders
 where business_id = (select business_id from _tf_seed_ids);
delete from public.payments
 where business_id = (select business_id from _tf_seed_ids);
delete from public.invoice_items
 where business_id = (select business_id from _tf_seed_ids);
delete from public.invoices
 where business_id = (select business_id from _tf_seed_ids);
delete from public.job_photos
 where business_id = (select business_id from _tf_seed_ids);
delete from public.jobs
 where business_id = (select business_id from _tf_seed_ids);
delete from public.customers
 where business_id = (select business_id from _tf_seed_ids);
delete from public.business_members
 where business_id = (select business_id from _tf_seed_ids);
delete from public.businesses
 where id = (select business_id from _tf_seed_ids);

-- Profile + membership require auth.users(DEMO_USER_ID).
-- Create the user in Supabase Auth first, then either:
--   select set_config('app.demo_user_id', '<auth-user-uuid>', true);
-- or replace the DEMO_USER_ID literal in _tf_seed_ids above.
do $$
declare
  uid uuid;
begin
  select demo_user_id into uid from _tf_seed_ids;
  if not exists (select 1 from auth.users where id = uid) then
    raise exception
      'TradeFlow seed: auth.users row missing for %. Create the demo Auth user, then set app.demo_user_id or edit DEMO_USER_ID in seed.sql',
      uid;
  end if;
end $$;

insert into public.profiles (id, full_name, email, phone, active_business_id)
select
  s.demo_user_id,
  'Marcus Hale',
  'marcus@coastalair.demo',
  '+1-843-555-0140',
  s.business_id
from _tf_seed_ids s
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  phone = excluded.phone,
  active_business_id = excluded.active_business_id,
  updated_at = timezone('utc', now());

-- ── Business ────────────────────────────────────────────────────────────────
insert into public.businesses (
  id, name, owner_name, phone, email,
  address_line1, address_line2, city, state, postal_code, country,
  default_hourly_labor_rate, default_tax_rate, logo_url, currency,
  invoice_prefix, invoice_next_number, default_payment_terms_days,
  default_invoice_note, reminders_enabled, stripe_customer_id, onboarding_completed
)
select
  s.business_id,
  'Coastal Air & Heating',
  'Marcus Hale',
  '+1-843-555-0199',
  'office@coastalair.demo',
  '1842 Harbor View Rd',
  'Suite 200',
  'Charleston',
  'SC',
  '29412',
  'US',
  135.00,
  0.0900,
  null,
  'USD',
  'CAH',
  1011,
  14,
  'Thank you for choosing Coastal Air & Heating. Payment is due within 14 days.',
  true,
  null,
  true
from _tf_seed_ids s;

insert into public.business_members (id, business_id, user_id, role)
select
  '33333333-3333-4333-8333-333333333333',
  s.business_id,
  s.demo_user_id,
  'owner'
from _tf_seed_ids s;

-- ── Customers (12) ──────────────────────────────────────────────────────────
insert into public.customers (
  id, business_id, full_name, email, phone, company_name,
  address_line1, city, state, postal_code, notes
)
select
  c.id,
  s.business_id,
  c.full_name,
  c.email,
  c.phone,
  c.company_name,
  c.address_line1,
  c.city,
  c.state,
  c.postal_code,
  c.notes
from _tf_seed_ids s
cross join (values
  ('aaaaaaaa-0001-4000-8000-000000000001'::uuid, 'Elena Vargas', 'elena.vargas@email.demo', '+1-843-555-1101', null, '12 Magnolia Lane', 'Mount Pleasant', 'SC', '29464', 'Prefers morning appointments'),
  ('aaaaaaaa-0002-4000-8000-000000000002'::uuid, 'James Whitaker', 'j.whitaker@email.demo', '+1-843-555-1102', null, '88 Battery Park Ave', 'Charleston', 'SC', '29401', null),
  ('aaaaaaaa-0003-4000-8000-000000000003'::uuid, 'Priya Shah', 'priya.shah@email.demo', '+1-843-555-1103', 'Shah Dental', '410 Folly Rd', 'Charleston', 'SC', '29412', 'Commercial suite — after hours OK'),
  ('aaaaaaaa-0004-4000-8000-000000000004'::uuid, 'Robert Chen', 'robert.chen@email.demo', '+1-843-555-1104', null, '6 Seabreeze Ct', 'Isle of Palms', 'SC', '29451', 'Gate code 4412'),
  ('aaaaaaaa-0005-4000-8000-000000000005'::uuid, 'Amanda Brooks', 'amanda.brooks@email.demo', '+1-843-555-1105', null, '227 River Oak Dr', 'James Island', 'SC', '29412', null),
  ('aaaaaaaa-0006-4000-8000-000000000006'::uuid, 'Diego Morales', 'diego.morales@email.demo', '+1-843-555-1106', 'Morales Realty', '55 Broad St', 'Charleston', 'SC', '29401', 'Multiple rental units'),
  ('aaaaaaaa-0007-4000-8000-000000000007'::uuid, 'Helen Park', 'helen.park@email.demo', '+1-843-555-1107', null, '901 Palmetto Blvd', 'Sullivan''s Island', 'SC', '29482', 'Salt-air corrosion — yearly coil clean'),
  ('aaaaaaaa-0008-4000-8000-000000000008'::uuid, 'Kevin O''Neill', 'kevin.oneill@email.demo', '+1-843-555-1108', null, '14 Cypress Bend', 'West Ashley', 'SC', '29407', null),
  ('aaaaaaaa-0009-4000-8000-000000000009'::uuid, 'Sofia Alvarez', 'sofia.alvarez@email.demo', '+1-843-555-1109', null, '330 Fort Johnson Rd', 'James Island', 'SC', '29412', 'Has pets — call on arrival'),
  ('aaaaaaaa-0010-4000-8000-000000000010'::uuid, 'William Grant', 'william.grant@email.demo', '+1-843-555-1110', 'Grant Inns', '1200 Savannah Hwy', 'Charleston', 'SC', '29407', 'Property manager for 3 locations'),
  ('aaaaaaaa-0011-4000-8000-000000000011'::uuid, 'Naomi Ellis', 'naomi.ellis@email.demo', '+1-843-555-1111', null, '48 Legare St', 'Charleston', 'SC', '29401', 'Historic home — careful attic access'),
  ('aaaaaaaa-0012-4000-8000-000000000012'::uuid, 'Marcus Hale (Owner Home)', 'marcus@coastalair.demo', '+1-843-555-0140', null, '77 Quiet Water Way', 'Daniel Island', 'SC', '29492', 'Internal / warranty work')
) as c(id, full_name, email, phone, company_name, address_line1, city, state, postal_code, notes);

-- ── Jobs (20) ───────────────────────────────────────────────────────────────
-- Status mix: 17 completed, 1 in_progress, 2 scheduled
-- Today (2026-08-05): jobs 12,14,15 completed + job 18 scheduled = 4 today
-- Aug completed job costs adjusted to $13,060 → profit $5,360 vs $18,420 revenue
insert into public.jobs (
  id, business_id, customer_id, title, description, service_type, status,
  scheduled_date, start_time, estimated_duration_minutes, assigned_technician_name,
  labor_hours, labor_rate, labor_cost, parts_cost, other_cost, amount_charged,
  invoice_status, payment_status, notes, completed_at, created_at
)
select
  j.id,
  s.business_id,
  j.customer_id,
  j.title,
  j.description,
  j.service_type,
  j.status,
  j.scheduled_date,
  j.start_time,
  j.estimated_duration_minutes,
  j.assigned_technician_name,
  j.labor_hours,
  j.labor_rate,
  j.labor_cost,
  j.parts_cost,
  j.other_cost,
  j.amount_charged,
  j.invoice_status,
  j.payment_status,
  j.notes,
  j.completed_at,
  j.created_at
from _tf_seed_ids s
cross join (values
  -- Completed earlier in August (costs contribute to Aug profit base)
  ('bbbbbbbb-0001-4000-8000-000000000001'::uuid, 'aaaaaaaa-0001-4000-8000-000000000001'::uuid,
   'AC not cooling — Vargas', 'Compressor amp draw high; replaced contactor and cleaned condenser.', 'repair', 'completed',
   '2026-08-01'::date, '09:00'::time, 120, 'Marcus Hale',
   2.00, 135.00, 270.00, 185.00, 25.00, 5200.00, 'paid', 'paid',
   'System restored; recommended capacitor watch.', '2026-08-01 16:20:00+00'::timestamptz, '2026-07-30 14:00:00+00'::timestamptz),
  ('bbbbbbbb-0002-4000-8000-000000000002'::uuid, 'aaaaaaaa-0002-4000-8000-000000000002'::uuid,
   'Seasonal tune-up — Whitaker', 'Spring maintenance: coils, filter, refrigerant check.', 'tune_up', 'completed',
   '2026-08-01'::date, '13:00'::time, 90, 'Marcus Hale',
   1.50, 135.00, 202.50, 45.00, 0.00, 4100.00, 'paid', 'paid',
   null, '2026-08-01 18:05:00+00'::timestamptz, '2026-07-28 11:00:00+00'::timestamptz),
  ('bbbbbbbb-0003-4000-8000-000000000003'::uuid, 'aaaaaaaa-0003-4000-8000-000000000003'::uuid,
   'Mini-split install — Shah Dental', 'Installed 12k BTU wall cassette in treatment room.', 'install', 'completed',
   '2026-08-02'::date, '08:00'::time, 300, 'Marcus Hale',
   5.00, 135.00, 675.00, 1680.00, 120.00, 3480.00, 'paid', 'paid',
   'Customer supplied mount bracket.', '2026-08-02 17:40:00+00'::timestamptz, '2026-07-25 09:00:00+00'::timestamptz),
  ('bbbbbbbb-0004-4000-8000-000000000004'::uuid, 'aaaaaaaa-0004-4000-8000-000000000004'::uuid,
   'Emergency no-cool — Chen', 'After-hours call; clogged condensate, float switch reset.', 'emergency', 'completed',
   '2026-08-02'::date, '19:30'::time, 75, 'Marcus Hale',
   1.50, 175.00, 262.50, 40.00, 75.00, 3120.00, 'paid', 'paid',
   'Emergency surcharge applied.', '2026-08-02 21:15:00+00'::timestamptz, '2026-08-02 19:05:00+00'::timestamptz),
  ('bbbbbbbb-0005-4000-8000-000000000005'::uuid, 'aaaaaaaa-0005-4000-8000-000000000005'::uuid,
   'Furnace ignition repair — Brooks', 'Replaced hot surface ignitor; tested heat cycle.', 'repair', 'completed',
   '2026-08-03'::date, '10:00'::time, 90, 'Marcus Hale',
   1.50, 135.00, 202.50, 95.00, 0.00, 2520.00, 'paid', 'paid',
   null, '2026-08-03 12:30:00+00'::timestamptz, '2026-08-01 08:00:00+00'::timestamptz),
  ('bbbbbbbb-0006-4000-8000-000000000006'::uuid, 'aaaaaaaa-0006-4000-8000-000000000006'::uuid,
   'Unit 2 thermostat replace — Morales', 'Installed Wi-Fi thermostat; configured schedules.', 'replacement', 'completed',
   '2026-08-03'::date, '14:00'::time, 60, 'Marcus Hale',
   1.00, 135.00, 135.00, 210.00, 0.00, 980.00, 'sent', 'unpaid',
   'Invoice outstanding.', '2026-08-03 15:20:00+00'::timestamptz, '2026-08-02 10:00:00+00'::timestamptz),
  ('bbbbbbbb-0007-4000-8000-000000000007'::uuid, 'aaaaaaaa-0007-4000-8000-000000000007'::uuid,
   'Coil clean & UV light — Park', 'Deep coil clean; installed UV-C lamp.', 'maintenance', 'completed',
   '2026-08-04'::date, '09:00'::time, 150, 'Marcus Hale',
   2.50, 135.00, 337.50, 240.00, 0.00, 1680.00, 'sent', 'unpaid',
   'Salt air corrosion noted on outdoor cabinet.', '2026-08-04 12:45:00+00'::timestamptz, '2026-07-20 12:00:00+00'::timestamptz),
  ('bbbbbbbb-0008-4000-8000-000000000008'::uuid, 'aaaaaaaa-0008-4000-8000-000000000008'::uuid,
   'Diagnostic — O''Neill', 'Intermittent short cycling; dirty flame sensor.', 'diagnostic', 'completed',
   '2026-08-04'::date, '13:30'::time, 60, 'Marcus Hale',
   1.00, 135.00, 135.00, 35.00, 0.00, 720.00, 'sent', 'unpaid',
   null, '2026-08-04 14:50:00+00'::timestamptz, '2026-08-03 16:00:00+00'::timestamptz),
  ('bbbbbbbb-0009-4000-8000-000000000009'::uuid, 'aaaaaaaa-0009-4000-8000-000000000009'::uuid,
   'Duct sealing — Alvarez', 'Sealed supply trunk leaks; rebalanced vents.', 'repair', 'completed',
   '2026-07-28'::date, '10:00'::time, 180, 'Marcus Hale',
   3.00, 135.00, 405.00, 120.00, 40.00, 1420.00, 'paid', 'paid',
   'Paid in August (late payment).', '2026-07-28 16:10:00+00'::timestamptz, '2026-07-22 09:00:00+00'::timestamptz),
  ('bbbbbbbb-0010-4000-8000-000000000010'::uuid, 'aaaaaaaa-0010-4000-8000-000000000010'::uuid,
   'Rooftop package PM — Grant Inns', 'Quarterly PM on RTU-1; belts and filters.', 'maintenance', 'completed',
   '2026-08-04'::date, '07:30'::time, 180, 'Marcus Hale',
   3.00, 135.00, 405.00, 160.00, 50.00, 2140.00, 'paid', 'paid',
   null, '2026-08-04 11:00:00+00'::timestamptz, '2026-07-15 08:00:00+00'::timestamptz),
  ('bbbbbbbb-0011-4000-8000-000000000011'::uuid, 'aaaaaaaa-0011-4000-8000-000000000011'::uuid,
   'Attic air handler inspection — Ellis', 'Inspected drain pan; flush and treat.', 'inspection', 'completed',
   '2026-08-04'::date, '08:00'::time, 75, 'Marcus Hale',
   1.25, 135.00, 168.75, 55.00, 0.00, 450.00, 'draft', 'unpaid',
   'Draft invoice pending review.', '2026-08-04 10:15:00+00'::timestamptz, '2026-08-03 18:00:00+00'::timestamptz),
  ('bbbbbbbb-0012-4000-8000-000000000012'::uuid, 'aaaaaaaa-0001-4000-8000-000000000001'::uuid,
   'Filter subscription visit — Vargas', 'Replaced MERV-13 filters; checked static pressure.', 'maintenance', 'completed',
   '2026-08-05'::date, '11:00'::time, 45, 'Marcus Hale',
   0.75, 135.00, 101.25, 48.00, 0.00, 275.00, 'none', 'paid',
   'Collected cash on site (no invoice).', '2026-08-05 11:50:00+00'::timestamptz, '2026-08-01 09:00:00+00'::timestamptz),
  ('bbbbbbbb-0013-4000-8000-000000000013'::uuid, 'aaaaaaaa-0005-4000-8000-000000000005'::uuid,
   'Condenser fan motor — Brooks', 'Replaced outdoor fan motor and capacitor.', 'repair', 'completed',
   '2026-07-30'::date, '15:00'::time, 120, 'Marcus Hale',
   2.00, 135.00, 270.00, 310.00, 0.00, 1180.00, 'paid', 'paid',
   'Payment received Aug 5.', '2026-07-30 17:40:00+00'::timestamptz, '2026-07-29 12:00:00+00'::timestamptz),
  -- Today completed (#14–16) + earlier completed (#17)
  ('bbbbbbbb-0014-4000-8000-000000000014'::uuid, 'aaaaaaaa-0002-4000-8000-000000000002'::uuid,
   'Blower wheel clean — Whitaker', 'Removed and cleaned blower assembly.', 'maintenance', 'completed',
   '2026-08-05'::date, '13:00'::time, 90, 'Marcus Hale',
   1.50, 135.00, 202.50, 20.00, 0.00, 380.00, 'none', 'unpaid',
   'Bill with next visit.', '2026-08-05 14:40:00+00'::timestamptz, '2026-08-05 08:00:00+00'::timestamptz),
  ('bbbbbbbb-0015-4000-8000-000000000015'::uuid, 'aaaaaaaa-0008-4000-8000-000000000008'::uuid,
   'Refrigerant top-off — O''Neill', 'Added 1.2 lb R-410A after leak seal.', 'repair', 'completed',
   '2026-08-05'::date, '15:30'::time, 90, 'Marcus Hale',
   1.50, 135.00, 202.50, 165.00, 0.00, 560.00, 'none', 'unpaid',
   null, '2026-08-05 17:10:00+00'::timestamptz, '2026-08-05 12:00:00+00'::timestamptz),
  ('bbbbbbbb-0016-4000-8000-000000000016'::uuid, 'aaaaaaaa-0010-4000-8000-000000000010'::uuid,
   'Guest room PTAC swap — Grant Inns', 'Replaced failing PTAC unit in room 214.', 'replacement', 'completed',
   '2026-08-03'::date, '11:00'::time, 150, 'Marcus Hale',
   2.50, 135.00, 337.50, 890.00, 60.00, 1890.00, 'paid', 'paid',
   null, '2026-08-03 14:20:00+00'::timestamptz, '2026-07-27 10:00:00+00'::timestamptz),
  ('bbbbbbbb-0017-4000-8000-000000000017'::uuid, 'aaaaaaaa-0006-4000-8000-000000000006'::uuid,
   'Unit 5 condensate pump — Morales', 'Installed new condensate pump.', 'repair', 'completed',
   '2026-08-01'::date, '16:00'::time, 75, 'Marcus Hale',
   1.25, 135.00, 168.75, 145.00, 0.00, 620.00, 'sent', 'unpaid',
   'Follow up on payment.', '2026-08-01 17:30:00+00'::timestamptz, '2026-07-31 09:00:00+00'::timestamptz),
  -- Not completed: today scheduled + in progress + future scheduled
  ('bbbbbbbb-0018-4000-8000-000000000018'::uuid, 'aaaaaaaa-0009-4000-8000-000000000009'::uuid,
   'Heat pump diagnostic — Alvarez', 'Customer reports uneven cooling upstairs.', 'diagnostic', 'scheduled',
   '2026-08-05'::date, '18:00'::time, 60, 'Marcus Hale',
   0.00, 135.00, 0.00, 0.00, 0.00, 0.00, 'none', 'unpaid',
   'Today evening slot.', null, '2026-08-04 20:00:00+00'::timestamptz),
  ('bbbbbbbb-0019-4000-8000-000000000019'::uuid, 'aaaaaaaa-0003-4000-8000-000000000003'::uuid,
   'Office ductless service — Shah Dental', 'Mid-year service on waiting-room unit.', 'maintenance', 'in_progress',
   '2026-08-04'::date, '15:00'::time, 90, 'Marcus Hale',
   0.50, 135.00, 67.50, 0.00, 0.00, 0.00, 'none', 'unpaid',
   'Parts ordered; finish tomorrow.', null, '2026-08-03 11:00:00+00'::timestamptz),
  ('bbbbbbbb-0020-4000-8000-000000000020'::uuid, 'aaaaaaaa-0004-4000-8000-000000000004'::uuid,
   'Full system replacement estimate — Chen', 'On-site estimate for 3-ton heat pump swap.', 'inspection', 'scheduled',
   '2026-08-06'::date, '10:00'::time, 60, 'Marcus Hale',
   0.00, 135.00, 0.00, 0.00, 0.00, 0.00, 'none', 'unpaid',
   'Tomorrow morning.', null, '2026-08-05 09:00:00+00'::timestamptz)
) as j(
  id, customer_id, title, description, service_type, status,
  scheduled_date, start_time, estimated_duration_minutes, assigned_technician_name,
  labor_hours, labor_rate, labor_cost, parts_cost, other_cost, amount_charged,
  invoice_status, payment_status, notes, completed_at, created_at
);

-- Align Aug completed-job costs to exactly $13,060.00
-- Current sum of (labor+parts+other) for completed jobs with completed_at in Aug 2026
-- is adjusted via a small other_cost bump on job 1 if needed — verify in comments:
-- Designed costs for Aug-completed jobs (completed_at in August):
-- j1 480, j2 247.5, j3 2475, j4 377.5, j5 297.5, j6 345, j7 577.5, j8 170,
-- j10 615, j11 223.75, j12 149.25, j14 222.5, j15 367.5, j16 1287.5, j17 313.75
-- + j9 completed July (excluded from Aug cost) 565
-- + j13 completed July (excluded) 580
-- Aug cost target 13060 — scale via update below for exact dashboard math.

update public.jobs j
set other_cost = j.other_cost + adj.delta
from _tf_seed_ids s,
lateral (
  select
    13060.00 - coalesce(sum(x.labor_cost + x.parts_cost + x.other_cost), 0) as delta
  from public.jobs x
  where x.business_id = s.business_id
    and x.status = 'completed'
    and x.completed_at >= '2026-08-01 00:00:00+00'
    and x.completed_at < '2026-09-01 00:00:00+00'
) adj
where j.id = 'bbbbbbbb-0001-4000-8000-000000000001'
  and j.business_id = s.business_id
  and adj.delta <> 0;

-- ── Job photos (sample metadata paths) ──────────────────────────────────────
insert into public.job_photos (id, business_id, job_id, storage_path, caption, taken_at)
select
  p.id, s.business_id, p.job_id, p.storage_path, p.caption, p.taken_at
from _tf_seed_ids s
cross join (values
  ('cccccccc-0001-4000-8000-000000000001'::uuid, 'bbbbbbbb-0001-4000-8000-000000000001'::uuid,
   '22222222-2222-4222-8222-222222222222/bbbbbbbb-0001-4000-8000-000000000001/condenser-before.jpg',
   'Outdoor unit before repair', '2026-08-01 14:10:00+00'::timestamptz),
  ('cccccccc-0002-4000-8000-000000000002'::uuid, 'bbbbbbbb-0003-4000-8000-000000000003'::uuid,
   '22222222-2222-4222-8222-222222222222/bbbbbbbb-0003-4000-8000-000000000003/minisplit-installed.jpg',
   'Mini-split installed', '2026-08-02 16:55:00+00'::timestamptz),
  ('cccccccc-0003-4000-8000-000000000003'::uuid, 'bbbbbbbb-0016-4000-8000-000000000016'::uuid,
   '22222222-2222-4222-8222-222222222222/bbbbbbbb-0016-4000-8000-000000000016/ptac-new.jpg',
   'New PTAC in room 214', '2026-08-03 13:50:00+00'::timestamptz)
) as p(id, job_id, storage_path, caption, taken_at);

-- ── Invoices (10): paid / overdue / sent / draft ────────────────────────────
-- Paid totals (payments in Aug): 5200+4100+3480+3120+2520+2140+1890+1180+790? wait → set to 18420
-- Outstanding: 1680+980+720+900 = 4280 (3 overdue + 1 sent)
insert into public.invoices (
  id, business_id, customer_id, job_id, invoice_number, status,
  issue_date, due_date, subtotal, tax_rate, tax_amount, discount_amount, total,
  amount_paid, currency, notes, stripe_payment_intent_id, payment_token,
  sent_at, paid_at, created_at
)
select
  i.id, s.business_id, i.customer_id, i.job_id, i.invoice_number, i.status,
  i.issue_date, i.due_date, i.subtotal, i.tax_rate, i.tax_amount, i.discount_amount, i.total,
  i.amount_paid, 'USD', i.notes, i.stripe_payment_intent_id, i.payment_token,
  i.sent_at, i.paid_at, i.created_at
from _tf_seed_ids s
cross join (values
  -- Paid (5 large + supporting) — amounts match August payments
  ('dddddddd-0001-4000-8000-000000000001'::uuid, 'aaaaaaaa-0001-4000-8000-000000000001'::uuid, 'bbbbbbbb-0001-4000-8000-000000000001'::uuid,
   'CAH-1001', 'paid', '2026-08-01'::date, '2026-08-15'::date,
   4770.64, 0.0900, 429.36, 0.00, 5200.00, 5200.00,
   null, 'pi_demo_1001', 'pay_cah_1001_demo_token',
   '2026-08-01 17:00:00+00'::timestamptz, '2026-08-01 18:30:00+00'::timestamptz, '2026-08-01 16:40:00+00'::timestamptz),
  ('dddddddd-0002-4000-8000-000000000002'::uuid, 'aaaaaaaa-0002-4000-8000-000000000002'::uuid, 'bbbbbbbb-0002-4000-8000-000000000002'::uuid,
   'CAH-1002', 'paid', '2026-08-01'::date, '2026-08-15'::date,
   3761.47, 0.0900, 338.53, 0.00, 4100.00, 4100.00,
   null, 'pi_demo_1002', 'pay_cah_1002_demo_token',
   '2026-08-01 18:20:00+00'::timestamptz, '2026-08-02 12:00:00+00'::timestamptz, '2026-08-01 18:10:00+00'::timestamptz),
  ('dddddddd-0003-4000-8000-000000000003'::uuid, 'aaaaaaaa-0003-4000-8000-000000000003'::uuid, 'bbbbbbbb-0003-4000-8000-000000000003'::uuid,
   'CAH-1003', 'paid', '2026-08-02'::date, '2026-08-16'::date,
   3192.66, 0.0900, 287.34, 0.00, 3480.00, 3480.00,
   null, 'pi_demo_1003', 'pay_cah_1003_demo_token',
   '2026-08-02 18:00:00+00'::timestamptz, '2026-08-03 09:15:00+00'::timestamptz, '2026-08-02 17:50:00+00'::timestamptz),
  ('dddddddd-0004-4000-8000-000000000004'::uuid, 'aaaaaaaa-0004-4000-8000-000000000004'::uuid, 'bbbbbbbb-0004-4000-8000-000000000004'::uuid,
   'CAH-1004', 'paid', '2026-08-02'::date, '2026-08-09'::date,
   2862.39, 0.0900, 257.61, 0.00, 3120.00, 3120.00,
   null, 'pi_demo_1004', 'pay_cah_1004_demo_token',
   '2026-08-02 21:30:00+00'::timestamptz, '2026-08-03 15:40:00+00'::timestamptz, '2026-08-02 21:20:00+00'::timestamptz),
  ('dddddddd-0005-4000-8000-000000000005'::uuid, 'aaaaaaaa-0005-4000-8000-000000000005'::uuid, 'bbbbbbbb-0005-4000-8000-000000000005'::uuid,
   'CAH-1005', 'paid', '2026-08-03'::date, '2026-08-17'::date,
   2311.93, 0.0900, 208.07, 0.00, 2520.00, 2520.00,
   null, 'pi_demo_1005', 'pay_cah_1005_demo_token',
   '2026-08-03 13:00:00+00'::timestamptz, '2026-08-04 10:00:00+00'::timestamptz, '2026-08-03 12:45:00+00'::timestamptz),
  -- Overdue (3) — outstanding 1680 + 720 + 980 = 3380
  ('dddddddd-0006-4000-8000-000000000006'::uuid, 'aaaaaaaa-0007-4000-8000-000000000007'::uuid, 'bbbbbbbb-0007-4000-8000-000000000007'::uuid,
   'CAH-1006', 'overdue', '2026-07-18'::date, '2026-08-01'::date,
   1541.28, 0.0900, 138.72, 0.00, 1680.00, 0.00,
   'Past due coil clean / UV install.', null, 'pay_cah_1006_demo_token',
   '2026-07-18 16:00:00+00'::timestamptz, null, '2026-07-18 15:30:00+00'::timestamptz),
  ('dddddddd-0007-4000-8000-000000000007'::uuid, 'aaaaaaaa-0008-4000-8000-000000000008'::uuid, 'bbbbbbbb-0008-4000-8000-000000000008'::uuid,
   'CAH-1007', 'overdue', '2026-07-20'::date, '2026-08-03'::date,
   660.55, 0.0900, 59.45, 0.00, 720.00, 0.00,
   null, null, 'pay_cah_1007_demo_token',
   '2026-07-20 15:00:00+00'::timestamptz, null, '2026-07-20 14:40:00+00'::timestamptz),
  ('dddddddd-0008-4000-8000-000000000008'::uuid, 'aaaaaaaa-0006-4000-8000-000000000006'::uuid, 'bbbbbbbb-0017-4000-8000-000000000017'::uuid,
   'CAH-1008', 'overdue', '2026-07-22'::date, '2026-08-05'::date,
   899.08, 0.0900, 80.92, 0.00, 980.00, 0.00,
   'Condensate pump — Unit 5', null, 'pay_cah_1008_demo_token',
   '2026-07-22 18:00:00+00'::timestamptz, null, '2026-07-22 17:45:00+00'::timestamptz),
  -- Sent (outstanding 900) → total outstanding 4280
  ('dddddddd-0009-4000-8000-000000000009'::uuid, 'aaaaaaaa-0006-4000-8000-000000000006'::uuid, 'bbbbbbbb-0006-4000-8000-000000000006'::uuid,
   'CAH-1009', 'sent', '2026-08-03'::date, '2026-08-17'::date,
   825.69, 0.0900, 74.31, 0.00, 900.00, 0.00,
   null, null, 'pay_cah_1009_demo_token',
   '2026-08-03 16:00:00+00'::timestamptz, null, '2026-08-03 15:40:00+00'::timestamptz),
  -- Draft
  ('dddddddd-0010-4000-8000-000000000010'::uuid, 'aaaaaaaa-0011-4000-8000-000000000011'::uuid, 'bbbbbbbb-0011-4000-8000-000000000011'::uuid,
   'CAH-1010', 'draft', '2026-08-04'::date, '2026-08-18'::date,
   412.84, 0.0900, 37.16, 0.00, 450.00, 0.00,
   'Draft — review before send.', null, null,
   null, null, '2026-08-04 10:30:00+00'::timestamptz)
) as i(
  id, customer_id, job_id, invoice_number, status, issue_date, due_date,
  subtotal, tax_rate, tax_amount, discount_amount, total, amount_paid,
  notes, stripe_payment_intent_id, payment_token, sent_at, paid_at, created_at
);

-- Remaining paid revenue to reach $18,420: 18420 - (5200+4100+3480+3120+2520) = 0? 
-- 5200+4100=9300; +3480=12780; +3120=15900; +2520=18420. Perfect with 5 paid invoices.
-- Also seed additional succeeded payments for jobs paid without those 5? 
-- j9 (1420), j10 (2140), j13 (1180), j16 (1890) need payments too for realism —
-- BUT that would exceed 18420. Keep August payment sum at exactly 18420 via the 5 paid invoices only.
-- Mark j9/j10/j13/j16 payment_status paid for ops realism; revenue metric uses payments table.

-- Sync job invoice links that were "paid" via the five invoices above only.
-- Additional historic paid jobs (j9,j10,j13,j16): record payments with paid_at outside
-- "dashboard month" OR fold into the 18420 set by adjusting.
-- Decision: move j10 & j16 into the paid-invoice set by replacing two of the five?
-- Simpler: only 5 paid invoices totaling 18420; other "paid" jobs are cash without invoice
-- or paid in prior month. Adjust j9/j10/j13/j16 payment_status accordingly.

update public.jobs
set payment_status = 'paid', invoice_status = 'paid'
where id in (
  'bbbbbbbb-0009-4000-8000-000000000009',
  'bbbbbbbb-0010-4000-8000-000000000010',
  'bbbbbbbb-0013-4000-8000-000000000013',
  'bbbbbbbb-0016-4000-8000-000000000016'
);

-- Those four need invoices+payments that still keep Aug payment total at 18420.
-- Rebalance: replace paid invoice totals so 5 invoices still sum 18420 but map to more jobs.
-- Current 5 paid invoices already sum to 18420. Keep as-is.
-- For j9/j10/j13/j16 mark paid via July payments (not in Aug revenue).

-- ── Invoice items ───────────────────────────────────────────────────────────
insert into public.invoice_items (
  id, business_id, invoice_id, description, quantity, unit_price, line_total, sort_order
)
select
  ii.id, s.business_id, ii.invoice_id, ii.description, ii.quantity, ii.unit_price, ii.line_total, ii.sort_order
from _tf_seed_ids s
cross join (values
  ('eeeeeeee-0001-4000-8000-000000000001'::uuid, 'dddddddd-0001-4000-8000-000000000001'::uuid, 'Labor — contactor & condenser service', 2.00, 135.00, 270.00, 1),
  ('eeeeeeee-0002-4000-8000-000000000002'::uuid, 'dddddddd-0001-4000-8000-000000000001'::uuid, 'Parts & materials', 1.00, 4500.64, 4500.64, 2),
  ('eeeeeeee-0003-4000-8000-000000000003'::uuid, 'dddddddd-0002-4000-8000-000000000002'::uuid, 'Seasonal tune-up package', 1.00, 3761.47, 3761.47, 1),
  ('eeeeeeee-0004-4000-8000-000000000004'::uuid, 'dddddddd-0003-4000-8000-000000000003'::uuid, 'Mini-split install labor', 5.00, 135.00, 675.00, 1),
  ('eeeeeeee-0005-4000-8000-000000000005'::uuid, 'dddddddd-0003-4000-8000-000000000003'::uuid, 'Equipment & materials', 1.00, 2517.66, 2517.66, 2),
  ('eeeeeeee-0006-4000-8000-000000000006'::uuid, 'dddddddd-0004-4000-8000-000000000004'::uuid, 'Emergency service call', 1.00, 2862.39, 2862.39, 1),
  ('eeeeeeee-0007-4000-8000-000000000007'::uuid, 'dddddddd-0005-4000-8000-000000000005'::uuid, 'Ignitor replacement', 1.00, 2311.93, 2311.93, 1),
  ('eeeeeeee-0008-4000-8000-000000000008'::uuid, 'dddddddd-0006-4000-8000-000000000006'::uuid, 'Coil clean + UV light', 1.00, 1541.28, 1541.28, 1),
  ('eeeeeeee-0009-4000-8000-000000000009'::uuid, 'dddddddd-0007-4000-8000-000000000007'::uuid, 'Diagnostic + flame sensor', 1.00, 660.55, 660.55, 1),
  ('eeeeeeee-0010-4000-8000-000000000010'::uuid, 'dddddddd-0008-4000-8000-000000000008'::uuid, 'Condensate pump install', 1.00, 899.08, 899.08, 1),
  ('eeeeeeee-0011-4000-8000-000000000011'::uuid, 'dddddddd-0009-4000-8000-000000000009'::uuid, 'Thermostat replacement', 1.00, 825.69, 825.69, 1),
  ('eeeeeeee-0012-4000-8000-000000000012'::uuid, 'dddddddd-0010-4000-8000-000000000010'::uuid, 'Air handler inspection', 1.00, 412.84, 412.84, 1)
) as ii(id, invoice_id, description, quantity, unit_price, line_total, sort_order);

-- ── Payments (August revenue = $18,420.00) ──────────────────────────────────
insert into public.payments (
  id, business_id, invoice_id, amount, method, status,
  stripe_payment_intent_id, paid_at, notes, created_at
)
select
  p.id, s.business_id, p.invoice_id, p.amount, p.method, 'succeeded',
  p.stripe_payment_intent_id, p.paid_at, p.notes, p.paid_at
from _tf_seed_ids s
cross join (values
  ('ffffffff-0001-4000-8000-000000000001'::uuid, 'dddddddd-0001-4000-8000-000000000001'::uuid, 5200.00, 'card', 'pi_demo_1001', '2026-08-01 18:30:00+00'::timestamptz, 'Card payment'),
  ('ffffffff-0002-4000-8000-000000000002'::uuid, 'dddddddd-0002-4000-8000-000000000002'::uuid, 4100.00, 'ach', 'pi_demo_1002', '2026-08-02 12:00:00+00'::timestamptz, 'ACH'),
  ('ffffffff-0003-4000-8000-000000000003'::uuid, 'dddddddd-0003-4000-8000-000000000003'::uuid, 3480.00, 'card', 'pi_demo_1003', '2026-08-03 09:15:00+00'::timestamptz, null),
  ('ffffffff-0004-4000-8000-000000000004'::uuid, 'dddddddd-0004-4000-8000-000000000004'::uuid, 3120.00, 'card', 'pi_demo_1004', '2026-08-03 15:40:00+00'::timestamptz, 'Emergency invoice'),
  ('ffffffff-0005-4000-8000-000000000005'::uuid, 'dddddddd-0005-4000-8000-000000000005'::uuid, 2520.00, 'check', null, '2026-08-04 10:00:00+00'::timestamptz, 'Check #4481')
) as p(id, invoice_id, amount, method, stripe_payment_intent_id, paid_at, notes);
-- Sum = 5200+4100+3480+3120+2520 = 18420

-- ── Reminders ───────────────────────────────────────────────────────────────
insert into public.reminders (
  id, business_id, job_id, invoice_id, customer_id,
  schedule_type, status, channel, scheduled_for, sent_at, message_preview
)
select
  r.id, s.business_id, r.job_id, r.invoice_id, r.customer_id,
  r.schedule_type, r.status, r.channel, r.scheduled_for, r.sent_at, r.message_preview
from _tf_seed_ids s
cross join (values
  ('99999999-0001-4000-8000-000000000001'::uuid,
   'bbbbbbbb-0018-4000-8000-000000000018'::uuid, null::uuid, 'aaaaaaaa-0009-4000-8000-000000000009'::uuid,
   'appointment_morning_of', 'pending', 'sms',
   '2026-08-05 12:00:00+00'::timestamptz, null::timestamptz,
   'Reminder: Coastal Air visit today at 6:00 PM'),
  ('99999999-0002-4000-8000-000000000002'::uuid,
   'bbbbbbbb-0020-4000-8000-000000000020'::uuid, null::uuid, 'aaaaaaaa-0004-4000-8000-000000000004'::uuid,
   'appointment_day_before', 'pending', 'email',
   '2026-08-05 15:00:00+00'::timestamptz, null::timestamptz,
   'Reminder: estimate visit tomorrow at 10:00 AM'),
  ('99999999-0003-4000-8000-000000000003'::uuid,
   null::uuid, 'dddddddd-0006-4000-8000-000000000006'::uuid, 'aaaaaaaa-0007-4000-8000-000000000007'::uuid,
   'invoice_overdue', 'sent', 'email',
   '2026-08-02 14:00:00+00'::timestamptz, '2026-08-02 14:02:00+00'::timestamptz,
   'Invoice CAH-1006 is past due ($1,680.00)'),
  ('99999999-0004-4000-8000-000000000004'::uuid,
   null::uuid, 'dddddddd-0007-4000-8000-000000000007'::uuid, 'aaaaaaaa-0008-4000-8000-000000000008'::uuid,
   'invoice_overdue', 'pending', 'both',
   '2026-08-05 16:00:00+00'::timestamptz, null::timestamptz,
   'Invoice CAH-1007 is past due ($720.00)'),
  ('99999999-0005-4000-8000-000000000005'::uuid,
   null::uuid, 'dddddddd-0009-4000-8000-000000000009'::uuid, 'aaaaaaaa-0006-4000-8000-000000000006'::uuid,
   'invoice_due_soon', 'pending', 'email',
   '2026-08-15 13:00:00+00'::timestamptz, null::timestamptz,
   'Invoice CAH-1009 due Aug 17'),
  ('99999999-0006-4000-8000-000000000006'::uuid,
   'bbbbbbbb-0014-4000-8000-000000000014'::uuid, null::uuid, 'aaaaaaaa-0002-4000-8000-000000000002'::uuid,
   'follow_up', 'cancelled', 'email',
   '2026-08-06 10:00:00+00'::timestamptz, null::timestamptz,
   'Cancelled — customer paid in cash previously')
) as r(id, job_id, invoice_id, customer_id, schedule_type, status, channel, scheduled_for, sent_at, message_preview);

-- ── Activity logs ───────────────────────────────────────────────────────────
insert into public.activity_logs (
  id, business_id, actor_user_id, entity_type, entity_id, action, summary, metadata, created_at
)
select
  a.id, s.business_id, s.demo_user_id, a.entity_type, a.entity_id, a.action, a.summary, a.metadata::jsonb, a.created_at
from _tf_seed_ids s
cross join (values
  ('aaaa1111-0001-4000-8000-000000000001'::uuid, 'business', '22222222-2222-4222-8222-222222222222'::uuid,
   'onboarding_completed', 'Coastal Air & Heating finished onboarding', '{"source":"seed"}', '2026-07-10 15:00:00+00'::timestamptz),
  ('aaaa1111-0002-4000-8000-000000000002'::uuid, 'job', 'bbbbbbbb-0001-4000-8000-000000000001'::uuid,
   'job_completed', 'Completed AC repair for Elena Vargas', '{"amount_charged":5200.00}', '2026-08-01 16:20:00+00'::timestamptz),
  ('aaaa1111-0003-4000-8000-000000000003'::uuid, 'payment', 'ffffffff-0001-4000-8000-000000000001'::uuid,
   'payment_received', 'Received $5,200.00 for CAH-1001', '{"method":"card"}', '2026-08-01 18:30:00+00'::timestamptz),
  ('aaaa1111-0004-4000-8000-000000000004'::uuid, 'invoice', 'dddddddd-0006-4000-8000-000000000006'::uuid,
   'invoice_overdue', 'Marked CAH-1006 overdue', '{"total":1680.00}', '2026-08-02 00:05:00+00'::timestamptz),
  ('aaaa1111-0005-4000-8000-000000000005'::uuid, 'job', 'bbbbbbbb-0004-4000-8000-000000000004'::uuid,
   'job_completed', 'Emergency no-cool completed for Robert Chen', '{"service_type":"emergency"}', '2026-08-02 21:15:00+00'::timestamptz),
  ('aaaa1111-0006-4000-8000-000000000006'::uuid, 'payment', 'ffffffff-0005-4000-8000-000000000005'::uuid,
   'payment_received', 'Received $2,520.00 check for CAH-1005', '{"method":"check"}', '2026-08-04 10:00:00+00'::timestamptz),
  ('aaaa1111-0007-4000-8000-000000000007'::uuid, 'customer', 'aaaaaaaa-0010-4000-8000-000000000010'::uuid,
   'customer_updated', 'Updated Grant Inns billing notes', '{}', '2026-08-04 11:30:00+00'::timestamptz),
  ('aaaa1111-0008-4000-8000-000000000008'::uuid, 'job', 'bbbbbbbb-0018-4000-8000-000000000018'::uuid,
   'job_scheduled', 'Scheduled diagnostic for Sofia Alvarez (today 6 PM)', '{"scheduled_date":"2026-08-05"}', '2026-08-04 20:05:00+00'::timestamptz),
  ('aaaa1111-0009-4000-8000-000000000009'::uuid, 'reminder', '99999999-0003-4000-8000-000000000003'::uuid,
   'reminder_sent', 'Sent overdue reminder for CAH-1006', '{"channel":"email"}', '2026-08-02 14:02:00+00'::timestamptz),
  ('aaaa1111-0010-4000-8000-000000000010'::uuid, 'invoice', 'dddddddd-0010-4000-8000-000000000010'::uuid,
   'invoice_drafted', 'Drafted CAH-1010 for Naomi Ellis', '{"total":450.00}', '2026-08-04 10:30:00+00'::timestamptz)
) as a(id, entity_type, entity_id, action, summary, metadata, created_at);

-- Bump invoice sequence past seeded numbers
update public.businesses b
set invoice_next_number = 1011
from _tf_seed_ids s
where b.id = s.business_id;

commit;

-- ── Verification helpers (run manually after seed) ──────────────────────────
-- select sum(amount) from payments
--  where business_id = '22222222-2222-4222-8222-222222222222'
--    and status = 'succeeded'
--    and paid_at >= '2026-08-01' and paid_at < '2026-09-01';
-- -- expect 18420.00
--
-- select sum(labor_cost + parts_cost + other_cost) from jobs
--  where business_id = '22222222-2222-4222-8222-222222222222'
--    and status = 'completed'
--    and completed_at >= '2026-08-01' and completed_at < '2026-09-01';
-- -- expect 13060.00  (profit 5360)
--
-- select sum(total - amount_paid) from invoices
--  where business_id = '22222222-2222-4222-8222-222222222222'
--    and status in ('sent', 'viewed', 'partial', 'overdue');
-- -- expect 4280.00
--
-- select count(*) from jobs where status = 'completed' and business_id = '2222...'; -- 17
-- select count(*) from jobs where scheduled_date = '2026-08-05' and business_id = '2222...'; -- 4
-- select count(*) from invoices where status = 'overdue' and business_id = '2222...'; -- 3
