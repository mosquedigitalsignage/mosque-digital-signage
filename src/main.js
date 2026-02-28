// main.js - Multi-tenant mosque digital signage display app
// Reads mosque config from Firestore, images from Google Drive

import {
  ayatHadithList,
  CALCULATION_METHODS,
  discoverDriveFolders,
  getSlideshowImages,
  getQrCodeImages,
  getDriveImageUrl,
} from './config.js';

import { initFirebase, fetchMosqueConfig, fetchAllMosques, signInWithGoogle, fetchAdminRecord } from './firebase.js';

// === GLOBAL STATE ===
let mosqueConfig = null;
let mosqueId = null;
let availableImages = [];
let currentIdx = 0;
let rotationCount = 0;
let slideshowInterval = null;
let ayatInterval = null;
let ayatIdx = 0;

// === CACHE KEYS (namespaced by mosque UUID) ===
function cacheKey(suffix) {
  return `mosque_${mosqueId}_${suffix}`;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// === APP INITIALIZATION ===
async function initApp() {
  initFirebase();

  // Parse ?mosque={uuid} from URL
  const params = new URLSearchParams(window.location.search);
  mosqueId = params.get('mosque');

  if (!mosqueId) {
    showMosqueSelector();
    return;
  }

  try {
    mosqueConfig = await fetchMosqueConfig(mosqueId);
  } catch (err) {
    console.error('Failed to fetch mosque config:', err);
    showErrorScreen('Unable to load mosque configuration. Please check your connection and try again.');
    return;
  }

  if (!mosqueConfig) {
    showErrorScreen('Mosque not found. The mosque ID in the URL may be incorrect.');
    return;
  }

  applyConfig();
  await initAllModules();
}

// === APPLY CONFIG TO DOM ===
function applyConfig() {
  const mc = mosqueConfig;

  // Page title
  document.title = mc.mosque?.pageTitle || mc.mosque?.name || 'Mosque Digital Signage';

  // Header text
  const header = document.querySelector('.header');
  if (header) {
    header.textContent = mc.mosque?.headerText || `Welcome to ${mc.mosque?.name || 'Our Mosque'}`;
  }

  // Apply theme via CSS custom properties
  const theme = mc.display?.theme;
  if (theme) {
    const root = document.documentElement;
    if (theme.headerBg) root.style.setProperty('--header-bg', theme.headerBg);
    if (theme.panelBg) root.style.setProperty('--panel-bg', theme.panelBg);
    if (theme.accentColor) root.style.setProperty('--accent-color', theme.accentColor);
    if (theme.textColor) root.style.setProperty('--text-color', theme.textColor);
  }
}

// === INITIALIZE ALL MODULES ===
async function initAllModules() {
  await requestWakeLock();
  detectAndOptimizeForChromecast();
  optimizeForTV();
  renderPrayerTimes();
  initAyatRotation();
  await initDriveContent();
  scheduleReload();
}

// === DEVICE DETECTION ===
function isTVDevice() {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('tv') || ua.includes('leanback') || ua.includes('mosque-digital-signage-tv')
    || window.innerWidth >= 1920;
}

// === MOSQUE SELECTOR SCREEN ===
async function showMosqueSelector() {
  const layout = document.querySelector('.main-layout');
  if (!layout) return;

  const showSignIn = !isTVDevice();

  layout.innerHTML = `
    <div class="selector-screen">
      <h1>Mosque Digital Signage</h1>
      <p>Select your mosque</p>
      ${showSignIn ? `
        <button class="admin-signin-btn" id="admin-signin-btn">Sign in as Admin</button>
        <div class="signin-divider"><span>or browse all mosques</span></div>
      ` : ''}
      <div class="mosque-list" id="mosque-list">
        <p class="loading-text">Loading mosques...</p>
      </div>
    </div>
  `;

  // Set up admin sign-in button
  if (showSignIn) {
    const signinBtn = document.getElementById('admin-signin-btn');
    signinBtn.addEventListener('click', handleAdminSignIn);
  }

  const listEl = document.getElementById('mosque-list');

  try {
    const mosques = await fetchAllMosques();

    if (mosques.length === 0) {
      listEl.innerHTML = '<p>No mosques configured yet. Visit the <a href="admin.html">admin dashboard</a> to set one up.</p>';
      return;
    }

    listEl.innerHTML = '';
    mosques.forEach(m => {
      const card = document.createElement('a');
      card.className = 'mosque-card';
      card.href = `?mosque=${m.id}`;
      card.innerHTML = `
        <div class="mosque-card-name">${m.name}</div>
        ${m.shortName ? `<div class="mosque-card-short">${m.shortName}</div>` : ''}
      `;
      listEl.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load mosques:', err);
    listEl.innerHTML = '<p class="error-text">Failed to load mosques. Please check your connection and try again.</p>';
  }
}

// === ADMIN SIGN-IN (mobile only) ===
async function handleAdminSignIn() {
  const btn = document.getElementById('admin-signin-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Signing in...';
  }

  try {
    const result = await signInWithGoogle();
    const uid = result.user.uid;
    const adminRecord = await fetchAdminRecord(uid);

    if (adminRecord && adminRecord.mosqueId) {
      window.location.href = `?mosque=${adminRecord.mosqueId}`;
    } else {
      if (btn) {
        btn.textContent = 'No mosque found for this account';
        btn.disabled = false;
        setTimeout(() => { btn.textContent = 'Sign in as Admin'; }, 3000);
      }
    }
  } catch (err) {
    console.error('Admin sign-in failed:', err);
    if (btn) {
      btn.textContent = 'Sign-in failed. Try again.';
      btn.disabled = false;
      setTimeout(() => { btn.textContent = 'Sign in as Admin'; }, 3000);
    }
  }
}

// === ERROR SCREEN ===
function showErrorScreen(message) {
  const layout = document.querySelector('.main-layout');
  if (!layout) return;

  layout.innerHTML = `
    <div class="error-screen">
      <h1>Mosque Digital Signage</h1>
      <div class="error-message">${message}</div>
      <a href="?" class="error-link">Browse all mosques</a>
    </div>
  `;
}

// === GOOGLE DRIVE CONTENT LOADING ===
async function initDriveContent() {
  const rootFolderId = mosqueConfig?.googleDrive?.rootFolderId;
  if (!rootFolderId) {
    console.log('No Google Drive folder configured, using placeholder content.');
    showPlaceholderSlideshow();
    return;
  }

  try {
    // Check localStorage cache first
    const cached = getCachedDriveContent();
    if (cached) {
      applyDriveContent(cached);
      return;
    }

    // Discover folder structure
    const folders = await discoverDriveFolders(rootFolderId);

    const content = {
      slideshowImages: [],
      qrCodes: [],
      backgroundFileId: folders.backgroundFileId,
    };

    // Fetch slideshow images
    if (folders.slideshowFolderId) {
      content.slideshowImages = await getSlideshowImages(folders.slideshowFolderId);
    }

    // Fetch QR codes
    if (folders.qrCodesFolderId) {
      content.qrCodes = await getQrCodeImages(folders.qrCodesFolderId);
    }

    // Cache the results
    cacheDriveContent(content);
    applyDriveContent(content);
  } catch (err) {
    console.error('Failed to load Drive content:', err);
    showPlaceholderSlideshow();
  }
}

function getCachedDriveContent() {
  try {
    const raw = localStorage.getItem(cacheKey('drive_content'));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.timestamp > CACHE_DURATION) {
      localStorage.removeItem(cacheKey('drive_content'));
      return null;
    }
    return data.content;
  } catch {
    return null;
  }
}

function cacheDriveContent(content) {
  try {
    localStorage.setItem(cacheKey('drive_content'), JSON.stringify({
      timestamp: Date.now(),
      content,
    }));
  } catch (err) {
    console.warn('Failed to cache Drive content:', err);
  }
}

function applyDriveContent(content) {
  // Background image — use a positioned <img> element (avoids CORS issues with CSS url())
  if (content.backgroundFileId) {
    const bgUrl = getDriveImageUrl(content.backgroundFileId);
    const bgImg = document.createElement('img');
    bgImg.referrerPolicy = 'no-referrer';
    bgImg.src = bgUrl;
    bgImg.alt = '';
    bgImg.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:-1;pointer-events:none;';
    document.body.prepend(bgImg);
  }

  // Slideshow
  if (content.slideshowImages && content.slideshowImages.length > 0) {
    availableImages = content.slideshowImages.map(img => img.url);
    currentIdx = 0;
    showImage(currentIdx);
    startSlideshowInterval();
    renderMobileGallery(availableImages);
  } else {
    showPlaceholderSlideshow();
  }

  // QR Codes
  if (content.qrCodes && content.qrCodes.length > 0) {
    renderQrCodes(content.qrCodes);
  } else {
    renderQrCodesPlaceholder();
  }
}

// === SLIDESHOW ===
const imgEl = document.getElementById('slideshow-img');

function showImage(idx) {
  if (availableImages.length === 0 || !imgEl) return;

  imgEl.style.opacity = 0;
  setTimeout(() => {
    imgEl.setAttribute('referrerpolicy', 'no-referrer');
    imgEl.src = availableImages[idx];
    imgEl.onload = () => { imgEl.style.opacity = 1; };
    imgEl.onerror = () => {
      console.warn('Image failed to load:', availableImages[idx]);
      imgEl.style.opacity = 0.2;
    };
  }, 300);
}

function nextImage() {
  if (availableImages.length === 0) return;

  if (currentIdx === availableImages.length - 1) {
    rotationCount++;
    // After a full rotation, refresh from Drive
    refreshDriveImages();
  }

  currentIdx = (currentIdx + 1) % availableImages.length;
  showImage(currentIdx);
}

function startSlideshowInterval() {
  if (slideshowInterval) clearInterval(slideshowInterval);
  const interval = mosqueConfig?.display?.slideshowIntervalMs || 8000;
  slideshowInterval = setInterval(nextImage, interval);
}

async function refreshDriveImages() {
  const rootFolderId = mosqueConfig?.googleDrive?.rootFolderId;
  if (!rootFolderId) return;

  try {
    localStorage.removeItem(cacheKey('drive_content'));
    const folders = await discoverDriveFolders(rootFolderId);
    if (folders.slideshowFolderId) {
      const freshImages = await getSlideshowImages(folders.slideshowFolderId);
      if (freshImages.length > 0) {
        availableImages = freshImages.map(img => img.url);
        if (currentIdx >= availableImages.length) {
          currentIdx = 0;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to refresh Drive images:', err);
  }
}

function showPlaceholderSlideshow() {
  if (!imgEl) return;
  imgEl.style.display = 'none';
  const slideshow = document.querySelector('.slideshow');
  if (slideshow && !slideshow.querySelector('.placeholder-text')) {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder-text';
    placeholder.textContent = 'No slideshow images configured. Add images to Google Drive.';
    slideshow.appendChild(placeholder);
  }
}

// === MOBILE GALLERY ===
function renderMobileGallery(imageUrls) {
  const slideshow = document.querySelector('.slideshow');
  if (!slideshow) return;

  const gallery = document.createElement('div');
  gallery.className = 'slideshow-gallery';
  imageUrls.forEach(url => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Slideshow';
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.loading = 'lazy';
    gallery.appendChild(img);
  });
  slideshow.appendChild(gallery);
}

// === QR CODES ===
function renderQrCodes(qrCodes) {
  const qrList = document.querySelector('.qr-list');
  if (!qrList) return;

  qrList.innerHTML = '';
  qrCodes.forEach(qr => {
    const wrapper = document.createElement('div');
    wrapper.className = 'qr-wrapper';

    const label = document.createElement('div');
    label.className = 'qr-label';
    label.textContent = qr.label;

    const img = document.createElement('img');
    img.className = 'qr-img';
    img.alt = qr.label;
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.src = qr.url;
    img.onerror = () => {
      img.style.display = 'none';
      const fallback = document.createElement('div');
      fallback.className = 'qr-fallback';
      fallback.textContent = `QR: ${qr.label}`;
      wrapper.appendChild(fallback);
    };

    wrapper.appendChild(label);
    wrapper.appendChild(img);
    qrList.appendChild(wrapper);
  });
}

function renderQrCodesPlaceholder() {
  const qrList = document.querySelector('.qr-list');
  if (!qrList) return;
  qrList.innerHTML = '<div class="placeholder-text">No QR codes configured.</div>';
}

// === PRAYER TIMES ===
function renderPrayerTimes() {
  const prayerList = document.getElementById('prayer-times-list');
  if (!prayerList) return;

  prayerList.innerHTML = '';

  const zipcode = mosqueConfig?.location?.zipcode || '10001';
  const country = mosqueConfig?.location?.country || 'US';
  const methodName = mosqueConfig?.prayerTimes?.calculationMethod || 'ISNA';
  const method = CALCULATION_METHODS[methodName] || 2;

  fetch(`https://api.aladhan.com/v1/timingsByAddress?address=${zipcode},${country}&method=${method}`)
    .then(res => res.json())
    .then(data => {
      const times = data.data.timings;
      const prayerOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

      prayerOrder.forEach(name => {
        let time = times[name];
        if (time) {
          // Remove timezone suffix like " (EST)"
          time = time.replace(/\s*\(.*\)$/, '');
          let [h, m] = time.split(':');
          let hour = parseInt(h, 10);
          let ampm = 'AM';
          if (hour === 0) { hour = 12; }
          else if (hour === 12) { ampm = 'PM'; }
          else if (hour > 12) { hour -= 12; ampm = 'PM'; }
          time = `${hour}:${m} ${ampm}`;
        }
        const li = document.createElement('li');
        li.textContent = `${name}: ${time}`;
        li.className = 'prayer-time-item';
        prayerList.appendChild(li);
      });

      // Jummah time from config
      const jummahTime = mosqueConfig?.prayerTimes?.jummahTime;
      if (jummahTime) {
        const jummahLi = document.createElement('li');
        jummahLi.textContent = `Jummah: ${jummahTime}`;
        jummahLi.className = 'prayer-time-item';
        prayerList.appendChild(jummahLi);
      }
    })
    .catch(() => {
      // Fallback times from config or defaults
      const fallback = mosqueConfig?.prayerTimes?.fallbackTimes || {
        Fajr: '5:30 AM', Dhuhr: '1:00 PM', Asr: '4:30 PM', Maghrib: '7:00 PM', Isha: '8:30 PM',
      };

      Object.entries(fallback).forEach(([name, time]) => {
        const li = document.createElement('li');
        li.textContent = `${name}: ${time}`;
        li.className = 'prayer-time-item';
        prayerList.appendChild(li);
      });

      const jummahTime = mosqueConfig?.prayerTimes?.jummahTime;
      if (jummahTime) {
        const jummahLi = document.createElement('li');
        jummahLi.textContent = `Jummah: ${jummahTime}`;
        jummahLi.className = 'prayer-time-item';
        prayerList.appendChild(jummahLi);
      }
    });
}

// === AYAT/HADITH ROTATION ===
function initAyatRotation() {
  const ayatsContent = document.getElementById('ayats-content');
  if (!ayatsContent) return;

  // Priority: enabled announcements > custom ayats > default ayat list
  const enabledAnnouncements = (mosqueConfig?.announcements || []).filter(a => a.enabled);
  const ayatsEl = document.querySelector('.ayats');
  const layoutEl = document.querySelector('.main-layout');
  let list;

  const mobileAnn = document.getElementById('mobile-announcement');

  if (enabledAnnouncements.length > 0) {
    list = enabledAnnouncements.map(a => ({ en: a.text }));
    const annColor = mosqueConfig?.display?.announcementColor || mosqueConfig?.display?.theme?.accentColor || '#3b82f6';
    if (ayatsEl) {
      ayatsEl.classList.add('has-announcements');
      ayatsEl.style.setProperty('--announcement-color', annColor);
    }
    if (layoutEl) layoutEl.classList.add('has-announcements-layout');
    if (mobileAnn) {
      mobileAnn.style.display = '';
      mobileAnn.style.setProperty('--announcement-color', annColor);
    }
  } else {
    if (mobileAnn) mobileAnn.style.display = 'none';
    if (ayatsEl) ayatsEl.classList.remove('has-announcements');
    if (layoutEl) layoutEl.classList.remove('has-announcements-layout');
    if (mosqueConfig?.customAyats && mosqueConfig.customAyats.length > 0) {
      list = mosqueConfig.customAyats;
    } else {
      list = ayatHadithList;
    }
  }

  ayatIdx = 0;

  function showAyat(idx) {
    const ayat = list[idx];
    const en = ayat.en.replace(/[.]+(?=\s*\()/, '');
    ayatsContent.innerHTML = `<div class="ayat-text">${en}</div>`;
    if (mobileAnn && enabledAnnouncements.length > 0) {
      mobileAnn.textContent = en;
    }
  }

  showAyat(ayatIdx);

  const interval = mosqueConfig?.display?.ayatRotationIntervalMs || 20000;
  if (ayatInterval) clearInterval(ayatInterval);
  ayatInterval = setInterval(() => {
    ayatIdx = (ayatIdx + 1) % list.length;
    showAyat(ayatIdx);
  }, interval);
}

// === WAKE LOCK ===
let wakeLock = null;
let keepAliveInterval = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        setTimeout(requestWakeLock, 1000);
      });
    } else {
      startKeepAlive();
    }
  } catch {
    startKeepAlive();
  }
}

