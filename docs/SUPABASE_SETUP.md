# Supabase Sign-In Setup

Follow these steps to add email/password authentication to Property Pilot.

## Overview

- **Demo mode** — no sign-in, uses mock data (always works)
- **Live mode** — requires sign-in when Supabase is configured
- Auth protects `/dashboard` routes unless the `pp-mode=demo` cookie is set

---

## Step 1: Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up / log in
2. Click **New project**
3. Choose an organization, name (e.g. `property-pilot`), database password, and region
4. Wait for the project to finish provisioning (~2 minutes)

---

## Step 2: Get your API keys

1. In Supabase dashboard → **Project Settings** (gear icon) → **API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> Use the **anon** key in the browser. Never expose the `service_role` key in frontend code.

---

## Step 3: Configure authentication

1. Supabase dashboard → **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. **Authentication** → **URL Configuration**:
   - **Site URL:** `https://your-app.vercel.app` (or `http://localhost:3000` for local)
   - **Redirect URLs** — add all of these:
     ```
     http://localhost:3000/auth/callback
     https://your-app.vercel.app/auth/callback
     ```
4. (Optional) **Authentication** → **Providers** → Email → disable **Confirm email** for faster testing

---

## Step 4: Add environment variables

### Local (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Also required for live AI:
OPENAI_API_KEY=sk-proj-your-key-here
```

### Vercel

1. **Settings → Environment Variables**
2. Add both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Enable for **Production**, **Preview**, and **Development**
4. **Redeploy** the app

---

## Step 5: Test sign-in

1. Restart local dev server: `npm run dev`
2. Go to `/signup` and create an account
3. Go to `/login` and sign in
4. Settings should show **Supabase: Connected**
5. Switch to **Live** mode in Settings
6. Upload a video — should call OpenAI (if key is also configured)

---

## Step 6 (optional): Database schema for saved inspections

Run this in Supabase → **SQL Editor** to store inspections per user later:

```sql
-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  hoa_name text default 'Willow Creek Estates',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Inspections (future: persist live AI results)
create table public.inspections (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  video_name text,
  neighborhood text,
  results jsonb,
  created_at timestamptz default now()
);

alter table public.inspections enable row level security;

create policy "Users can CRUD own inspections"
  on public.inspections for all
  using (auth.uid() = user_id);
```

---

## How auth works in this app

```
Home page
  ├── View Demo → demo cookie → /dashboard (no login)
  └── Sign In   → /login → Supabase auth → /dashboard (live mode)

Middleware (src/middleware.ts)
  ├── Supabase not configured → allow all dashboard routes
  ├── pp-mode=demo cookie      → allow dashboard without login
  └── live + no session        → redirect to /login
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Supabase is not configured" | Add env vars and redeploy |
| Redirect loop after login | Add `/auth/callback` to Supabase redirect URLs |
| Email confirmation required | Check spam, or disable confirm email in Supabase |
| Dashboard redirects to login in demo | Click **Demo** on login page or Settings → Demo mode |
| CORS / invalid redirect | Site URL must match your deployed domain exactly |

---

## Files added for Supabase

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server-side client (cookies) |
| `src/lib/supabase/middleware.ts` | Session refresh + route protection |
| `src/middleware.ts` | Next.js middleware entry |
| `src/app/login/` | Sign-in page |
| `src/app/signup/` | Registration page |
| `src/app/auth/callback/route.ts` | OAuth / email confirm callback |
