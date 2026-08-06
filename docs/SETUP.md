# Make TradeFlow functional

## Fast path (works today)

1. From `/Users/Isaac/Applications/TradeFlow`:
   ```bash
   npm install
   npm run dev -- -p 3001
   ```
2. Open http://localhost:3001 → **Open demo shop**
3. Demo data (Coastal Air & Heating) is fully writable in this browser:
   - Create / edit / delete customers
   - Create / edit / duplicate jobs, mark progress / completed / cancelled
   - Generate invoices from completed jobs
   - Copy pay links, mark paid, download PDF, log reminders
   - Calendar reschedule, settings save, search

Demo state lives in `localStorage` (`tradeflow-demo-v1`). Reset anytime in **Settings**.

## Live path (your real business data)

1. Create a Supabase project.
2. Run SQL in order:
   - `supabase/migrations/001_tradeflow_schema.sql`
   - Optionally `supabase/seed.sql` (set `DEMO_USER_ID` to your auth user UUID first)
3. Copy `.env.example` → `.env.local` and fill:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   NEXT_PUBLIC_APP_URL=http://localhost:3001
   ```
4. Enable Email auth in Supabase.
5. Sign up in the app → complete onboarding → set cookie mode to live (sign-in does this).

> V1 demo CRUD is client-side. Live Supabase persistence for every mutation is the next wiring pass after schema is applied — auth, RLS, and schema are already in place.

## Stripe test payments

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Without Stripe keys, `/pay/[token]` still records a demo payment so the owner flow stays usable.

## Reminder emails

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=TradeFlow <notifications@yourdomain.com>
```

`POST /api/reminders/run` generates due / 3 / 7 / 14-day copy; sends when Resend is set.
