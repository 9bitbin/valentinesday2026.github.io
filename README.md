# Valentine's Day 2026 Digital Archive 💗

A password-protected, interactive love archive featuring photo carousel, polaroid gallery, milestone notes, and timeline memories. Built with vanilla JavaScript, Supabase backend, and GSAP animations.

## 🌟 Features

### 1. **Password-Protected Login**
- SHA-256 hashed validation for security
- Three answer validation: Date (6/22/22), Color (Purple), Place (Penn Station)
- Multiple date format support (M/D/YY, MM/DD/YYYY, etc.)
- Lock screen with glass-morphism design

### 2. **Photo Upload & Management**
- Upload photos with optional captions to Supabase Cloud Storage
- Password-protected uploads (password: `love2026`)
- Photos persist in cloud for both users to access
- Real-time sync across devices
- Delete functionality with verification
- Automatic carousel and polaroid updates

### 3. **Interactive Carousel**
- Auto-rotating photo slideshow with GSAP animations
- Manual navigation (previous/next buttons)
- Pause/play controls
- Delete buttons on each slide (visible on hover)
- Full image visibility with `object-fit: contain`
- Responsive sizing with clamp() for fluid layouts

### 4. **Polaroid Gallery**
- Photos displayed as scattered polaroids with thumbtack pins 📌
- Randomized rotation for natural look
- Hover effects with pink glow (no shake animation)
- Images show fully without cropping
- Responsive grid layout
- Auto-updates when photos added/deleted

### 5. **Notes & Milestones System**
- Add dated notes with title and description
- Stored in Supabase `notes` table
- Delete individual notes
- Chronological display
- Glass-card styling matching overall theme

### 6. **Timeline Memories**
- Hardcoded timeline data showing relationship milestones
- Styled with emoji markers and dates
- Responsive text sizing

### 7. **Background Elements**
- Animated starfield canvas
- Floating hearts with random motion
- Dark cosmic theme with pink/purple accents

### 8. **Supabase Music Library + Player**
- Upload MP3s to Supabase Storage and save metadata in `music_library`
- Upload modal with optional title (defaults to filename)
- Drag-and-drop MP3 support on the upload form
- Music Library panel with play/delete actions
- Loop toggle (🔁) and auto-advance between songs
- Top-bar progress slider with timecodes and seek support
- Draggable library panel (position saved in localStorage)

---

## 📋 Recent Changes (Commit History)

### **Phase 1: Core Delete Functionality** ✅
**Problem:** Photos kept reappearing after deletion from carousel/polaroids
**Root Cause:** Supabase Row-Level Security (RLS) missing DELETE policy

**Changes Made:**
- Added Supabase RLS DELETE policy: `create policy "Allow anon delete" on public.carousel_photos for delete to anon using (true);`
- Enhanced `deletePhotoFromSupabase()` with `.select()` verification to return deleted row count
- Added extensive console logging for debugging delete operations
- Created `extractStoragePathFromUrl()` helper function to parse Supabase URLs correctly
- Fixed `appendCloudSlidesToCarousel()` to always clear carousel first (prevents stale slides)
- Consolidated delete handlers into `attachCarouselDeleteHandlers()` function

**Result:** Delete operations now work perfectly with verification (`deletedCount: 1` in console)

---

### **Phase 2: UI Polish & Animation Cleanup** ✅
**Problem:** Polaroids had distracting shake animation, needed cleaner interactions

**Changes Made:**
- Removed `@keyframes polaroid-shake` animation definition
- Removed shake animation from `.polaroid:hover` (kept box-shadow glow)
- Improved hover states with subtle pink glow effect
- Moved delete button click handlers into proper event delegation
- Debounced polaroid updates (100ms) to prevent rapid DOM rebuilds

**Result:** Cleaner, more professional UI with better performance

---

### **Phase 3: Image Visibility Improvements** ✅
**Problem:** Photos cropped/cut off in carousel and polaroid gallery

**Changes Made:**

