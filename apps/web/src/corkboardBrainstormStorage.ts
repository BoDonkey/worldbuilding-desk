import type {CorkboardBrainstormDocument} from './entityTypes';
import {CORKBOARD_BRAINSTORM_STORE_NAME, openDb} from './db';

export async function getCorkboardBrainstormByProjectId(
  projectId: string
): Promise<CorkboardBrainstormDocument | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CORKBOARD_BRAINSTORM_STORE_NAME, 'readonly');
    const store = tx.objectStore(CORKBOARD_BRAINSTORM_STORE_NAME);
    const request = store.get(projectId);

    request.onsuccess = () => {
      resolve((request.result as CorkboardBrainstormDocument) ?? null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveCorkboardBrainstorm(
  document: CorkboardBrainstormDocument
): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CORKBOARD_BRAINSTORM_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CORKBOARD_BRAINSTORM_STORE_NAME);
    const request = store.put(document);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
