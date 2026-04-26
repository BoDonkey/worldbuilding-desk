import type {ScratchpadDocument} from './entityTypes';
import {openDb, SCRATCHPAD_STORE_NAME} from './db';

export async function getScratchpadByProjectId(
  projectId: string
): Promise<ScratchpadDocument | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCRATCHPAD_STORE_NAME, 'readonly');
    const store = tx.objectStore(SCRATCHPAD_STORE_NAME);
    const request = store.get(projectId);

    request.onsuccess = () => {
      resolve((request.result as ScratchpadDocument) ?? null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveScratchpad(
  scratchpad: ScratchpadDocument
): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCRATCHPAD_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SCRATCHPAD_STORE_NAME);
    const request = store.put(scratchpad);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
