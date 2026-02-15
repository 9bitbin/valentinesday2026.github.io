# Music Library Setup Guide

The Valentine's Day archive now supports uploading and playing MP3 files directly from Supabase! This guide explains how to set up the required database table and storage bucket.

## Overview

Instead of YouTube integration, your music system now uses:
- **Supabase Storage** to host MP3 files (in `music` bucket)
- **Supabase Database** to store song metadata (in `music_library` table)
- **Built-in Audio Player** that loops through your uploaded songs

## Setup Steps

### 1. Create Music Storage Bucket

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **Storage** in the left sidebar
4. Click **Create a new bucket**
5. Name it: `music`
6. **Important**: Click the **Public** toggle to make files publicly accessible
7. Click **Create bucket**

### 2. Create Music Library Table

1. Go to **SQL Editor** in Supabase
2. Copy and paste this SQL:

```sql
create table if not exists music_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  filename text not null,
  music_url text not null,
  file_size bigint,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security for public read access
alter table music_library enable row level security;

-- Public read policy (anyone can see songs)
create policy "Allow anon read" on music_library
  for select to anon
  using (true);

-- Allow anonymous users to insert (matches carousel setup)
create policy "Allow anon insert" on music_library
  for insert to anon
  with check (true);

-- Allow anonymous users to delete
create policy "Allow anon delete" on music_library
  for delete to anon
  using (true);
```

3. Click **RUN** to execute

### 3. Test the Music Upload

Now your music system is ready to use!

Your users can:
1. **Click the 📤 button** in the music controls
2. **Select an MP3 file** from their computer
3. **Optionally add a song title** (defaults to filename)
4. **Click Upload** to add to Supabase
5. **Click ▶ to play** any song from the Music Library panel
6. **Click 🗑️ to delete** songs
7. **Click 🔁 to toggle looping** between songs

## Features

### Music Library Panel
- Located on the right side of the screen
- Shows all uploaded songs with upload dates
- Play/Delete buttons for each song
- Auto-advances to next song when current finishes (with looping)
- Auto-hides during login screen, appears after unlock

### Looping
- 🔁 button toggles loop mode (ON by default)
- When enabled, playlist repeats from the beginning
- When disabled, stops after the last song

### Song Title Display
- Shows current playing song in the music player header
- Updates with CD 💿 animation when music plays

## File Size Limits

By default, Supabase allows:
- **Authenticated uploads**: Up to 50 MB per file
- **Storage quota**: Depends on your Supabase plan

For longer songs or multiple uploads, consider:
- Using high-quality MP3 bitrates (128-192 kbps)
- Uploading shorter clips or highlights
- Upgrading Supabase plan if needed

## Troubleshooting

### "Supabase not configured" Error
- Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set in script.js
- Check [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for initial configuration

### Songs Won't Upload
1. Check the browser console (F12) for errors
2. Verify the `music` bucket exists and is **Public**
3. Make sure the MP3 file is valid and not too large
4. Try with smaller file first (test with <5 MB)

### Songs Won't Play
1. Check browser console for "CORS" errors
2. Verify `music` bucket is public (not private)
3. Check that music_url in database is correct
4. Try playing the URL directly in browser

## Removing Music Feature

To remove the music system entirely:

1. **Delete music table** (SQL):
```sql
drop table music_library;
```

2. **Delete music bucket**: Storage → music → Delete

3. **Remove from code**: Delete these files/sections:
   - Remove 📤 button from HTML (line with `uploadMusicBtn`)
   - Remove upload modal from HTML (between `<!-- MUSIC LIBRARY PANEL -->`)
   - Remove music panel HTML
   - Remove music-related CSS section from styles.css
   - Remove music functions from script.js

## Security Notes

This setup allows:
- ✅ Anyone to see and play songs (public read)
- ✅ Authenticated users to upload songs
- ✅ Users to delete their uploaded songs

For stricter control, you could:
- Require a password for uploads (add auth check)
- Restrict who can delete songs
- Add user ownership tracking

See Supabase docs for advanced RLS policies.

---

**Ready to use!** Upload your first song and test the music library. 🎵
