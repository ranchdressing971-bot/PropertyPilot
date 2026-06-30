# Video Processing Pipeline

Property Pilot analyzes **real drive-through footage** in Live mode.

## How it works

```
Phone/desktop video (.mp4 / .mov)
        │
        ▼
Browser extracts frames (every ~2s, max 14)
  src/lib/video-frames.ts
        │
        ▼
POST /api/analyze-inspection  { frames[], roster[], ccrRules }
        │
        ├── runAddressDetection() — GPT-4o-mini reads house numbers / signs
        ├── match frames → roster properties
        └── analyzeBatch() — GPT-4o-mini compliance scan per property frame
        │
        ▼
Inspection results + evidence images from actual video frames
```

## What you need

1. **OPENAI_API_KEY** in `.env.local` (local) or Vercel env vars (production)
2. Restart dev server after adding the key: `npm run dev`
3. **Property roster** (recommended) — import CSV on Properties or during onboarding
4. Video under **~2 minutes** works best (frame cap keeps API cost predictable)

## Optional: cloud video backup

Run the storage section at the bottom of `docs/schema.sql` to create the
`inspection-videos` Supabase bucket. Signed-in uploads are also sent to
`POST /api/upload-video` in parallel with analysis.

## Tips for good scans

- Drive slowly past mailboxes and house numbers
- Film in daylight when possible
- Use MP4 (H.264) — most reliable in browsers
- Import your roster **before** uploading so address matching works

## Limits

| Limit | Value | Why |
|-------|-------|-----|
| Max frames | 14 | API cost + Vercel 4.5 MB body limit |
| Frame interval | ~2 sec | Balance coverage vs. cost |
| Max video upload | 100 MB | Storage endpoint cap |
| Vision model | gpt-4o-mini | Cost-effective for production |

## Future upgrades (not yet implemented)

- **Mux / Cloudinary** — server-side transcoding for long videos
- **FFmpeg worker** — background job on a dedicated server
- **GPS metadata** — match phone location to roster lat/lng
- **Progress polling** — async jobs for 20+ minute community drives
