# Your setup checklist

Everything the code cannot do for you. Work through this in order.

---

## 1. Supabase (required)

1. Open [supabase.com](https://supabase.com) → your project → **SQL Editor**
2. Paste and run the full **`docs/schema.sql`** file (includes billing columns)
3. **Authentication → URL Configuration** → add:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR-VERCEL-URL.vercel.app/auth/callback`
4. Copy **Project URL**, **anon key**, and **service role key** (Settings → API)

---

## 2. Vercel environment variables

In Vercel → Project → Settings → Environment Variables, add **all** of these for Production (and Preview if you want):

| Variable | Where to get it |
|----------|-----------------|
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (secret — never expose to client) |
| `NEXT_PUBLIC_APP_URL` | **You create this** — your public site URL (see below) |

**`NEXT_PUBLIC_APP_URL` — where to get it:** This is not copied from Stripe or Supabase. It is the URL people use to open your app:

- **Vercel:** Project → **Settings → Domains** — use your `.vercel.app` URL or custom domain, e.g. `https://property-pilot.vercel.app` (no trailing slash)
- **Local dev:** `http://localhost:3000` (optional in `.env.local`)

Vercel also sets `VERCEL_URL` automatically, but set `NEXT_PUBLIC_APP_URL` explicitly if you use a custom domain or Stripe redirects fail.

**Then redeploy** — old deployments do not pick up new env vars.

Verify: open `https://YOUR-URL/api/health` — OpenAI and Supabase should be `true`.

---

## 3. Rotate exposed keys

If you ever pasted API keys in chat or committed them, **rotate**:

- OpenAI: create a new key, delete the old one
- Supabase: roll anon key if concerned (update Vercel + `.env.local`)

---

## 4. Stripe (community billing)

Pricing is computed in app code (not a single fixed Price ID):

- **Initial:** **$299/mo** for **1-3** communities; more than 3: `max(299, round(99 × c^0.7))`
- **Buy-more:** volume curve only `max(current_monthly, round(99 × c^0.7))` (not the $299 flat)
- Trial: **1 free inspection** + **1 community** until subscribe
- Add seats later: Settings → Billing (prorated) or Pricing

1. [stripe.com](https://stripe.com) → **Test mode**, then Live when ready
2. **Products** → create **RideBy** (optional) → copy Product ID `prod_...` into `STRIPE_PRODUCT_ID`  
   Checkout / upgrades create **Prices** dynamically on that product. Fixed `price_...` IDs are not required.
3. Add to Vercel (and `.env.local`):
   ```
   STRIPE_SECRET_KEY=sk_live_...   # must be sk_..., not a restricted rk_... key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRODUCT_ID=prod_...      # recommended
   ```
4. **Developers → Webhooks** → endpoint `https://YOUR-DOMAIN/api/stripe/webhook`  
   Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
5. Redeploy. Test card: `4242 4242 4242 4242`

---

## 5. Resend (violation emails)

1. [resend.com](https://resend.com) → create API key
2. Verify your domain (or use `onboarding@resend.dev` for testing only)
3. Add to Vercel:
   ```
   RESEND_API_KEY=re_...
   RESEND_FROM_EMAIL=RideBy <notifications@yourdomain.com>
   ```
4. Redeploy

Until Resend is configured, **Email Owner** falls back to your device mail app.

---

## 6. iPhone home screen icon

1. Delete old shortcut
2. Safari → your site → Share → **Add to Home Screen**

---

## 7. Legal (before charging real money)

- [ ] Have a lawyer review `/terms` and `/privacy` templates
- [ ] Set up `support@propertypilot.app` and `legal@propertypilot.app` inboxes

---

## 8. First pilot customer

1. Sign up yourself on production
2. Complete profile (name + HOA)
3. Upload a short drive-through video in **Live** mode
4. Recruit one HOA manager for a free 60-day pilot

---

## Quick test flow

1. `npm run dev` locally with `.env.local` filled in
2. Demo mode → explore sample inspection
3. Sign up → profile setup → upload real video in Live mode
4. Settings → Connection Status all green
5. Pricing → Start trial (after Stripe configured)
