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
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL, e.g. `https://property-pilot.vercel.app` |

**Then redeploy** — old deployments do not pick up new env vars.

Verify: open `https://YOUR-URL/api/health` — OpenAI and Supabase should be `true`.

---

## 3. Rotate exposed keys

If you ever pasted API keys in chat or committed them, **rotate**:

- OpenAI: create a new key, delete the old one
- Supabase: roll anon key if concerned (update Vercel + `.env.local`)

---

## 4. Stripe (billing)

1. Create account at [stripe.com](https://stripe.com) → stay in **Test mode**
2. **Products** → create:
   - **Starter** — $49/month recurring → copy **Price ID** (`price_...`)
   - **Professional** — $129/month recurring → copy **Price ID**
3. Add to Vercel (and `.env.local`):
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PRICE_STARTER=price_...
   STRIPE_PRICE_PRO=price_...
   ```
4. **Developers → Webhooks** → Add endpoint:
   - URL: `https://YOUR-VERCEL-URL/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`
   - Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET=whsec_...`
5. Redeploy again
6. Test checkout with card `4242 4242 4242 4242`

**Local webhook testing:**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Until Stripe is configured, live inspections work without payment (dev-friendly).

---

## 5. Resend (violation emails)

1. [resend.com](https://resend.com) → create API key
2. Verify your domain (or use `onboarding@resend.dev` for testing only)
3. Add to Vercel:
   ```
   RESEND_API_KEY=re_...
   RESEND_FROM_EMAIL=Property Pilot <notifications@yourdomain.com>
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
