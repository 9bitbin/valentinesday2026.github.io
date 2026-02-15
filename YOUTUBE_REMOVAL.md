# YouTube Player Feature - Removal Guide

This document provides step-by-step instructions for removing the YouTube music player feature from the Valentine's Day archive.

## Quick Disable (Recommended for Testing)

If you just want to temporarily disable the feature:

1. Open `youtube-player.js`
2. Change line 1 from:
   ```javascript
   const ENABLE_YOUTUBE_PLAYER = true;
   ```
   to:
   ```javascript
   const ENABLE_YOUTUBE_PLAYER = false;
   ```
3. Save the file and refresh the page

The YouTube UI will be hidden and the feature will not load.

---

## Complete Removal (Permanent)

Follow these steps to completely remove the YouTube integration from your codebase:

### Step 1: Delete the JavaScript Module

Delete the following file:
```
youtube-player.js
```

### Step 2: Remove HTML Elements

Open `index.html` and remove the following marked sections:

#### Section 1: Add Song Button (in music controls)
Find and remove these lines (around line 58):
```html
<!-- YOUTUBE PLAYER UI - START -->
<button id="addSongBtn" class="rocker-btn" type="button" aria-label="add YouTube song" title="Add YouTube Song">🎵+</button>
<!-- YOUTUBE PLAYER UI - END -->
```

#### Section 2: Hidden Player Container (before carousel)
Find and remove these lines (around line 63):
```html
<!-- YOUTUBE PLAYER UI - START -->
<div id="youtube-player-container" style="display:none;"></div>
<!-- YOUTUBE PLAYER UI - END -->
```

#### Section 3: YouTube Modal and Queue Panel (near end of file)
Find and remove these lines (around line 145-180):
```html
<!-- YOUTUBE PLAYER UI - START -->
<div id="youtubeModal" class="modal hidden" role="dialog" aria-hidden="true">
    ... (entire modal content) ...
</div>

<div id="youtubeQueue" class="youtube-queue minimized">
    ... (entire queue panel content) ...
</div>
<!-- YOUTUBE PLAYER UI - END -->
```

#### Section 4: Script Tag (before closing body)
Find and remove this line (second-to-last line before `</body>`):
```html
<script src="youtube-player.js"></script>
```

### Step 3: Remove CSS Styles

Open `styles.css` and find the YouTube player styles section (around line 743):

Remove everything between these comment markers:
```css
/* ========== YOUTUBE PLAYER STYLES - START ========== */
... (approximately 275 lines of styles) ...
/* ========== YOUTUBE PLAYER STYLES - END ========== */
```

Also remove the mobile responsive styles for YouTube (around line 1363):
```css
/* YOUTUBE PLAYER - Mobile Responsive */
.youtube-queue {
  ... (mobile styles) ...
}
```

### Step 4: Remove This Documentation (Optional)

Delete this file:
```
YOUTUBE_REMOVAL.md
```

---

## Verification

After removal, verify the feature is completely gone:

1. Refresh the page in your browser (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
2. Check that:
   - No "🎵+" button appears in the music controls
   - No YouTube modal appears when pressing hotkeys
   - No music queue panel on the right side
   - Original music player still works normally
3. Open browser console (F12) and verify no JavaScript errors

---

## Rollback (If Using Git)

If you're using git and want to rollback to the state before YouTube integration:

```bash
git log --oneline  # Find the commit before YouTube integration
git revert <commit-hash>  # Revert the YouTube integration commit
```

Or to restore specific files:
```bash
git checkout HEAD~1 -- index.html styles.css
rm youtube-player.js YOUTUBE_REMOVAL.md
```

---

## What Gets Removed

- **Functionality**: YouTube URL input, video playback via YouTube IFrame API, queue management
- **UI Components**: Add Song button, YouTube modal, queue panel with thumbnails
- **Storage**: localStorage entries for YouTube queue (key: `youtubeQueue`)
- **Code**: ~400 lines of JavaScript, ~275 lines of CSS, ~50 lines of HTML

## What Stays Unchanged

- Original audio player with local music files
- All carousel and photo functionality
- Notes/timeline features
- Login system
- Photo upload/delete
- All existing animations and styling

---

## Technical Details

The YouTube integration was designed as a **modular add-on** with:
- Separate JavaScript file (not integrated into main script.js)
- Clearly marked HTML/CSS sections with comment markers
- Feature toggle for quick disable
- No modifications to existing functionality
- Zero dependencies on existing music player code

This makes removal safe and complete without affecting other features.

---

**Need Help?** If you experience issues after removal, check the browser console for errors and verify all marked sections were properly removed.