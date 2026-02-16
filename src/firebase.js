// firebase.js - Firebase configuration and initialization
// Uses Firebase CDN (compat mode) loaded in HTML files.
// This module provides helper functions that wrap the global firebase object.

// Firebase project configuration
// These are client-side config values and safe to expose publicly.
// Replace these with your actual Firebase project values.
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

let initialized = false;

/**
 * Initialize Firebase app. Safe to call multiple times.
 */
export function initFirebase() {
  if (initialized) return;
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded. Ensure CDN scripts are in the HTML.');
    return;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  initialized = true;
}

/**
 * Get Firestore database instance.
 */
export function getDb() {
  initFirebase();
  return firebase.firestore();
}

/**
 * Get Firebase Auth instance.
 */
export function getAuth() {
  initFirebase();
  return firebase.auth();
}

/**
 * Fetch a mosque config document from Firestore.
 * @param {string} mosqueId - UUID of the mosque
 * @returns {Promise<object|null>} Mosque config data or null if not found
 */
export async function fetchMosqueConfig(mosqueId) {
  const db = getDb();
  const doc = await db.collection('mosques').doc(mosqueId).get();
  if (!doc.exists) return null;
  return doc.data();
}

/**
 * Fetch all mosque summaries (for the selector screen).
 * Returns only id, name, and shortName for each mosque.
 * @returns {Promise<Array<{id: string, name: string, shortName: string}>>}
 */
export async function fetchAllMosques() {
  const db = getDb();
  const snapshot = await db.collection('mosques').get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.mosque?.name || 'Unknown Mosque',
      shortName: data.mosque?.shortName || '',
    };
  });
}

/**
 * Fetch admin record for a given Firebase Auth UID.
 * @param {string} uid - Firebase Auth UID
 * @returns {Promise<object|null>}
 */
export async function fetchAdminRecord(uid) {
  const db = getDb();
  const doc = await db.collection('admins').doc(uid).get();
  if (!doc.exists) return null;
  return doc.data();
}

/**
 * Create a new mosque in Firestore.
 * @param {string} mosqueId - UUID for the new mosque
 * @param {object} config - Mosque configuration data
 * @returns {Promise<void>}
 */
export async function createMosque(mosqueId, config) {
  const db = getDb();
  await db.collection('mosques').doc(mosqueId).set(config);
}

/**
 * Update an existing mosque config.
 * @param {string} mosqueId - UUID of the mosque
 * @param {object} updates - Fields to update (uses merge)
 * @returns {Promise<void>}
 */
export async function updateMosque(mosqueId, updates) {
  const db = getDb();
  await db.collection('mosques').doc(mosqueId).set(updates, { merge: true });
}

/**
 * Create an admin record.
 * @param {string} uid - Firebase Auth UID
 * @param {object} data - Admin record data
 * @returns {Promise<void>}
 */
export async function createAdminRecord(uid, data) {
  const db = getDb();
  await db.collection('admins').doc(uid).set(data);
}

/**
 * Sign in with Google popup.
 * @returns {Promise<firebase.auth.UserCredential>}
 */
export async function signInWithGoogle() {
  const auth = getAuth();
  const provider = new firebase.auth.GoogleAuthProvider();
  return auth.signInWithPopup(provider);
}

/**
 * Sign out.
 * @returns {Promise<void>}
 */
export async function signOut() {
  const auth = getAuth();
  return auth.signOut();
}

/**
 * Get current authenticated user.
 * @returns {firebase.User|null}
 */
export function getCurrentUser() {
  const auth = getAuth();
  return auth.currentUser;
}

/**
 * Listen for auth state changes.
 * @param {function} callback - Called with user or null
 * @returns {function} Unsubscribe function
 */
export function onAuthStateChanged(callback) {
  const auth = getAuth();
  return auth.onAuthStateChanged(callback);
}
