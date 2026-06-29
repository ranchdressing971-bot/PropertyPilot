# OpenAI API Key Setup

Live mode uses **GPT-4o-mini Vision** to analyze property images. Demo mode works without any API key.

## 1. Create a new API key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **Create new secret key**
3. Copy the key (starts with `sk-proj-...` or `sk-...`)
4. **Do not** commit the key to GitHub

## 2. Add billing

OpenAI requires a paid account for API usage:

1. [platform.openai.com/account/billing](https://platform.openai.com/account/billing)
2. Add a payment method and at least $5 credit

## 3. Local development

Create `.env.local` in the project root:

```env
OPENAI_API_KEY=sk-proj-your-key-here
```

Restart the dev server:

```bash
npm run dev
```

## 4. Vercel (production)

1. Open your project on [vercel.com](https://vercel.com)
2. **Settings → Environment Variables**
3. Add:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** your key
   - **Environments:** Production, Preview, Development
4. Click **Save**
5. **Deployments → Redeploy** (required — env vars are not applied to past builds)

## 5. Verify

1. Open the app → **Settings**
2. Switch to **Live** mode
3. Check **Connection Status → OpenAI**

Or visit `/api/health` in the browser.

## Common errors

| Error | Fix |
|-------|-----|
| `OPENAI_API_KEY missing` | Add env var in Vercel and redeploy |
| `Invalid API key` | Key was revoked or copied wrong — create a new one |
| `insufficient_quota` / `429` | Add billing credits on OpenAI |
| Works locally, fails on Vercel | Env var not set for Production, or you forgot to redeploy |

## Demo vs Live

| | Demo Mode | Live Mode |
|---|-----------|-----------|
| API key | Not needed | Required |
| Upload | Simulated progress | Real GPT-4o analysis |
| Results | Sample data (`insp-1`) | Fresh AI inspection |
| Sign-in | Optional | Required when Supabase is configured |
