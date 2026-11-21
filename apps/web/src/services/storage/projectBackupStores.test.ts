import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {
  BACKED_UP_STORE_NAMES,
  BACKUP_EXCLUDED_STORE_NAMES,
  openDb,
  PROJECT_SCOPED_STORE_NAMES,
  PROJECT_STORE_NAME
} from './db';
import {CURRENT_PROJECT_SCHEMA_VERSION} from './projectSchemaMigrations';
import {importProjectBackup, normalizeProjectSnapshot} from './projectBackupImport';
import {buildProjectSnapshot, serializeProjectSnapshot} from './projectSnapshotService';

/*
 * Slice 3.64: backups list their stores by hand in the snapshot build, its
 * type, and the import. These tests fail when a new project-scoped store is
 * neither backed up nor declared in BACKUP_EXCLUDED_STORE_NAMES.
 */
const PROJECT_ID = 'backup-coverage-project';

async function seedProbeProject(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([PROJECT_STORE_NAME, ...BACKED_UP_STORE_NAMES], 'readwrite');
  // At the current schema version, so loading it runs no migrations over the probes.
  tx.objectStore(PROJECT_STORE_NAME).put({
    id: PROJECT_ID,
    name: 'Coverage',
    storageSchemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    createdAt: 1,
    updatedAt: 1
  });
  for (const storeName of BACKED_UP_STORE_NAMES) {
    tx.objectStore(storeName).put({id: `probe-${storeName}`, projectId: PROJECT_ID, createdAt: 1, updatedAt: 1});
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function storesWithRecords(projectId: string): Promise<string[]> {
  const db = await openDb();
  const tx = db.transaction([...BACKED_UP_STORE_NAMES], 'readonly');
  const counts = await Promise.all(
    BACKED_UP_STORE_NAMES.map(
      (storeName) =>
        new Promise<[string, number]>((resolve, reject) => {
          const request = tx.objectStore(storeName).index('projectId').count(projectId);
          request.onsuccess = () => resolve([storeName, request.result]);
          request.onerror = () => reject(request.error);
        })
    )
  );
  return counts.filter(([, count]) => count > 0).map(([storeName]) => storeName);
}

describe('backup store coverage', () => {
  it('puts every project-scoped store in exactly one of backed up or excluded', () => {
    const backedUp = new Set(BACKED_UP_STORE_NAMES);
    const excluded = new Set(BACKUP_EXCLUDED_STORE_NAMES);
    for (const storeName of PROJECT_SCOPED_STORE_NAMES) {
      expect(backedUp.has(storeName) !== excluded.has(storeName), storeName).toBe(true);
    }
    for (const storeName of excluded) {
      expect(PROJECT_SCOPED_STORE_NAMES as readonly string[], storeName).toContain(storeName);
    }
  });

  it('carries a record from every backed-up store in the snapshot', async () => {
    await seedProbeProject();
    const snapshot = JSON.stringify(await buildProjectSnapshot(PROJECT_ID));
    const missing = BACKED_UP_STORE_NAMES.filter((storeName) => !snapshot.includes(`probe-${storeName}`));
    expect(missing).toEqual([]);
  });

  it('writes every backed-up store back when the backup is imported as a new project', async () => {
    await seedProbeProject();
    const snapshot = normalizeProjectSnapshot(
      JSON.parse(serializeProjectSnapshot(await buildProjectSnapshot(PROJECT_ID)))
    );
    const {projectId} = await importProjectBackup({snapshot, mode: 'new'});
    expect(projectId).not.toBe(PROJECT_ID);
    expect(await storesWithRecords(projectId)).toEqual(await storesWithRecords(PROJECT_ID));
    expect(await storesWithRecords(projectId)).toEqual([...BACKED_UP_STORE_NAMES]);
  });
});
