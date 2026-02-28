# Release Notes

## v1.4.1 (2026.02.28)

**What's New:**
- Fixed Google sign-in (CSP policy now allows Firebase Auth domains)
- Fixed Drive images failing to load (CSP now allows googleusercontent.com)

**Play Store "What's New" (paste into Play Console):**
Fixed Google sign-in and mosque display images not loading.

---

## v1.4 (2026.02.28)

**What's New:**
- Security hardening: XSS vulnerabilities fixed in announcements, ayat text, and mosque name display
- Superuser access now verified via Firestore role instead of hardcoded email
- URL parameter validation prevents malformed mosque IDs from querying Firestore
- WebView blocks mixed HTTP/HTTPS content (MIXED_CONTENT_NEVER_ALLOW)
- Android network security config enforces HTTPS-only traffic
- Content Security Policy headers added to web app

**Play Store "What's New" (paste into Play Console):**
Security update: hardened against XSS, enforced HTTPS-only traffic, and improved input validation throughout the app.

---

## v1.3.1 (2026.02.28)

**What's New:**
- Android TV remote BACK button now returns to mosque selector from display
- Short press BACK on display goes to selector; on selector exits the app
- Long-press BACK (3s) still resets saved mosque as before

**Play Store "What's New" (paste into Play Console):**
TV remote BACK button now returns to mosque selector from the display screen. Sign in with Google, manage multiple mosques, link by UUID, and enjoy the redesigned modern selector. Your mosque auto-loads on future launches.

---

## v1.3 (2026.02.28)

**What's New:**
- Sign in with Google to see your mosques — no more manual setup
- Multi-mosque support: manage and switch between multiple mosques from one account
- New post-login dashboard showing all your linked mosques
- Link any mosque by UUID directly from the selector screen
- Redesigned selector with modern card-based layout and mosque icon branding
- Back button on display header to return to mosque selector
- Mosque icon added to landing page, admin sign-in, and create mosque screens
- Super-admin view for platform-wide mosque management
- On TV, your selected mosque auto-loads on future launches — sign in only once

**Data Model:**
- Admin records migrated from `mosqueId` (string) to `mosqueIds` (array)
- Firestore rules updated to check `mosqueIds` array membership
- Backwards compatible: old `mosqueId` records auto-normalize at runtime

**Play Store "What's New" (paste into Play Console):**
Sign in with Google to see all your mosques in one place. Multi-mosque support lets you manage and switch between multiple mosques. Link any mosque by UUID. Redesigned modern selector with mosque branding. Back button to return to mosque list. On TV, your mosque auto-loads on future launches — sign in only once.

---

## v1.2 (2026.02.27)

**What's New:**
- Admin sign-in with Google on mobile to auto-detect mosque
- Mobile and tablet device support alongside Android TV
- Sign-in required on all devices to show only the admin's mosque

---

## v1.1.1 (2026.02.26)

**What's New:**
- Target API level 35 for Play Store requirement

---

## v1.1 (2026.02.25)

**What's New:**
- Enabled mobile and tablet support alongside Android TV
- App now runs on phones, tablets, and TV devices

---

## v1.0 (2026.02.24)

**Initial Release:**
- Android TV wrapper app for Mosque Digital Signage web platform
- WebView-based display with full-screen prayer times, slideshow, QR codes, and ayat rotation
- Mosque selector on first launch with SharedPreferences persistence
- Long-press BACK (3s) to re-show mosque picker
- MENU/SETTINGS key opens server URL config dialog
- Wake lock and auto-reload at midnight
- Signed release build for Play Store distribution
