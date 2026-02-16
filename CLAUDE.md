# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mosque Digital Signage is a generic, multi-tenant digital signage platform for mosques. It displays prayer times, a rotating image slideshow, QR codes, and Islamic quotes on Chromecast devices, Android TV, and web browsers. Each mosque self-configures via an admin dashboard; display data comes from Firestore and Google Drive.

**Multi-tenant:** Each mosque gets a unique UUID. Display URL: `?mosque={uuid}`. No per-mosque code changes needed.

## Build & Development Commands

```bash
npm run dev            # Start Vite dev server (port 5173, auto-opens browser, network-accessible)
npm run build          # Build production bundle to dist/
npm run deploy         # Deploy dist/ to GitHub Pages via gh-pages
npm run build-deploy   # Build + deploy in one step
npm run preview        # Preview production build locally
```

## Architecture

**Stack:** Vanilla JavaScript (ES modules), Vite 7.1.0, Firebase (Auth + Firestore via CDN), Google Drive API v3, deployed to GitHub Pages with `gh-pages`.

### Source Files

- `index.html` — Display app entry point; loads Firebase CDN (app + firestore)
- `admin.html` — Admin dashboard entry point; loads Firebase CDN (app + auth + firestore)
- `src/main.js` — Display app logic (~550 lines): config loading, Drive content, slideshow, prayer times, ayat rotation, wake lock, TV optimization
- `src/admin.js` — Admin dashboard: Google sign-in, mosque creation/editing, Firestore CRUD
- `src/config.js` — Google Drive API utilities, calculation methods, default ayat/hadith data (40 items)
- `src/firebase.js` — Firebase initialization, Firestore/Auth helper functions
- `src/style.css` — Display app styles with CSS custom properties for theming, selector/error screens, TV-responsive media queries
- `src/admin.css` — Admin dashboard dark theme styles
- `vite.config.js` — Multi-page build (index.html + admin.html), base path `/mosque-digital-signage/`
- `firestore.rules` — Firestore security rules (public reads, auth-scoped writes)

### Key Functional Modules in main.js

1. **App Init** — Parses `?mosque={uuid}` URL param, fetches config from Firestore, shows selector if missing, error if not found
2. **Config Application** — Sets page title, header text, and CSS custom properties from Firestore theme config
3. **Google Drive Content** — Discovers folder structure (slideshow/, qr-codes/, background.*) from a root folder ID, fetches image lists
4. **Slideshow** — Rotates Drive images at configurable interval (default 8s); refreshes from Drive after each full rotation
5. **QR Codes** — Up to 4 from Drive qr-codes/ folder; filename (minus extension) = display label, sorted alphabetically
6. **Prayer Times** — Fetches from Aladhan API using zipcode/country/method from Firestore config; has configurable fallback times
7. **Ayat/Hadith Rotation** — Cycles through 40 curated quotes at configurable interval (default 20s)
8. **TV/Chromecast Detection** — Auto-detects display environment and optimizes viewport, fonts, layout
9. **Wake Lock** — Prevents device sleep using Wake Lock API with fallbacks
10. **Auto-Reload** — Schedules page reload at midnight daily

### Data Flow

```
URL ?mosque={uuid}
  → Firestore: mosques/{uuid} → config (name, zipcode, drive folder, theme, etc.)
  → Aladhan API: prayer times using config zipcode + method
  → Google Drive API: discover folders → list images → display
  → CSS custom properties: theme colors from config
  → LocalStorage: cache Drive content 24h, namespaced by mosque UUID
```

### Firestore Data Model

- `mosques/{uuid}` — Mosque config: mosque info, location, prayer times, Google Drive folder ID, display theme
- `admins/{firebase-uid}` — Admin-to-mosque mapping: mosqueId, email, role

### Google Drive Folder Structure (Per Mosque)

```
Root Folder/
├── slideshow/          ← Announcement images (unlimited)
├── qr-codes/           ← Max 4 QR code images (filename = label)
└── background.*        ← Background image (single file)
```

### Caching Strategy

Single-tier LocalStorage cache namespaced by mosque UUID (`mosque_{uuid}_drive_content`). Drive folder listings cached for 24 hours. After a complete slideshow rotation, cache is cleared and images are re-fetched from Drive.

### CSS Theming

CSS custom properties set as defaults in `:root` and overridden at runtime from Firestore config:
- `--header-bg` — Header and footer background
- `--panel-bg` — Content panel backgrounds
- `--accent-color` — Accent color (headings, QR labels, ayat border)
- `--text-color` — Primary text color

### Android TV Wrapper

`android-tv-wrapper/` contains a Kotlin/Gradle native Android TV app (package `com.mosquesignage.tv`, target SDK 34) that wraps the web app in a full-screen WebView with:
- **First-launch mosque picker:** Loads the web selector screen; saves chosen mosque UUID to SharedPreferences
- **Persistent selection:** On subsequent launches, loads `{WEB_URL}?mosque={savedUUID}` directly
- **Long-press BACK (3s):** Re-shows mosque picker to change selection
- D-pad navigation and wake lock support

## Layout Structure

Three-row flex layout filling the viewport:
- **Header** (60px): Welcome banner (text from Firestore config)
- **Content Row**: Three columns — Prayer Times (flex:1) | Slideshow (flex:2) | QR Codes (flex:1)
- **Footer** (60px): Rotating ayat/hadith display

## Placeholders to Replace Before Deploying

1. `src/firebase.js` — `YOUR_FIREBASE_API_KEY`, `YOUR_PROJECT_ID`, `YOUR_SENDER_ID`, `YOUR_APP_ID`
2. `src/config.js` — `YOUR_GOOGLE_DRIVE_API_KEY`
3. `android-tv-wrapper/app/build.gradle` — `YOUR_ORG` in `WEB_URL`