function startKeepAlive() {
  keepAliveInterval = setInterval(() => {
    document.dispatchEvent(new Event('mousemove'));
    const header = document.querySelector('.header');
    if (header) header.style.transform = 'translateZ(0)';
  }, 30000);

  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) requestWakeLock();
});

window.addEventListener('focus', () => requestWakeLock());

// === TV/CHROMECAST DETECTION ===
function detectAndOptimizeForChromecast() {
  if (window.innerWidth >= 1920 || window.innerHeight >= 1080) {
    optimizeForTVDisplay();
  }
}

function optimizeForTVDisplay() {
  document.body.style.fontSize = window.innerWidth >= 3840 ? '32px' : '24px';
  const slideshow = document.querySelector('.slideshow img');
  if (slideshow) {
    slideshow.style.borderRadius = '16px';
    slideshow.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.6)';
  }
}

function optimizeForTV() {
  const isTV = window.innerWidth >= 1920;
  if (!isTV) return;

  const aspectRatio = window.innerWidth / window.innerHeight;
  const root = document.documentElement;

  if (aspectRatio <= 16 / 9) {
    root.style.setProperty('--header-height', '10vh');
    root.style.setProperty('--ayats-height', '10vh');
    root.style.setProperty('--content-height', '70vh');
    root.style.setProperty('--gap', '2vh');
    root.style.setProperty('--padding', '2vh');
  } else {
    root.style.setProperty('--header-height', '8vh');
    root.style.setProperty('--ayats-height', '8vh');
    root.style.setProperty('--content-height', '74vh');
    root.style.setProperty('--gap', '2vh');
    root.style.setProperty('--padding', '2vh');
  }
}

window.addEventListener('resize', optimizeForTV);

// === AUTO-RELOAD AT MIDNIGHT ===
function scheduleReload() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const timeUntilMidnight = tomorrow - now;
  setTimeout(() => window.location.reload(), timeUntilMidnight);
}

// === VIEWPORT LOCKING ===
function lockViewportDimensions() {
  document.documentElement.style.transform = 'none';
  document.body.style.transform = 'none';
}

window.addEventListener('load', lockViewportDimensions);

// === BOOT ===
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
