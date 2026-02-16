// admin.js - Admin dashboard for mosque configuration

import {
  initFirebase,
  getAuth,
  signInWithGoogle,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  fetchAdminRecord,
  fetchMosqueConfig,
  createMosque,
  createAdminRecord,
  updateMosque,
} from './firebase.js';

// === SCREENS ===
const screens = {
  signIn: document.getElementById('sign-in-screen'),
  loading: document.getElementById('loading-screen'),
  newMosque: document.getElementById('new-mosque-screen'),
  dashboard: document.getElementById('dashboard-screen'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => { if (s) s.style.display = 'none'; });
  if (screens[name]) screens[name].style.display = '';
}

// === STATE ===
let currentUser = null;
let adminRecord = null;
let mosqueConfig = null;
let mosqueId = null;

// === INIT ===
function init() {
  initFirebase();

  // Sign-in button
  document.getElementById('google-sign-in-btn')?.addEventListener('click', async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign-in failed:', err);
    }
  });

  // Sign-out button
  document.getElementById('sign-out-btn')?.addEventListener('click', async () => {
    await firebaseSignOut();
    showScreen('signIn');
  });

  // Listen for auth state
  onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      showScreen('loading');
      await loadAdminData();
    } else {
      currentUser = null;
      adminRecord = null;
      mosqueConfig = null;
      mosqueId = null;
      showScreen('signIn');
    }
  });

  // New mosque form
  document.getElementById('new-mosque-form')?.addEventListener('submit', handleCreateMosque);

  // Edit mosque form
  document.getElementById('edit-mosque-form')?.addEventListener('submit', handleSaveChanges);

  // Preview button
  document.getElementById('preview-btn')?.addEventListener('click', () => {
    if (mosqueId) {
      const baseUrl = window.location.origin + window.location.pathname.replace(/\/admin\.html$/, '/');
      window.open(`${baseUrl}?mosque=${mosqueId}`, '_blank');
    }
  });

  // Copy URL button
  document.getElementById('copy-url-btn')?.addEventListener('click', () => {
    const urlInput = document.getElementById('dash-display-url');
    if (urlInput) {
      navigator.clipboard.writeText(urlInput.value).then(() => {
        const btn = document.getElementById('copy-url-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    }
  });
}

// === LOAD ADMIN DATA ===
async function loadAdminData() {
  try {
    adminRecord = await fetchAdminRecord(currentUser.uid);

    if (adminRecord && adminRecord.mosqueId) {
      // Existing admin - load their mosque
      mosqueId = adminRecord.mosqueId;
      mosqueConfig = await fetchMosqueConfig(mosqueId);
      if (mosqueConfig) {
        populateDashboard();
        showScreen('dashboard');
      } else {
        // Mosque record was deleted - show creation form
        showScreen('newMosque');
      }
    } else {
      // New admin - show creation form
      showScreen('newMosque');
    }
  } catch (err) {
    console.error('Failed to load admin data:', err);
    showScreen('newMosque');
  }
}

// === CREATE MOSQUE ===
async function handleCreateMosque(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';

  try {
    // Generate UUID
    mosqueId = crypto.randomUUID();

    const config = {
      id: mosqueId,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.uid,
      mosque: {
        name: document.getElementById('nm-name').value,
        shortName: document.getElementById('nm-short-name').value,
        headerText: document.getElementById('nm-header').value || `Welcome to ${document.getElementById('nm-name').value}`,
        pageTitle: document.getElementById('nm-page-title').value || `${document.getElementById('nm-name').value} Display`,
      },
      location: {
        zipcode: document.getElementById('nm-zipcode').value,
        country: document.getElementById('nm-country').value || 'US',
        timezone: document.getElementById('nm-timezone').value || 'America/New_York',
      },
      prayerTimes: {
        calculationMethod: document.getElementById('nm-calc-method').value,
        jummahTime: document.getElementById('nm-jummah').value,
        fallbackTimes: { Fajr: '5:30 AM', Dhuhr: '1:00 PM', Asr: '4:30 PM', Maghrib: '7:00 PM', Isha: '8:30 PM' },
      },
      googleDrive: {
        rootFolderId: document.getElementById('nm-drive-folder').value,
      },
      display: {
        slideshowIntervalMs: 8000,
        ayatRotationIntervalMs: 20000,
        theme: {
          headerBg: 'rgba(26,26,26,0.8)',
          panelBg: 'rgba(26,26,26,0.8)',
          accentColor: document.getElementById('nm-accent').value,
          textColor: document.getElementById('nm-text-color').value,
        },
      },
      ayatHadith: 'default',
    };

    await createMosque(mosqueId, config);

    await createAdminRecord(currentUser.uid, {
      mosqueId,
      email: currentUser.email,
      role: 'mosque_admin',
      createdAt: new Date().toISOString(),
    });

    mosqueConfig = config;
    adminRecord = { mosqueId, email: currentUser.email, role: 'mosque_admin' };

    populateDashboard();
    showScreen('dashboard');
  } catch (err) {
    console.error('Failed to create mosque:', err);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Mosque';
    alert('Failed to create mosque. Please try again.');
  }
}

// === POPULATE DASHBOARD ===
function populateDashboard() {
  if (!mosqueConfig) return;

  const mc = mosqueConfig;

  // Header
  document.getElementById('dash-mosque-name').textContent = mc.mosque?.name || 'Mosque Dashboard';

  // Display URL
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/admin\.html$/, '/');
  document.getElementById('dash-display-url').value = `${baseUrl}?mosque=${mosqueId}`;

  // Mosque info
  document.getElementById('ed-name').value = mc.mosque?.name || '';
  document.getElementById('ed-short-name').value = mc.mosque?.shortName || '';
  document.getElementById('ed-header').value = mc.mosque?.headerText || '';
  document.getElementById('ed-page-title').value = mc.mosque?.pageTitle || '';

  // Location
  document.getElementById('ed-zipcode').value = mc.location?.zipcode || '';
  document.getElementById('ed-country').value = mc.location?.country || '';
  document.getElementById('ed-timezone').value = mc.location?.timezone || '';

  // Prayer times
  document.getElementById('ed-calc-method').value = mc.prayerTimes?.calculationMethod || 'ISNA';
  document.getElementById('ed-jummah').value = mc.prayerTimes?.jummahTime || '';

  // Drive
  document.getElementById('ed-drive-folder').value = mc.googleDrive?.rootFolderId || '';

  // Display settings
  document.getElementById('ed-slideshow-interval').value = mc.display?.slideshowIntervalMs || 8000;
  document.getElementById('ed-ayat-interval').value = mc.display?.ayatRotationIntervalMs || 20000;
  document.getElementById('ed-accent').value = mc.display?.theme?.accentColor || '#ffd700';
  document.getElementById('ed-text-color').value = mc.display?.theme?.textColor || '#ffffff';
}

// === SAVE CHANGES ===
async function handleSaveChanges(e) {
  e.preventDefault();

  const statusEl = document.getElementById('save-status');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';
  statusEl.textContent = '';
  statusEl.className = 'save-status';

  try {
    const updates = {
      mosque: {
        name: document.getElementById('ed-name').value,
        shortName: document.getElementById('ed-short-name').value,
        headerText: document.getElementById('ed-header').value,
        pageTitle: document.getElementById('ed-page-title').value,
      },
      location: {
        zipcode: document.getElementById('ed-zipcode').value,
        country: document.getElementById('ed-country').value,
        timezone: document.getElementById('ed-timezone').value,
      },
      prayerTimes: {
        calculationMethod: document.getElementById('ed-calc-method').value,
        jummahTime: document.getElementById('ed-jummah').value,
        fallbackTimes: mosqueConfig?.prayerTimes?.fallbackTimes || {},
      },
      googleDrive: {
        rootFolderId: document.getElementById('ed-drive-folder').value,
      },
      display: {
        slideshowIntervalMs: parseInt(document.getElementById('ed-slideshow-interval').value, 10) || 8000,
        ayatRotationIntervalMs: parseInt(document.getElementById('ed-ayat-interval').value, 10) || 20000,
        theme: {
          headerBg: 'rgba(26,26,26,0.8)',
          panelBg: 'rgba(26,26,26,0.8)',
          accentColor: document.getElementById('ed-accent').value,
          textColor: document.getElementById('ed-text-color').value,
        },
      },
    };

    await updateMosque(mosqueId, updates);

    // Update local state
    mosqueConfig = { ...mosqueConfig, ...updates };
    document.getElementById('dash-mosque-name').textContent = updates.mosque.name || 'Mosque Dashboard';

    statusEl.textContent = 'Changes saved successfully!';
    statusEl.className = 'save-status success';
  } catch (err) {
    console.error('Failed to save changes:', err);
    statusEl.textContent = 'Failed to save. Please try again.';
    statusEl.className = 'save-status error';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
  }
}

// === BOOT ===
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
