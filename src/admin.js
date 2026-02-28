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
  addMosqueToAdmin,
  normalizeAdminRecord,
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

  // Announcements
  document.getElementById('add-announcement-btn')?.addEventListener('click', handleAddAnnouncement);
  document.getElementById('new-announcement-text')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddAnnouncement(); }
  });

  // Announcement color
  const colorInput = document.getElementById('announcement-color');
  const colorValue = document.getElementById('announcement-color-value');
  colorInput?.addEventListener('input', () => {
    colorValue.textContent = colorInput.value;
  });
  colorInput?.addEventListener('change', handleSaveAnnouncementColor);
  document.getElementById('reset-announcement-color-btn')?.addEventListener('click', handleResetAnnouncementColor);

  // Custom Ayats
  document.getElementById('save-custom-ayats-btn')?.addEventListener('click', handleSaveCustomAyats);
  document.getElementById('reset-ayats-btn')?.addEventListener('click', handleResetAyats);

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
    adminRecord = normalizeAdminRecord(await fetchAdminRecord(currentUser.uid));

    if (adminRecord && adminRecord.mosqueIds.length > 0) {
      // Existing admin - load their primary mosque
      mosqueId = adminRecord.mosqueIds[0];
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
          accentColor: '#3b82f6',
          textColor: '#ffffff',
        },
      },
      ayatHadith: 'default',
    };

    await createMosque(mosqueId, config);

    if (adminRecord && adminRecord.mosqueIds) {
      // Existing admin — append to mosqueIds
      await addMosqueToAdmin(currentUser.uid, mosqueId);
      adminRecord.mosqueIds.push(mosqueId);
    } else {
      // New admin — create record with mosqueIds array
      await createAdminRecord(currentUser.uid, {
        mosqueIds: [mosqueId],
        email: currentUser.email,
        role: 'mosque_admin',
        createdAt: new Date().toISOString(),
      });
      adminRecord = { mosqueIds: [mosqueId], email: currentUser.email, role: 'mosque_admin' };
    }

    mosqueConfig = config;

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

  // Announcements
  renderAnnouncementsList();
  const annColor = mc.display?.announcementColor || mc.display?.theme?.accentColor || '#3b82f6';
  document.getElementById('announcement-color').value = annColor;
  document.getElementById('announcement-color-value').textContent = annColor;

  // Custom Ayats
  const customAyats = mc.customAyats || [];
  document.getElementById('custom-ayats-textarea').value = customAyats.map(a => a.en).join('\n');
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
          accentColor: '#3b82f6',
          textColor: '#ffffff',
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

// === ANNOUNCEMENTS ===
function renderAnnouncementsList() {
  const listEl = document.getElementById('announcements-list');
  if (!listEl) return;

  const announcements = mosqueConfig?.announcements || [];
  if (announcements.length === 0) {
    listEl.innerHTML = '<p class="empty-text">No announcements yet.</p>';
    return;
  }

  listEl.innerHTML = '';
  announcements.forEach((ann, idx) => {
    const item = document.createElement('div');
    item.className = 'managed-item' + (ann.enabled ? '' : ' disabled');
    item.innerHTML = `
      <span class="managed-item-text">${ann.text}</span>
      <div class="managed-item-actions">
        <button class="btn btn-sm btn-outline" data-action="toggle" data-idx="${idx}">
          ${ann.enabled ? 'Disable' : 'Enable'}
        </button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-idx="${idx}">Delete</button>
      </div>
    `;
    listEl.appendChild(item);
  });

  listEl.querySelectorAll('[data-action="toggle"]').forEach(btn => {
    btn.addEventListener('click', () => handleToggleAnnouncement(parseInt(btn.dataset.idx, 10)));
  });
  listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteAnnouncement(parseInt(btn.dataset.idx, 10)));
  });
}

async function handleAddAnnouncement() {
  const input = document.getElementById('new-announcement-text');
  const text = input.value.trim();
  if (!text) return;

  const announcements = mosqueConfig?.announcements || [];
  announcements.push({ text, enabled: true });

  try {
    await updateMosque(mosqueId, { announcements });
    mosqueConfig.announcements = announcements;
    input.value = '';
    renderAnnouncementsList();
  } catch (err) {
    console.error('Failed to add announcement:', err);
    alert('Failed to add announcement.');
  }
}

async function handleToggleAnnouncement(idx) {
  const announcements = [...(mosqueConfig?.announcements || [])];
  if (!announcements[idx]) return;
  announcements[idx] = { ...announcements[idx], enabled: !announcements[idx].enabled };

  try {
    await updateMosque(mosqueId, { announcements });
    mosqueConfig.announcements = announcements;
    renderAnnouncementsList();
  } catch (err) {
    console.error('Failed to toggle announcement:', err);
  }
}

async function handleDeleteAnnouncement(idx) {
  const announcements = [...(mosqueConfig?.announcements || [])];
  announcements.splice(idx, 1);

  try {
    await updateMosque(mosqueId, { announcements });
    mosqueConfig.announcements = announcements;
    renderAnnouncementsList();
  } catch (err) {
    console.error('Failed to delete announcement:', err);
  }
}

async function handleSaveAnnouncementColor() {
  const color = document.getElementById('announcement-color').value;
  try {
    await updateMosque(mosqueId, { display: { ...mosqueConfig.display, announcementColor: color } });
    mosqueConfig.display = { ...mosqueConfig.display, announcementColor: color };
  } catch (err) {
    console.error('Failed to save announcement color:', err);
  }
}

async function handleResetAnnouncementColor() {
  const accentColor = mosqueConfig?.display?.theme?.accentColor || '#3b82f6';
  document.getElementById('announcement-color').value = accentColor;
  document.getElementById('announcement-color-value').textContent = accentColor;
  try {
    await updateMosque(mosqueId, { display: { ...mosqueConfig.display, announcementColor: accentColor } });
    mosqueConfig.display = { ...mosqueConfig.display, announcementColor: accentColor };
  } catch (err) {
    console.error('Failed to reset announcement color:', err);
  }
}

// === CUSTOM AYATS ===
async function handleSaveCustomAyats() {
  const textarea = document.getElementById('custom-ayats-textarea');
  const statusEl = document.getElementById('ayat-save-status');
  const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const customAyats = lines.map(en => ({ en }));

  try {
    await updateMosque(mosqueId, { customAyats });
    mosqueConfig.customAyats = customAyats;
    statusEl.textContent = `Saved ${customAyats.length} custom ayat(s).`;
    statusEl.className = 'save-status success';
  } catch (err) {
    console.error('Failed to save custom ayats:', err);
    statusEl.textContent = 'Failed to save. Please try again.';
    statusEl.className = 'save-status error';
  }
  setTimeout(() => { statusEl.textContent = ''; }, 3000);
}

async function handleResetAyats() {
  const textarea = document.getElementById('custom-ayats-textarea');
  const statusEl = document.getElementById('ayat-save-status');

  try {
    await updateMosque(mosqueId, { customAyats: [] });
    mosqueConfig.customAyats = [];
    textarea.value = '';
    statusEl.textContent = 'Reset to default ayats.';
    statusEl.className = 'save-status success';
  } catch (err) {
    console.error('Failed to reset ayats:', err);
    statusEl.textContent = 'Failed to reset. Please try again.';
    statusEl.className = 'save-status error';
  }
  setTimeout(() => { statusEl.textContent = ''; }, 3000);
}

// === BOOT ===
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
