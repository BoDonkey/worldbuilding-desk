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

/** Fired after `appendToScratchpad` commits, so mounted scratchpad editors can apply the same append. */
export const SCRATCHPAD_APPENDED_EVENT = 'wbd:scratchpad-appended';

export interface ScratchpadAppendedDetail {
  projectId: string;
  html: string;
}

/**
 * Adds `html` to the end of the project's scratchpad in one read-write
 * transaction, then announces it. Open scratchpad editors apply the same
 * append in memory instead of saving over it with their older copy.
 */
export async function appendToScratchpad(projectId: string, html: string): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SCRATCHPAD_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SCRATCHPAD_STORE_NAME);
    const request = store.get(projectId);

    request.onsuccess = () => {
      const existing = request.result as ScratchpadDocument | undefined;
      const now = Date.now();
      store.put({
        id: projectId,
        projectId,
        content: `${existing?.content ?? ''}${html}`,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      } satisfies ScratchpadDocument);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  window.dispatchEvent(
    new CustomEvent<ScratchpadAppendedDetail>(SCRATCHPAD_APPENDED_EVENT, {
      detail: {projectId, html}
    })
  );
}
