import type {WorldRuleset} from '@litrpg-tool/rules-engine';
import type {StoredRuleset} from '../entityTypes';
import {getRAGService} from './rag/getRAGService';
import {getShodhService} from './shodh/getShodhService';
import {emitShodhMemoriesUpdated} from './shodh/shodhEvents';

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
    request.onsuccess = async () => {
      const ruleText = ruleset.rules
        .map((rule) => `${rule.name}: ${rule.description || ''}`)
        .join('\n');
      const combinedText = `${ruleset.description ?? ''}\n${ruleText}`;

      try {
        const rag = await getRAGService(projectId);
        await rag.indexDocument(
          storedRuleset.id,
          ruleset.name || 'Ruleset',
          combinedText,
          'rule',
          {tags: ['ruleset']}
        );
      } catch (error) {
        console.warn('Failed to index ruleset in RAG', error);
      }
      try {
        const shodh = await getShodhService(projectId);
        await shodh.captureAutoMemory({
          projectId,
          documentId: storedRuleset.id,
          title: ruleset.name || 'Ruleset',
          content: combinedText,
          tags: ['ruleset']
        });
      } catch (error) {
        console.warn('Failed to capture ruleset memory', error);
      }
      emitShodhMemoriesUpdated();
      resolve();
    };
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

export async function deleteRuleset(
  rulesetId: string,
  projectId?: string
): Promise<void> {
  const existing = projectId ? null : await getRuleset(rulesetId);
  const database = await getDB();
  const transaction = database.transaction([RULESET_STORE], 'readwrite');
  const store = transaction.objectStore(RULESET_STORE);

  return new Promise((resolve, reject) => {
    const request = store.delete(rulesetId);
    request.onsuccess = () => {
      const cleanup = async () => {
        const targetProjectId = projectId ?? existing?.projectId;
        if (!targetProjectId) {
          return;
        }

        try {
          const shodh = await getShodhService(targetProjectId);
          await shodh.deleteMemoriesForDocument(rulesetId);
        } catch (error) {
          console.warn('Failed to delete ruleset memory', error);
        }

        try {
          const rag = await getRAGService(targetProjectId);
          await rag.deleteDocument(rulesetId);
        } catch (error) {
          console.warn('Failed to delete ruleset from RAG', error);
        }
        emitShodhMemoriesUpdated();
      };

      cleanup()
        .catch((error) => {
          console.warn('Ruleset cleanup failed', error);
        })
        .finally(() => resolve());
    };
    request.onerror = () => reject(request.error);
  });
}