#### Carousel Improvements:
- Changed `.slide` layout: removed flex, added `background: rgba(0, 0, 0, 0.3)` for contrast
- Changed `.slide img` from `object-fit: cover` to `object-fit: contain`
- Added padding directly to images: `padding: clamp(0.5rem, 1.5vw, 1rem)`
- Removed container padding to maximize image viewing area
- Captions remain as overlays (don't interfere with image space)

#### Polaroid Improvements:
- Increased polaroid dimensions:
  - Width: `clamp(140px, 32vw, 200px)` (was 120-180px)
  - Height: `clamp(160px, 35vw, 230px)` (was 140-200px)
- Reduced padding for more image space:
  - `padding: clamp(0.375rem, 1vw, 0.5rem) clamp(0.375rem, 1vw, 0.5rem) clamp(0.5rem, 1.5vw, 0.75rem)`
- Changed `.polaroid img` from `object-fit: cover` to `object-fit: contain`
- Images use `flex: 1` to fill available vertical space

**Result:** Photos now display fully without cropping in both carousel and polaroid sections

---

### **Phase 4: Hardcoded Content Removal** ✅
**Changes Made:**
- Deleted all 5 hardcoded placeholder photos (`photo1.jpg` through `photo5.jpg`)
- Carousel now purely Supabase-driven (no fallback images)
- Empty carousel displays cleanly with no errors

**Result:** Gallery is 100% cloud-based, no local image dependencies

---

### **Phase 4.5: Carousel + Polaroid Layout Tuning** ✅
**Changes Made:**
- Carousel now auto-adjusts height based on the current image’s aspect ratio
- Slide layout updated for better image containment and caption contrast
- Polaroids resized for better visibility and reduced rotation variance
- Responsive layout recalculation avoids unnecessary polaroid rebuilds

**Result:** Cleaner display across image aspect ratios and screen sizes

---

### **Phase 5: Supabase Music Library (MP3 Uploads)** ✅
**Problem:** YouTube embeds were blocked (Error 150), and local MP3s were not shareable.

**Changes Made:**
- Added `music_library` table + `music` storage bucket support
- Built upload flow: upload to Storage, insert metadata into database
- Created Music Library UI (panel with play/delete actions)
- Added loop toggle (🔁) and library hide/show after unlock
- Created [MUSIC_SETUP.md](MUSIC_SETUP.md) with SQL + setup steps

**Result:** Music is now shared across devices via Supabase, with full upload + playback flow

---

### **Phase 6: Music UX Upgrades** ✅
**Changes Made:**
- Added top-bar progress slider with timecodes + seek support
- Added “Now Playing” label and refreshed header controls
- Made Music Library panel draggable (position saved in localStorage)
- Added drag-and-drop MP3 upload support
- Removed hardcoded MP3 playlist entries and local audio files

**Result:** Polished, fully cloud-driven music experience with modern controls

---

### **Phase 7: YouTube Feature Deprecation** ✅
**Changes Made:**
- Replaced YouTube playback flow with Supabase MP3 uploads
- Added [YOUTUBE_REMOVAL.md](YOUTUBE_REMOVAL.md) as a cleanup guide
- Kept `youtube-player.js` as a legacy module (unused)

**Result:** YouTube is no longer required; music is fully owned and shareable

---

## 🛠️ Technical Stack

- **Frontend:** Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Backend:** Supabase (PostgreSQL database + Cloud Storage)
- **Animation:** GSAP 3
- **Authentication:** SHA-256 Web Crypto API
- **Styling:** CSS custom properties, clamp() for responsive sizing, glass-morphism effects

---

## 📂 File Structure

```
valentinesday2026/
├── index.html          # Main HTML structure
├── script.js           # Core JavaScript logic
├── styles.css          # Responsive CSS styling
├── FIREBASE_SETUP.md   # Firebase setup instructions (legacy)
├── SUPABASE_SETUP.md   # Supabase setup guide
├── MUSIC_SETUP.md      # Music library setup (Supabase + RLS)
├── YOUTUBE_REMOVAL.md  # YouTube removal guide (legacy)
├── youtube-player.js   # Legacy YouTube module (unused)
└── README.md           # This file
```

---

## 🗄️ Supabase Schema

### **Table: `carousel_photos`**
```sql
- id (uuid, primary key)
- image_url (text)
- caption (text)
- date (text)
- created_at (timestamp)
```

**RLS Policies:**
- `Allow anon select`: Public read access
- `Allow anon insert`: Public write access
- `Allow anon delete`: Public delete access ✨ (Recently added)

### **Table: `notes`**
```sql
- id (uuid, primary key)
- note_date (text)
- title (text)
- description (text)
- created_at (timestamp)
```

**RLS Policies:**
- `Allow anon select`: Public read access
- `Allow anon insert`: Public write access
- `Allow anon delete`: Public delete access

### **Table: `music_library`**
```sql
- id (uuid, primary key)
- title (text)
- filename (text)
- music_url (text)
- file_size (bigint)
- created_at (timestamp)
```

**RLS Policies:**
- `Allow anon read`: Public read access
- `Allow anon insert`: Public write access
- `Allow anon delete`: Public delete access

### **Storage Bucket: `carousel`**
- Public bucket
- Stores uploaded photos
- File naming: `{timestamp}_{sanitized_filename}`

### **Storage Bucket: `music`**
- Public bucket
- Stores uploaded MP3 files
- Policies (example):
```sql
create policy "Public upload to music"
on storage.objects for insert
to public
with check (bucket_id = 'music');

create policy "Public read music"
on storage.objects for select
to public
using (bucket_id = 'music');
```

---

## 🔧 Configuration

### **Supabase Credentials** (Set in `script.js`)
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### **Music Setup**
- Follow [MUSIC_SETUP.md](MUSIC_SETUP.md) to create the `music_library` table and `music` bucket
- Ensure both table RLS and storage policies allow anonymous read/insert
- The player now pulls tracks exclusively from Supabase (no local MP3s)

### **Upload Password** (Set in `script.js`)
```javascript
const uploadPassword = 'your-upload-password';
```

### **Login Answers** (Hashed in `script.js`)
- Date: 07/04/2022 (example; multiple formats accepted)
- Color: Blue (example)
- Place: Central Park (example)

---

## 🚀 Deployment

### **GitHub Pages**
1. Repository: `https://github.com/9bitbin/valentinesday2026.github.io.git`
2. Branch: `master`
3. Auto-deploys on push

### **Local Development**
```bash
# Navigate to project directory
cd valentinesday2026

# Start a local server (e.g., Five Server, Live Server)
# Open http://localhost:5500 in browser
```

---

## 🐛 Debugging Tips

### **Photos Not Deleting:**
- Check browser console for `deletedCount: 1` message
- Verify Supabase RLS DELETE policy exists
- Check that `.select()` is used after `.delete()` query

### **Photos Not Appearing:**
- Verify Supabase URL and anon key are set
- Check browser console for fetch errors
- Check that bucket is set to public
- Verify RLS SELECT policy exists

### **Upload Failing:**
- Check upload password matches
- Verify storage bucket has INSERT policy
- Check file size limits (default 50MB in Supabase)
- Look for timeout errors (25s timeout configured)

### **Music Upload Failing (RLS or Storage):**
- Ensure `music_library` has anon policies for select/insert/delete
- Ensure `music` storage bucket is public and has INSERT/SELECT policies
- Confirm `music_url` rows are being created in `music_library`
- If you see `new row violates row-level security policy`, recheck RLS on both table and storage

---

## 📝 Code Highlights

### **Delete Verification Pattern**
```javascript
const { data, error } = await supabase
  .from(CAROUSEL_TABLE)
  .delete()
  .eq('id', photoId)
  .select(); // Returns deleted rows for verification

if (!data || data.length === 0) {
  console.warn('WARNING: Delete query ran but no rows were deleted!');
  throw new Error('Photo not found in database');
}
```

### **Debounced Polaroid Updates**
```javascript
let polaroidDebounce;
function updatePolaroidsDebounced() {
  clearTimeout(polaroidDebounce);
  polaroidDebounce = setTimeout(() => {
    createPolaroids();
  }, 100);
}
```

### **Responsive Image Sizing**
```css
.slide img {
  width: 100%;
  height: 100%;
  object-fit: contain; /* Shows full image without cropping */
  padding: clamp(0.5rem, 1.5vw, 1rem); /* Responsive padding */
}
```

---

## 🎨 Design Philosophy

- **Glass-morphism:** Semi-transparent panels with backdrop blur
- **Cosmic Theme:** Dark navy background with pink/purple accents
- **Fluid Typography:** All text uses `clamp()` for responsive sizing
- **Mobile-First:** Responsive at all breakpoints (320px - 4K)
- **Performance:** Debounced updates, efficient DOM manipulation
- **Accessibility:** ARIA labels, semantic HTML, keyboard navigation

---

## 📊 Statistics

- **Supabase Tables:** 3 (`carousel_photos`, `notes`, `music_library`)
- **Storage Buckets:** 2 (`carousel`, `music`)
- **Major Systems:** 9 (login, carousel, polaroids, notes, timeline, background effects, music library, uploads, stats)
- **Music Storage:** Fully cloud-based (no local MP3 dependencies)

---

## 🔮 Future Enhancements (Not Currently Implemented)

- ~~EXIF metadata extraction~~ (Attempted but removed due to complexity)
- Photo editing (crop, rotate, filters)
- Batch photo upload
- Search/filter functionality
- Export timeline as PDF
- Mobile app version
- Real-time collaboration indicators

---

## 💖 Credits

**Created with love by:** Your development team
**For:** A special Valentine's Day 2026 archive
**Built:** February 2026
**Theme Song:** Set by your uploaded music library

---

## 📄 License

Private project - Not for redistribution

---

## 🆘 Support

For issues or questions:
1. Check browser console for error messages
2. Verify Supabase credentials in `script.js`
3. Review Supabase RLS policies
4. Check this README for troubleshooting tips

---

**Last Updated:** February 15, 2026
**Version:** 3.0 (Supabase Music Library + Player UX)
