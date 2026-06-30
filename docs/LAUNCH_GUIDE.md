# Launch Guide — Making Property Pilot Sellable

This guide expands on everything beyond the core product code: billing, email,
legal, reliability, and go-to-market.

---

## 1. Environment & database (do this first)

### Local `.env.local`

```env
OPENAI_API_KEY=sk-proj-...
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Critical:** `OPENAI_API_KEY` has no `NEXT_PUBLIC_` prefix. It is server-only.
After creating `.env.local`, run `npm run dev` again.

macOS System Settings → Environment Variables does **not** inject into Next.js.
Use `.env.local` in the project root.

### Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Run **`docs/schema.sql`** in SQL Editor (profiles, roster, inspections, audit log, storage)
3. Auth → URL Configuration → add `http://localhost:3000/auth/callback` and your Vercel URL
4. Copy Project URL + anon key into `.env.local` and Vercel

### Vercel production

1. Settings → Environment Variables → add all three vars for **Production, Preview, Development**
2. **Redeploy** — old deployments never see new env vars
3. Verify at `/api/health` or Settings → Connection Status

---

## 2. Stripe billing (subscriptions)

The `/pricing` page is UI-only today. To charge customers:

### Setup (≈2–4 hours)

1. Create [Stripe](https://stripe.com) account → enable **Test mode**
2. Products → create:
   - **Starter** — $49/mo — price ID `price_xxx`
   - **Professional** — $129/mo — price ID `price_yyy`
3. Install: `npm install stripe @stripe/stripe-js`
4. Add env vars:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_STARTER=price_xxx
   STRIPE_PRICE_PRO=price_yyy
   ```

### Routes to build

| Route | Purpose |
|-------|---------|
| `POST /api/stripe/checkout` | Create Checkout Session, redirect user |
| `POST /api/stripe/webhook` | Handle `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted` |
| `GET /api/stripe/portal` | Customer billing portal link |

### Database additions

```sql
alter table profiles add column stripe_customer_id text;
alter table profiles add column subscription_status text default 'trialing';
alter table profiles add column plan text default 'starter';
```

### Gating logic

- **Demo mode** — always free, no Stripe
- **Live mode** — require `subscription_status IN ('active', 'trialing')` OR show upgrade modal
- Enforce inspection limits on Starter (e.g. 5/month) via `audit_log` count

### Launch checklist

- [ ] Test checkout with card `4242 4242 4242 4242`
- [ ] Webhook forwarding: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- [ ] Switch to live keys only when ready to charge real cards
- [ ] Add “Manage billing” in Settings

---

## 3. Email delivery (violation notices)

Today, **Email Owner** opens the user’s mail client (`mailto:`). For automated
alerts you need a transactional provider.

### Recommended: Resend (simplest for Next.js)

1. [resend.com](https://resend.com) → verify your domain (`mail.yourdomain.com`)
2. `npm install resend`
3. `RESEND_API_KEY=re_...` in env
4. Create `POST /api/email/violation-notice`:
   - Input: `violationId`
   - Load violation + property + manager profile
   - Attach PDF (generate server-side or link to download)
   - Send to homeowner email (requires adding `owner_email` to roster CSV)

### Roster CSV extension

```csv
address,lot,owner_email
123 Main St,12,owner@email.com
```

### Notification flow

1. User enables notifications in Settings (already saves preference)
2. After inspection completes, if `notify_violations` and new pending violations → queue emails
3. Use Resend batch API or a simple queue (Inngest, Trigger.dev) for retries

### Compliance

- Include physical mailing address in footer (CAN-SPAM)
- Allow unsubscribe for marketing; violation notices may be transactional (legal counsel)

---

## 4. Legal (before taking money)

### What exists now

- `/privacy` and `/terms` — **starter templates**, not legal advice

### Before launch

| Document | Purpose |
|----------|---------|
| **Terms of Service** | Liability cap, AI disclaimer, acceptable use |
| **Privacy Policy** | GDPR/CCPA disclosures, data retention, subprocessors |
| **DPA** | If you sell to management companies handling owner PII |
| **AI disclaimer** | “Human review required before enforcement” (already in Terms) |

### Actions

1. Hire a lawyer familiar with SaaS + HOAs (~$500–2k for template review)
2. Add checkbox on signup: “I agree to Terms and Privacy Policy”
3. Log consent timestamp in `profiles` or `audit_log`
4. Document subprocessors: OpenAI, Supabase, Vercel, Stripe, Resend

### HOA-specific

- Managers must confirm authority to inspect and send notices
- Retain evidence images per your CC&R / state requirements (often 1–3 years)
- Some states require certified mail for fines — app generates notices; delivery is manager’s responsibility

---

## 5. Monitoring & reliability

### Sentry (errors)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

- `SENTRY_DSN=...` in Vercel
- Captures API failures (OpenAI 429, Supabase errors)
- Alert on error rate spike

### Uptime

- [Better Uptime](https://betteruptime.com) or UptimeRobot → ping `/api/health` every 5 min
- Alert if OpenAI or Supabase checks fail

### Rate limits (add when public)

- Max 10 inspections/day per user on Starter
- Max 100 MB video upload (already enforced)
- CAPTCHA on signup if abused

---

## 6. HOA pilot program (first paying customer)

### Week 1 — recruit

- Target: 50–150 home community with an overworked manager
- Offer **free 60-day pilot** in exchange for:
  - Weekly 15-min feedback call
  - Permission to use anonymized stats in marketing
  - Written testimonial if satisfied

### Week 2 — onboard

1. Manager signs up, completes profile
2. You help import roster CSV (addresses from county records or HOA list)
3. Manager films one real drive-through on phone
4. Review results together — correct any wrong address matches

### Week 3–4 — refine

- Track: time saved vs. manual review
- Fix: CC&R rules wording to match their documents
- Export one real violation PDF for their board meeting

### Success metrics

| Metric | Target |
|--------|--------|
| Time per inspection | < 30 min total (vs. 2–4 hrs manual) |
| Address match rate | > 80% with roster |
| False positive rate | Manager dismisses < 20% of AI flags |
| Would pay $49–129/mo? | Yes after pilot |

---

## 7. Go-to-market checklist

### Product (status)

| Item | Status |
|------|--------|
| Real video frame analysis | ✅ Done |
| Address OCR + roster matching | ✅ Done |
| PDF violation notices | ✅ Done |
| Profile + onboarding | ✅ Done |
| CSV roster import | ✅ Done |
| Supabase persistence | ✅ Schema ready — run SQL |
| Stripe billing | ❌ Build per section 2 |
| Transactional email | ❌ Build per section 3 |
| Lawyer-reviewed legal | ❌ Section 4 |

### Marketing

- [ ] Landing page case study (“Saved 3 hours per inspection”)
- [ ] 2-min Loom demo: upload → results → PDF
- [ ] LinkedIn/Facebook groups for HOA managers
- [ ] Partner with local property management associations

### Support

- [ ] `support@propertypilot.app` inbox
- [ ] In-app help doc link (VIDEO_PIPELINE.md → user-facing FAQ)
- [ ] 24–48 hr response SLA on Starter, same-day on Pro

---

## 8. Cost model (for your pricing)

Rough cost per **live inspection** (14 frames, 20 properties):

| Service | Est. cost |
|---------|-----------|
| OpenAI gpt-4o-mini vision | $0.15 – $0.40 |
| Supabase | negligible at pilot scale |
| Vercel | free tier → Pro $20/mo |

At **$49/mo Starter** with 5 inspections → ~$2 AI cost vs. $49 revenue.
Professional unlimited still profitable if average < 30 inspections/mo.

---

## Quick reference

| Doc | Topic |
|-----|-------|
| `docs/VIDEO_PIPELINE.md` | How video analysis works |
| `docs/OPENAI_SETUP.md` | API key troubleshooting |
| `docs/SUPABASE_SETUP.md` | Auth + database |
| `docs/schema.sql` | Full database + storage |
