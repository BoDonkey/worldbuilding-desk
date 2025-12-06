export const DB_NAME = 'worldbuilding-db';
export const DB_VERSION = 6;
export const ENTITY_STORE_NAME = 'entities';
export const CATEGORY_STORE_NAME = 'entityCategories';
export const PROJECT_STORE_NAME = 'projects';
export const WRITING_STORE_NAME = 'writingDocuments';
export const SETTINGS_STORE_NAME = 'projectSettings';
export const CHARACTER_STORE_NAME = 'characters';

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(ENTITY_STORE_NAME)) {
        db.createObjectStore(ENTITY_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(PROJECT_STORE_NAME)) {
        db.createObjectStore(PROJECT_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(WRITING_STORE_NAME)) {
        db.createObjectStore(WRITING_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(CHARACTER_STORE_NAME)) {
        db.createObjectStore(CHARACTER_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(CATEGORY_STORE_NAME)) {
        db.createObjectStore(CATEGORY_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
