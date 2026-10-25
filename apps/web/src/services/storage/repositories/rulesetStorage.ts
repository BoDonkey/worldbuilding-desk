import type {StoredRuleset} from '../../../entityTypes';
import {ensureVaultRegistry} from '../db';
import {wrapVaultDatabase} from '../vault/vaultDatabase';

/*
 * Rulesets live in their own IndexedDB database, separate from the main
 * project database in ../db.ts.
 */
export const RULESETS_DATABASE_NAME = 'worldbuilding-desk';
export const RULESET_STORE_NAME = 'rulesets';
const DB_NAME = RULESETS_DATABASE_NAME;
const RULESET_STORE = RULESET_STORE_NAME;
const DB_VERSION = 2; // Increment if you already have a DB

let rawDb: IDBDatabase | null = null;
let db: IDBDatabase | null = null;

/** The rulesets database without the vault seam; only the vault service uses it. */
export function openRawRulesetDb(): Promise<IDBDatabase> {
  if (rawDb) return Promise.resolve(rawDb);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      rawDb = request.result;
      resolve(rawDb);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create rulesets store if it doesn't exist
      if (!db.objectStoreNames.contains(RULESET_STORE)) {
        const store = db.createObjectStore(RULESET_STORE, {keyPath: 'id'});
        store.createIndex('projectId', 'projectId', {unique: false});
      }
    };
  });
}

async function getDB(): Promise<IDBDatabase> {
  // Protected projects' rulesets are sealed too, so the registry must be loaded first.
  await ensureVaultRegistry();
  if (db) return db;
  db = wrapVaultDatabase(await openRawRulesetDb(), {databaseName: DB_NAME});
  return db;
}

/** Stores a ruleset record as given; resolves when the put request succeeds. */
export async function putRulesetRecord(storedRuleset: StoredRuleset): Promise<void> {
  const database = await getDB();
  const transaction = database.transaction([RULESET_STORE], 'readwrite');
  const store = transaction.objectStore(RULESET_STORE);

  return new Promise((resolve, reject) => {
    const request = store.put(storedRuleset);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Deletes a ruleset record; resolves when the delete request succeeds. */
export async function deleteRulesetRecord(rulesetId: string): Promise<void> {
  const database = await getDB();
  const transaction = database.transaction([RULESET_STORE], 'readwrite');
  const store = transaction.objectStore(RULESET_STORE);

  return new Promise((resolve, reject) => {
    const request = store.delete(rulesetId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getRuleset(
  rulesetId: string
): Promise<StoredRuleset | null> {
  const database = await getDB();
  const transaction = database.transaction([RULESET_STORE], 'readonly');
  const store = transaction.objectStore(RULESET_STORE);

  return new Promise((resolve, reject) => {
    const request = store.get(rulesetId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getRulesetByProjectId(
  projectId: string
): Promise<StoredRuleset | null> {
  const database = await getDB();
  const transaction = database.transaction([RULESET_STORE], 'readonly');
  const store = transaction.objectStore(RULESET_STORE);
  const index = store.index('projectId');

  return new Promise((resolve, reject) => {
    const request = index.get(projectId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/** Recovery-only write that deliberately skips derived indexed-context and project-memory updates. */
export async function replaceRulesetSnapshot(
  projectId: string,
  ruleset: StoredRuleset | null
): Promise<void> {
  const database = await getDB();
  const transaction = database.transaction([RULESET_STORE], 'readwrite');
  const store = transaction.objectStore(RULESET_STORE);
  const existingRequest = store.index('projectId').getAll(projectId);

  return new Promise((resolve, reject) => {
    existingRequest.onsuccess = () => {
      (existingRequest.result as StoredRuleset[]).forEach((record) => {
        store.delete(record.id);
      });
      if (ruleset) {
        store.put({...ruleset, projectId});
      }
    };
    existingRequest.onerror = () => reject(existingRequest.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
