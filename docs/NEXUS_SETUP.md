# Nexus setup (Phase 1: Lead Hand)

Nexus is the internal outreach system. Phase 1 finds HOA management companies and
stores them in Atlas. **Nothing sends email yet** — that is deliberate, so the
lead pipeline can be built and reviewed with zero deliverability risk.

## 1. Create the database tables

Supabase → SQL Editor → paste and run [`docs/NEXUS_SCHEMA.sql`](NEXUS_SCHEMA.sql).

Safe to re-run. Every table is service-role only, so the browser cannot read
Nexus data even when signed in.

## 2. Google Places API key

1. [Google Cloud Console](https://console.cloud.google.com/) → create or pick a project
2. Enable **Places API (New)**
3. Credentials → Create credentials → API key
4. Restrict the key to the Places API
5. Set `GOOGLE_PLACES_API_KEY` in `.env.local` and in Vercel

### What this costs

Billing is per field mask tier, and the Lead Hand requests `websiteUri` and
`nationalPhoneNumber`, which are **Enterprise-tier** fields:

| SKU | Free per month | Then |
| --- | --- | --- |
| Text Search Enterprise | 1,000 calls | ~$35 per 1,000 |

Each call returns up to 20 companies, so 1,000 free calls is roughly 20,000
companies per month. Prospecting is a one-time cost per market because results
are stored and deduped, so in practice this stays free.

Google permits caching `place_id` indefinitely; other Google fields are treated
as refreshable and tracked by `places_synced_at`.

## 3. Runner secret

```bash
openssl rand -hex 32
```

Set the value as `NEXUS_CRON_SECRET` in `.env.local` and Vercel.

## 4. Operator access

Set `NEXUS_ADMIN_EMAIL` to the email of the account you sign in with. Only that
address can open `/nexus`.

## 5. Scheduler

Vercel Cron cannot drive this on the Hobby plan: it allows one cron per day and
fires anywhere within the hour. The limit is on Vercel's scheduler, not on the
endpoint, so a GitHub Action pings it instead.

GitHub → repo → Settings → Secrets and variables → Actions → add:

| Secret | Value |
| --- | --- |
| `NEXUS_APP_URL` | `https://rideby-ai.vercel.app` (no trailing slash) |
| `NEXUS_CRON_SECRET` | same value as in Vercel |

[`.github/workflows/nexus-tick.yml`](../.github/workflows/nexus-tick.yml) then
runs every 10 minutes. Trigger it manually the first time from the Actions tab
via "Run workflow".

## 6. Verify

```bash
# Should return 401
curl -i https://rideby-ai.vercel.app/api/nexus/tick

# Should return processed counts
curl -X POST -H "Authorization: Bearer $NEXUS_CRON_SECRET" \
  https://rideby-ai.vercel.app/api/nexus/tick
```

Then open `/nexus`, queue a search such as `HOA management company in Austin TX`,
and wait for the next tick (or trigger the workflow manually). Companies appear
in the table, and every find is written to the action log.

Re-running the same query stores nothing new — dedupe is enforced by the unique
index on `place_id`.

## How the runtime works

Serverless functions are killed at 60 seconds, so hands never run as long
scripts. Work is queued in `nexus_jobs`; each tick claims a small batch using
`for update skip locked`, processes what fits in a ~50s budget, and leaves the
rest queued. Two overlapping ticks can never claim the same job, which is what
will later guarantee an email is never sent twice.

A search that spans multiple Places pages requeues itself with the next page
token rather than looping, so every invocation stays short.

## Not built yet (later phases)

- **Research Hand** — crawl contact/about/team pages for public emails, storing the source URL for each
- **Outreach Hand** — Gmail API on a separate outreach domain, warmup ramp, daily caps, drafts pending approval, CAN-SPAM footer
- **Inbox Hand** — ingest replies, classify intent, route by confidence
- **Customer / Weekly Summary / Learning**

### Before any sending is added

- Register a **separate outreach domain**. Never send cold email from the domain
  serving product email.
- Google Workspace Business Starter is $8.40/user/month flexible, or $7 with an
  annual commitment.
- Gmail allows 2,000 external recipients per day, but that is not the real limit.
  A new domain should start at 20-30 per day and ramp to 50-80 over about six
  weeks. Nexus should enforce that cap itself.
- Cold B2B email is legal in the US under CAN-SPAM provided the message has
  accurate headers, a real physical postal address, an honest subject line, and a
  working opt-out honored promptly. The `nexus_suppressions` table exists for
  exactly this and already ships.
