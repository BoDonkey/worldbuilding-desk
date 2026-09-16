import 'fake-indexeddb/auto';
import {afterEach, describe, expect, it} from 'vitest';
import {
  ACTOR_RESOLUTION_STORE_NAME,
  CHARACTER_IDENTITY_REPORT_STORE_NAME,
  DB_NAME,
  DB_VERSION,
  openDb,
  PROJECT_MIGRATION_BACKUP_STORE_NAME,
  PROJECT_STORE_NAME,
  WORLD_CANVAS_STORE_NAME
} from './db';

let openedDb: IDBDatabase | null = null;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteTestDatabase(): Promise<void> {
  return new Promise((resolve) => {
    openedDb?.close();
    openedDb = null;
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

afterEach(deleteTestDatabase);

describe('openDb structural upgrade', () => {
  it('upgrades a version-24 database without losing existing project records', async () => {
    await deleteTestDatabase();
    const legacyOpen = indexedDB.open(DB_NAME, 24);
    legacyOpen.onupgradeneeded = () => {
      legacyOpen.result.createObjectStore(PROJECT_STORE_NAME, {keyPath: 'id'});
    };
    const legacyDb = await requestToPromise(legacyOpen);
    const write = legacyDb.transaction(PROJECT_STORE_NAME, 'readwrite');
    write.objectStore(PROJECT_STORE_NAME).put({
      id: 'legacy-project',
      name: 'Legacy',
      createdAt: 1,
      updatedAt: 1
    });
    await new Promise<void>((resolve, reject) => {
      write.oncomplete = () => resolve();
      write.onerror = () => reject(write.error);
      write.onabort = () => reject(write.error);
    });
    legacyDb.close();

    openedDb = await openDb();
    expect(openedDb.version).toBe(DB_VERSION);
    expect(openedDb.objectStoreNames.contains(PROJECT_MIGRATION_BACKUP_STORE_NAME)).toBe(true);
    expect(openedDb.objectStoreNames.contains(ACTOR_RESOLUTION_STORE_NAME)).toBe(true);
    expect(openedDb.objectStoreNames.contains(CHARACTER_IDENTITY_REPORT_STORE_NAME)).toBe(true);
    expect(openedDb.objectStoreNames.contains(WORLD_CANVAS_STORE_NAME)).toBe(true);
    const canvasStore = openedDb
      .transaction(WORLD_CANVAS_STORE_NAME, 'readonly')
      .objectStore(WORLD_CANVAS_STORE_NAME);
    expect(canvasStore.indexNames.contains('projectId')).toBe(true);
    const storedProject = await requestToPromise(
      openedDb
        .transaction(PROJECT_STORE_NAME, 'readonly')
        .objectStore(PROJECT_STORE_NAME)
        .get('legacy-project')
    );
    expect(storedProject).toMatchObject({id: 'legacy-project', name: 'Legacy'});
  });
});
