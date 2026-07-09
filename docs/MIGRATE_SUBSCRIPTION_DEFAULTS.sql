-- Property Pilot — fix free-trialing paywall bypass
-- Run once in Supabase → SQL Editor after deploying the app changes.
--
-- New users should start at subscription_status = 'none'.
-- Free access is the 3-inspection usage counter, NOT a Stripe "trialing" status.

-- 1) Flip users who never paid (no Stripe customer) off fake trialing
update public.profiles
set subscription_status = 'none',
    plan = coalesce(nullif(plan, 'standard'), 'starter')
where subscription_status = 'trialing'
  and stripe_customer_id is null;

-- 2) Normalize legacy plan name
update public.profiles
set plan = 'starter'
where plan is null or plan = 'standard';

-- 3) Future defaults
alter table public.profiles
  alter column subscription_status set default 'none';
alter table public.profiles
  alter column plan set default 'starter';

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, subscription_status, plan)
  values (new.id, new.email, 'none', 'starter')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
