-- Community-based pricing: P(c) = 99 × c^0.7
-- Run in Supabase → SQL Editor

alter table public.profiles
  add column if not exists community_count integer default 1;

alter table public.profiles
  add column if not exists price_monthly integer;

comment on column public.profiles.community_count is
  'Number of communities on the paid subscription (for P(c)=99*c^0.7)';
comment on column public.profiles.price_monthly is
  'Cached monthly dollar amount from last checkout';
