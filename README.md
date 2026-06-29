# Property Pilot

AI-powered HOA inspection prototype. Upload a neighborhood drive-through video and review AI-generated property compliance reports.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo Flow

1. **Home** — Landing page with Upload Video and View Demo CTAs
2. **Dashboard** — Stats, activity feed, and AI insights
3. **Upload** — Drag-and-drop video with simulated AI processing
4. **Inspection Results** — 20 properties with mock violation detection
5. **Violations** — Review, approve, or dismiss with notice preview
6. **Properties** — Individual property detail with inspection history

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion

## Deploy to Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new)
2. Add environment variable: `OPENAI_API_KEY` = your OpenAI key
3. Deploy — the build no longer requires the key at build time, but AI uploads need it at runtime
