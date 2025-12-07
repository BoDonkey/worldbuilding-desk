import type {WorldRuleset} from '@litrpg-tool/rules-engine';
import type {StoredRuleset} from '../entityTypes';

const DB_NAME = 'worldbuilding-desk';
const RULESET_STORE = 'rulesets';
const DB_VERSION = 2; // Increment if you already have a DB

let db: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
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

export async function saveRuleset(
  ruleset: WorldRuleset,
  projectId: string
): Promise<void> {
  const database = await getDB();
  const transaction = database.transaction([RULESET_STORE], 'readwrite');
  const store = transaction.objectStore(RULESET_STORE);

  const storedRuleset: StoredRuleset = {
    ...ruleset,
    projectId
  };

  return new Promise((resolve, reject) => {
    const request = store.put(storedRuleset);
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

export async function deleteRuleset(rulesetId: string): Promise<void> {
  const database = await getDB();
  const transaction = database.transaction([RULESET_STORE], 'readwrite');
  const store = transaction.objectStore(RULESET_STORE);

  return new Promise((resolve, reject) => {
    const request = store.delete(rulesetId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
