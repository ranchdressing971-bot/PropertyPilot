-- Community-based pricing:
--   c = 1..3 → $299/mo (flat)
--   c > 3    → max(299, round(99 × c^0.7))
--   Buy-more → max(current_monthly, published table price)
-- Run in Supabase → SQL Editor

alter table public.profiles
  add column if not exists community_count integer default 1;

alter table public.profiles
  add column if not exists price_monthly integer;

comment on column public.profiles.community_count is
  'Paid community seats. $299 for 1-3; 4+ max(299, round(99*c^0.7)). Upsells use same table, never below current.';
comment on column public.profiles.price_monthly is
  'Cached monthly dollar amount from last checkout or community upgrade';
