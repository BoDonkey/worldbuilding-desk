import type { Character } from './entityTypes';
import { openDb, CHARACTER_STORE_NAME } from './db';

function emitCharacterRecordsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wbd:character-records-changed'));
}

export async function getCharactersByProject(projectId: string): Promise<Character[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHARACTER_STORE_NAME, 'readonly');
    const store = tx.objectStore(CHARACTER_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result as Character[];
      resolve(all.filter(c => c.projectId === projectId));
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export function validateCharacterWrite(
  character: Character,
  existing?: Character
): void {
  if (!character.entityId && !existing) {
    throw new Error(
      'New Character Tools records require a canonical World Bible character link.'
    );
  }
  if (existing?.entityId && !character.entityId) {
    throw new Error('A canonical character link cannot be removed.');
  }
}

export async function saveCharacter(character: Character): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHARACTER_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHARACTER_STORE_NAME);
    const existingRequest = store.get(character.id);

    existingRequest.onsuccess = () => {
      const existing = existingRequest.result as Character | undefined;
      try {
        validateCharacterWrite(character, existing);
      } catch (error) {
        reject(error);
        tx.abort();
        return;
      }
      const request = store.put(character);
      request.onerror = () => reject(request.error);
    };
    existingRequest.onerror = () => reject(existingRequest.error);
    tx.oncomplete = () => {
      emitCharacterRecordsChanged();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHARACTER_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHARACTER_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      emitCharacterRecordsChanged();
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
