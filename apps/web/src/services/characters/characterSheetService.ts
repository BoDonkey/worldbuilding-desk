import type { CharacterSheet } from '../../entityTypes';
import { openDb } from '../../db';

const STORE_NAME = 'character_sheets';

export async function getCharacterSheetsByProject(projectId: string): Promise<CharacterSheet[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result as CharacterSheet[];
      resolve(all.filter(c => c.projectId === projectId));
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getCharacterSheet(id: string): Promise<CharacterSheet | undefined> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result as CharacterSheet | undefined);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export function validateCharacterSheetWrite(
  sheet: CharacterSheet,
  existing?: CharacterSheet
): void {
  if (!sheet.characterEntityId && !existing) {
    throw new Error(
      'New character sheets require a canonical World Bible character link.'
    );
  }
  if (existing?.characterEntityId && !sheet.characterEntityId) {
    throw new Error('A canonical sheet link cannot be removed.');
  }
}

export async function saveCharacterSheet(sheet: CharacterSheet): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const existingRequest = store.get(sheet.id);

    existingRequest.onsuccess = () => {
      const existing = existingRequest.result as CharacterSheet | undefined;
      try {
        validateCharacterSheetWrite(sheet, existing);
      } catch (error) {
        reject(error);
        tx.abort();
        return;
      }
      const request = store.put(sheet);
      request.onerror = () => reject(request.error);
    };
    existingRequest.onerror = () => reject(existingRequest.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteCharacterSheet(id: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
