# System Architecture

```mermaid
graph TD
    subgraph Devices["Devices / Clients"]
        TV["📺 Android TV App\n(WebView wrapper)"]
        Cast["📡 Chromecast / Browser\n(Public Display)"]
        AdminUI["🖥️ Admin Browser\n(admin.html)"]
    end

    subgraph Web["GitHub Pages (mosquedigitalsignage.github.io)"]
        Display["index.html + main.js\nDisplay App"]
        AdminApp["admin.html + admin.js\nAdmin Dashboard"]
    end

    subgraph FirebaseBlock["Firebase"]
        Auth["Firebase Auth\n(Google OAuth)"]
        FS[("Firestore\n─────────────\nmosques/{uuid}\n  mosque, location,\n  prayerTimes,\n  googleDrive, display,\n  announcements\n─────────────\nadmins/{uid}\n  mosqueIds[], role")]
    end

    subgraph GoogleBlock["Google"]
        DriveAPI["Drive API v3"]
        Drive[("Google Drive\n─────────────\nRoot Folder/\n├── slideshow/\n├── qr-codes/\n└── background.*")]
        GCS["*.googleusercontent.com\n(image CDN)"]
    end

    Aladhan["🕌 Aladhan API\naladhan.com\n(Prayer Times)"]
    Prefs[("SharedPreferences\nselected mosque ID")]

    %% Device → Web
    TV -->|"loads ?mosque=uuid\nor selector"| Display
    Cast -->|"?mosque=uuid"| Display
    AdminUI --> AdminApp

    %% Display data flow
    Display -->|"read mosques/{uuid}"| FS
    Display -->|"discover folders"| DriveAPI
    DriveAPI -->|"list files"| Drive
    Drive -->|"thumbnail redirect"| GCS
    GCS -->|"images"| Display
    Display -->|"timingsByAddress"| Aladhan

    %% Admin data flow
    AdminApp -->|"sign in"| Auth
    Auth -->|"read admins/{uid}"| FS
    AdminApp -->|"read/write mosques/{uuid}"| FS

    %% TV persistence
    TV <-->|"save/load mosque ID"| Prefs

    %% Cache
    Display <-->|"24h cache\n(localStorage)"| Cache[("LocalStorage\nDrive content")]
```

## Data Flow Summary

### Display (Public, No Auth)
1. URL `?mosque={uuid}` → fetch `mosques/{uuid}` from Firestore
2. Firestore config → discover Google Drive folder structure via Drive API v3
3. Drive thumbnails → redirect to `*.googleusercontent.com` → rendered as slideshow / QR codes / background
4. Zipcode + country → Aladhan API → prayer times
5. Drive content cached in LocalStorage for 24h; refreshed after each full slideshow rotation

### Admin Dashboard (Auth Required)
1. Google OAuth via Firebase Auth
2. Auth UID → `admins/{uid}` → resolves linked `mosqueIds[]`
3. Admin reads/writes `mosques/{uuid}` in Firestore
4. Changes reflect on the display immediately (no deploy needed)

### Android TV App
1. First launch: loads selector screen, user signs in and picks a mosque
2. Mosque UUID saved to SharedPreferences → auto-loaded on future launches
3. Long-press BACK (3s): clears saved mosque, shows selector again
4. MENU/SETTINGS key: opens server URL config dialog (for self-hosting)
5. Sign-in uses `signInWithRedirect` (WebView has no popup support)

## Firestore Data Model

```
mosques/{uuid}
├── mosque:       { name, shortName, headerText, pageTitle }
├── location:     { zipcode, country, timezone }
├── prayerTimes:  { calculationMethod, jummahTime, fallbackTimes }
├── googleDrive:  { rootFolderId }
├── display:      { slideshowIntervalMs, ayatRotationIntervalMs, theme{}, announcementColor }
├── announcements: [{ text, enabled }]
└── customAyats:  [{ en }]

admins/{uid}
├── mosqueIds:  string[]   (array of mosque UUIDs)
├── email:      string
└── role:       "mosque_admin" | "platform_admin"
```

## Security

| Layer | Mechanism |
|-------|-----------|
| Firestore read | Public (`allow read: if true`) — UUID is the access token |
| Firestore write | Auth required + `mosqueId in adminRecord.mosqueIds` |
| Superuser | `role: "platform_admin"` in `admins/{uid}` (Firestore-controlled) |
| XSS | All user-sourced strings use `textContent` / `escapeHtml()` |
| CSP | `Content-Security-Policy` meta tag on both HTML pages |
| Android network | `network_security_config.xml` — HTTPS only, localhost exception |
| WebView | `MIXED_CONTENT_NEVER_ALLOW` |
