/**
 * One-time migration: convert admins/{uid}.mosqueId (string) → mosqueIds (array)
 *
 * Usage: node scripts/migrate-admin-records.js
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key,
 * or run `gcloud auth application-default login` first.
 */

const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const PROJECT_ID = 'mosque-signage-platform-8e2d3';

async function migrate() {
  initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  });

  const db = getFirestore();
  const adminsSnap = await db.collection('admins').get();

  console.log(`Found ${adminsSnap.size} admin record(s)\n`);

  let migrated = 0;
  let skipped = 0;
  let alreadyDone = 0;

  for (const doc of adminsSnap.docs) {
    const data = doc.data();
    const uid = doc.id;

    if (data.mosqueIds && Array.isArray(data.mosqueIds)) {
      // Already has mosqueIds array
      if (data.mosqueId) {
        // Clean up old field
        console.log(`[${uid}] Already has mosqueIds, removing old mosqueId field`);
        await doc.ref.update({ mosqueId: FieldValue.delete() });
        migrated++;
      } else {
        console.log(`[${uid}] Already migrated, skipping`);
        alreadyDone++;
      }
    } else if (data.mosqueId) {
      // Has old mosqueId string — migrate to mosqueIds array
      console.log(`[${uid}] Migrating mosqueId "${data.mosqueId}" → mosqueIds array`);
      await doc.ref.update({
        mosqueIds: [data.mosqueId],
        mosqueId: FieldValue.delete(),
      });
      migrated++;
    } else {
      // No mosqueId at all — set empty array
      console.log(`[${uid}] No mosqueId found, setting empty mosqueIds array`);
      await doc.ref.update({ mosqueIds: [] });
      skipped++;
    }
  }

  console.log(`\nDone! Migrated: ${migrated}, Already done: ${alreadyDone}, No mosque: ${skipped}`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
