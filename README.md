# RideBy

AI-powered HOA inspection product. Upload a neighborhood drive-through video and review AI-generated property compliance reports.

## Modes

| Mode | Description |
|------|-------------|
| **Demo** | Sample data, simulated upload — no API key or sign-in |
| **Live** | Real GPT-4o Vision analysis — requires OpenAI key + sign-in (when Supabase is configured) |

## Getting Started

```bash
npm install
cp .env.example .env.local   # add keys for live mode
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

- **View Demo** — instant access with mock inspections
- **Sign In** — live mode with real AI (after configuring keys)

## Setup guides

- [OpenAI API key](docs/OPENAI_SETUP.md) — fix live mode / API errors
- [Supabase sign-in](docs/SUPABASE_SETUP.md) — add authentication

## Deploy to Vercel

1. Import repo at [vercel.com/new](https://vercel.com/new)
2. Add environment variables (see `.env.example`)
3. Redeploy after adding vars

## Demo Flow

1. Home → **View Demo**
2. Browse dashboard, violations, properties
3. Upload → simulated analysis → sample results

## Live Flow

1. Configure OpenAI + Supabase (see docs above)
2. **Sign In** → switch to Live in Settings
3. Upload video → GPT-4o analyzes all properties
