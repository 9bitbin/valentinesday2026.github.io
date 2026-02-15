# Supabase setup for carousel uploads

Uploaded photos are stored in **Supabase** (Storage + Database) so both you and your partner see the same carousel on any device. No billing upgrade needed for the free tier.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (GitHub or email).
2. Click **New project** → pick an organization → name (e.g. `valentinesday2026`) → set a database password (save it) → choose a region → **Create project**.
3. Wait for the project to finish provisioning.

## 2. Get your API keys

1. In the left sidebar: **Project Settings** (gear) → **API**.
2. Copy:
   - **Project URL** → this is your `SUPABASE_URL`
   - **anon public** key (under "Project API keys") → this is your `SUPABASE_ANON_KEY`

In **script.js**, replace the placeholders at the top:

```js
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGc...';
```

## 3. Create the carousel table

1. In the left sidebar: **Table Editor** → **New table**.
2. Name: `carousel_photos`.
3. Leave "Enable Row Level Security (RLS)" **on** (we’ll add a policy so the site can read/insert).
4. Click **Save**.
5. Add columns (if not using the wizard, use **SQL Editor** and run the script below):

| Column       | Type         | Default value           |
|-------------|--------------|--------------------------|
| id          | uuid         | `gen_random_uuid()`     |
| image_url   | text         | —                        |
| caption     | text         | —                        |
| date        | text         | —                        |
| created_at  | timestamptz  | `now()`                  |

**Or run this in SQL Editor** (**SQL Editor** → **New query**):

```sql
create table public.carousel_photos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text default 'Uploaded Photo',
  date text,
  created_at timestamptz default now()
);

-- Allow anyone to read and insert (your upload password in the app is the only gate)
alter table public.carousel_photos enable row level security;

create policy "Allow public read"
  on public.carousel_photos for select
  using (true);

create policy "Allow public insert"
  on public.carousel_photos for insert
  with check (true);
```

## 4. Create the Storage bucket

1. Left sidebar: **Storage** → **New bucket**.
2. Name: `carousel`.
3. Check **Public bucket** (so carousel images can be shown without signing in).
4. Click **Create bucket**.
5. Open the `carousel` bucket → **Policies** (or **New policy**). Add a policy so uploads are allowed:
   - **Policy name:** Allow uploads
   - **Allowed operation:** INSERT (and SELECT for read)
   - **Target roles:** Leave as default or use `public` if available.
   - Or in **Storage** → **Policies**, use "For full customization" and add:

```sql
-- Allow public to upload to carousel bucket
create policy "Public upload"
on storage.objects for insert
to public
with check (bucket_id = 'carousel');

-- Allow public to read
create policy "Public read"
on storage.objects for select
to public
using (bucket_id = 'carousel');
```

(Exact policy UI may vary; the goal is: **insert** and **select** on bucket `carousel` for public/anonymous.)

## 5. Deploy and test

Push your repo and open the site on GitHub Pages. Unlock, then use **+ Add Photo** (with your upload password). The photo should upload to Supabase and appear in the carousel for both of you.

## If upload fails

- **"Supabase is not configured"** → Paste the real `SUPABASE_URL` and `SUPABASE_ANON_KEY` in **script.js** (no quotes around the URL).
- **"new row violates row-level security"** → The table needs the RLS policies from step 3 (allow select and insert).
- **"Permission denied" or "Bucket not found"** → Ensure the bucket is named exactly `carousel`, is **Public**, and has policies that allow **insert** and **select** for the bucket.

Your anon key is safe to use in the browser; RLS and Storage policies limit what users can do.
