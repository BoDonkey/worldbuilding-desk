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
  RETIRED_STORE_NAMES,
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

describe('retired consistency log stores (DB_VERSION 32)', () => {
  it('deletes the write-only log stores and their records, and keeps project records', async () => {
    await deleteTestDatabase();
    const v31 = indexedDB.open(DB_NAME, 31);
    v31.onupgradeneeded = () => {
      v31.result.createObjectStore(PROJECT_STORE_NAME, {keyPath: 'id'});
      for (const storeName of RETIRED_STORE_NAMES) {
        v31.result.createObjectStore(storeName, {keyPath: 'id'});
      }
    };
    const oldDb = await requestToPromise(v31);
    const write = oldDb.transaction([PROJECT_STORE_NAME, ...RETIRED_STORE_NAMES], 'readwrite');
    write.objectStore(PROJECT_STORE_NAME).put({id: 'p1', name: 'Kept', createdAt: 1, updatedAt: 1});
    for (const storeName of RETIRED_STORE_NAMES) {
      write.objectStore(storeName).put({id: `${storeName}-1`, projectId: 'p1', text: 'A full scene copy'});
    }
    await new Promise<void>((resolve, reject) => {
      write.oncomplete = () => resolve();
      write.onerror = () => reject(write.error);
    });
    oldDb.close();

    openedDb = await openDb();
    expect(openedDb.version).toBe(32);
    for (const storeName of RETIRED_STORE_NAMES) {
      expect(openedDb.objectStoreNames.contains(storeName)).toBe(false);
    }
    const kept = await requestToPromise(
      openedDb.transaction(PROJECT_STORE_NAME, 'readonly').objectStore(PROJECT_STORE_NAME).get('p1')
    );
    expect(kept).toMatchObject({id: 'p1', name: 'Kept'});
  });
});
