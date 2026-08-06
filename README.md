# TradeFlow

Mobile-first SaaS for small HVAC companies. Manage customers, jobs, invoices, payments, and basic job profitability in one place.

> Know what got done, who owes you, and what each job made.

## Stack

- Next.js 15 + TypeScript
- Tailwind CSS
- Supabase (auth + database)
- Stripe (test-mode invoice payments)
- React Hook Form + Zod
- Recharts, Lucide, Resend, jsPDF

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Try the demo**.

Demo company: **Coastal Air & Heating** with realistic customers, jobs, invoices, and dashboard totals.

## Environment

See `.env.example`. For local demo browsing you do not need keys.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | Auth + live data |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/admin operations |
| `STRIPE_SECRET_KEY` (`sk_test_…`) | Invoice Checkout |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_…`) | Stripe.js |
| `STRIPE_WEBHOOK_SECRET` | Payment webhooks |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Invoice & reminder email |
| `NEXT_PUBLIC_APP_URL` | Absolute URLs for pay links |

## Database

Apply the schema in Supabase SQL Editor (or CLI):

1. `supabase/migrations/001_tradeflow_schema.sql`
2. Optionally `supabase/seed.sql` (set `DEMO_USER_ID` to a real auth user first)

Every business-owned table includes `business_id` and RLS via `get_user_business_ids()`.

## App routes

| Path | Purpose |
|------|---------|
| `/dashboard` | Money + attention + upcoming jobs |
| `/dashboard/jobs` | Job list, create, profit detail |
| `/dashboard/customers` | Customer CRM |
| `/dashboard/invoices` | Invoicing + PDF + pay links |
| `/dashboard/calendar` | Month/week schedule |
| `/dashboard/settings` | Business, tax, labor, reminders |
| `/pay/[token]` | Customer card payment page |

## Demo vs live

- Cookie `tf-mode=demo` (default) uses in-browser Coastal Air data with full CRUD.
- `tf-mode=live` requires Supabase auth for dashboard access.
- Reset demo data anytime from **Settings**.

## Stripe payments

1. Add test keys to `.env.local`
2. Open an invoice → **Copy payment link**
3. Customer opens `/pay/...` → **Pay with card**
4. Webhook at `/api/stripe/webhook` acknowledges `checkout.session.completed`

Without Stripe keys, the pay page records a demo payment so the flow stays usable.

## Reminders

`POST /api/reminders/run` generates due / 3 / 7 / 14-day overdue reminder copy. Emails send when Resend is configured.

## Scripts

```bash
npm run dev      # local server
npm run build    # production build
npm run lint     # eslint
```

## V1 scope

Included: owner/admin workspace, customers, jobs, profit math, invoices, Stripe test pay, calendar, reminders structure, settings, demo seed.

Not in V1: AI features, employee portal, route optimization, payroll, inventory, QuickBooks.
