# Nexus + Nova setup

**Nexus** is the outreach toolbox (search, research, draft, send).  
**Nova** (`/nova`) is the AI manager that decides strategy and talks like Jarvis.

Sending starts on **Mailtrap** (sandbox recommended). Real HOA inboxes stay
safe until you turn sandbox off and verify a sending domain.

## 1. Create the database tables

Supabase → SQL Editor → paste and run, in order:

1. [`docs/NEXUS_SCHEMA.sql`](NEXUS_SCHEMA.sql) — companies, contacts, jobs, actions, suppressions
2. [`docs/NEXUS_SCHEMA_PHASE2.sql`](NEXUS_SCHEMA_PHASE2.sql) — research columns + draft review queue
3. [`docs/NEXUS_SCHEMA_NOVA.sql`](NEXUS_SCHEMA_NOVA.sql) — Nova chat + memory

Safe to re-run. Every table is service-role only, so the browser cannot read
Nexus data even when signed in.

Without the phase 2 migration, Lead Hand still works but Research and Outreach
buttons stay locked. Without the Nova migration, `/nova` chat still answers but
cannot persist memory.

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
address can open `/nexus`. For more than one operator, separate addresses with
commas:

```
NEXUS_ADMIN_EMAIL=you@example.com,cofounder@example.com
```

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

## Mailtrap send (start here)

1. Create a [Mailtrap](https://mailtrap.io) account
2. **Email Testing** → open an inbox → copy the **Inbox ID**
3. Settings → API Tokens → create a token
4. Add to `.env.local` / Vercel:

```bash
MAILTRAP_API_TOKEN=...
MAILTRAP_INBOX_ID=...          # required while MAILTRAP_SANDBOX=true
MAILTRAP_FROM_EMAIL=isaac@your-test.domain
MAILTRAP_FROM_NAME=Isaac at RideBy
MAILTRAP_SANDBOX=true          # emails land in Mailtrap, not HOAs
NEXUS_SEND_ENABLED=false       # flip to true only when ready to transmit
```

5. Redeploy. Approved drafts enqueue `outreach.send` with 5–15 min jitter.
6. Live (non-sandbox) also enforces 10:00–15:00 America/New_York weekdays and a
   daily cap (default 50 via `NEXUS_MAX_SENDS_PER_DAY`). Sandbox may send anytime so you can test at night.
7. Kill switch: set `NEXUS_SEND_ENABLED=false` and redeploy to hard-stop.

When you leave sandbox: verify a Mailtrap sending domain, set
`MAILTRAP_SANDBOX=false`, keep product Resend mail on a different domain.

## Nova (Jarvis cockpit)

1. Open `/nova` while signed in as a Nexus admin
2. Tap the orb → allow mic → say **“Hey Nova, how are the emails going?”**
3. Or type in the box (Safari/wake-word fallback)
4. Voice replies need ElevenLabs:

```bash
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...        # required on free tier — copy from My Voices
# ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

Free ElevenLabs accounts **cannot** use Voice Library IDs via the API. Open
[Voices](https://elevenlabs.io/app/voice-lab) → My Voices → ⋯ → **Copy voice ID**
→ paste as `ELEVENLABS_VOICE_ID` on Vercel → redeploy. If unset, Nova tries the
first voice on your account instead of a library default.

Nova can call Nexus tools: status, list drafts/companies, start search, run a
tick, queue approved sends, and store memory/trials.

### Background autonomy (UI closed)

Outreach keeps running without `/nova` or `/nexus` open when the scheduler is
on. Every 10 minutes the GitHub Action hits `/api/nexus/tick`, which:

- Processes queued jobs (search → research → draft → AI review → send)
- **Plans Nova's day automatically**: she sets her own daily target from
  approved drafts, learn data, and `NEXUS_MAX_SENDS_PER_DAY` (floor 20)
- **Replenishes sends** while she is running (not paused): queues approved
  drafts up to her target, prioritizing high-confidence and winning themes
  (still gated by `NEXUS_SEND_ENABLED`, pause flag, suppressions, and the
  10–3 ET window for live send)
- **Refreshes learning** every ~6 hours (or when new sends land): updates
  `nova_memory` keys `outreach.learning` and `outreach.strategy` so the next
  chat session sees fresh dossier data

One-time setup (not daily):

1. **`NEXUS_SEND_ENABLED=true`** and Mailtrap wired for actual delivery
2. GitHub secrets **`NEXUS_APP_URL`** + **`NEXUS_CRON_SECRET`** (see §5)

Nova runs herself by default. **Pause** her in chat when you need to stop sends
(soft kill switch alongside `NEXUS_SEND_ENABLED=false`). Optional **`send_today`**
overrides volume or resumes after pause — you do not need to arm her every
morning.

Voice wake word and ElevenLabs speak-back still need `/nova` open in the
browser. Outreach email, pipeline jobs, and background learn do not.

## Later phases

- **Gmail / Workspace send** — swap behind the same `outreach.send` hand on a
  dedicated outreach domain (warmup ramp, CAN-SPAM footer)
- **Inbox Hand** — ingest replies, classify intent
- **Full experiment UI** — Nova already stores trial notes in `nova_memory`

### Built now

- Lead / Research / Draft / AI review / **Mailtrap send**
- Nova chat + wake word + ElevenLabs speak-back
