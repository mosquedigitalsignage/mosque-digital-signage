# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant digital signage platform for mosques. Displays prayer times, rotating image slideshow, QR codes, and Islamic quotes on Chromecast/Android TV/web browsers. Each mosque self-configures via an admin dashboard (`admin.html`); display data comes from Firestore and Google Drive.

**Multi-tenant:** Each mosque gets a unique UUID. Display URL: `?mosque={uuid}`. No per-mosque code changes needed.

## Build & Development Commands

```bash
npm run dev            # Start Vite dev server (port 5173, auto-opens browser, network-accessible)
npm run build          # Build production bundle to dist/
npm run deploy         # Deploy dist/ to GitHub Pages via gh-pages
npm run build-deploy   # Build + deploy in one step
npm run preview        # Preview production build locally
```

No linter or test runner is configured. No TypeScript.

## Architecture

**Stack:** Vanilla JavaScript (ES modules), Vite, Firebase (Auth + Firestore), Google Drive API v3, deployed to GitHub Pages.

### Two Entry Points (Multi-Page Vite Build)

The app has two independent pages configured in `vite.config.js`:
- **`index.html` → `src/main.js`** — Public display app (no auth required). Firebase loads only `firebase-app-compat.js` + `firebase-firestore-compat.js`.
- **`admin.html` → `src/admin.js`** — Admin dashboard (Google sign-in). Firebase loads app + auth + firestore compat scripts.

Shared modules: `src/firebase.js` (Firebase init, Firestore/Auth helpers), `src/config.js` (Drive API utilities, calculation methods, 40 default ayat/hadith).

### Firebase: CDN Compat Mode (Not Modular SDK)

Firebase is loaded via CDN `<script>` tags in the HTML files (v10.12.0 compat), **not** via npm. The global `firebase` object is used directly. `src/firebase.js` wraps it with helper functions (`initFirebase()`, `getDb()`, `getAuth()`, `fetchMosqueConfig()`, etc.). Do not import from `firebase/app` or `firebase/firestore` — use the compat API pattern.

### Google Drive Image Loading

Images are served via `https://drive.google.com/thumbnail?id={fileId}&sz=w1600` to avoid CORS issues (CSS `url()` and direct file downloads are blocked). Background images use a positioned `<img>` element instead of CSS `background-image` for the same reason. All Drive image elements must set `referrerpolicy="no-referrer"`.

### Data Flow

```
URL ?mosque={uuid}
  → Firestore: mosques/{uuid} → config (name, zipcode, drive folder, theme, etc.)
  → Aladhan API: prayer times via zipcode + country + calculation method
  → Google Drive API: discover folder structure → list images → display via thumbnail URLs
  → CSS custom properties: theme colors from Firestore config
  → LocalStorage: cache Drive content 24h, namespaced by mosque UUID
```

### Firestore Data Model

- `mosques/{uuid}` — Full mosque config: `mosque{}`, `location{}`, `prayerTimes{}`, `googleDrive{}`, `display{}`
- `admins/{firebase-uid}` — Admin-to-mosque mapping: `mosqueId`, `email`, `role`

Security rules (`firestore.rules`): mosques are publicly readable; writes require auth and ownership check via admin record lookup.

### Google Drive Folder Structure (Per Mosque)

```
Root Folder/                ← ID stored in Firestore config as googleDrive.rootFolderId
├── slideshow/              ← Announcement images (unlimited)
├── qr-codes/               ← Max 4 QR code images (filename minus extension = display label)
└── background.*            ← Single background image file
```

Folders must be shared as "Anyone with the link" (Viewer). Folder discovery happens in `config.js:discoverDriveFolders()`.

### Caching

LocalStorage cache keyed as `mosque_{uuid}_drive_content` with 24-hour TTL. Cache is cleared and re-fetched from Drive after each complete slideshow rotation.

### CSS Theming

CSS custom properties in `:root` are overridden at runtime from Firestore `display.theme` config:
`--header-bg`, `--panel-bg`, `--accent-color`, `--text-color`

### Display Layout

Three-row flex layout: Header (60px) | Content Row (Prayer Times flex:1 | Slideshow flex:2 | QR Codes flex:1) | Footer/Ayat (60px). TV optimization triggers at viewport width >= 1920px.

### Announcements & Custom Ayats

Footer bar priority chain: enabled announcements > custom ayats > default `ayatHadithList` (40 items in `config.js`). Announcements get bold styling with customizable color (`display.announcementColor`). On mobile, announcements show in a banner below the header instead of the footer.

### Android TV Wrapper

`android-tv-wrapper/` — Kotlin/Gradle Android TV app (package `com.mosquesignage.tv`, SDK 34) wrapping the web app in a WebView. First launch shows mosque picker; selection persists in SharedPreferences. Long-press BACK (3s) re-shows picker. MENU/SETTINGS key opens server URL config dialog. Release signing via `keystore.properties` (gitignored).

## Firebase Project

- **Project ID:** `mosque-signage-platform-8e2d3`
- **Firestore rules deploy:** `firebase deploy --only firestore:rules --project mosque-signage-platform-8e2d3`

## Deployment Notes

- GitHub Pages base path: `/mosque-digital-signage/` (set in `vite.config.js`)
- Privacy policy: `privacy.html` (deployed to GitHub Pages, used in Play Store listing)
- Android TV release build: `cd android-tv-wrapper && ./gradlew bundleRelease` (requires `keystore.properties`)
