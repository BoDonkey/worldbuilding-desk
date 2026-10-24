import {openDb, PROJECT_ID_INDEX} from './db';
import {requestToPromise} from './idbRequest';

/**
 * Reads one project's records through the store's `projectId` index (3.23b),
 * in primary-key order like a filtered `getAll()`. A missing project id reads
 * nothing: `index.getAll(undefined)` would return every project's records.
 */
export function getAllByProject<T>(store: IDBObjectStore, projectId: string): Promise<T[]> {
  if (typeof projectId !== 'string') return Promise.resolve([]);
  return requestToPromise(store.index(PROJECT_ID_INDEX).getAll(projectId)) as Promise<T[]>;
}

/** Opens a read-only transaction on one store and reads one project's records. */
export async function readProjectRecords<T>(storeName: string, projectId: string): Promise<T[]> {
  const db = await openDb();
  return getAllByProject<T>(db.transaction(storeName, 'readonly').objectStore(storeName), projectId);
}
