import type { Character } from './entityTypes';
import { openDb, CHARACTER_STORE_NAME } from './db';

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

export async function saveCharacter(character: Character): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHARACTER_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHARACTER_STORE_NAME);
    const request = store.put(character);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHARACTER_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHARACTER_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}