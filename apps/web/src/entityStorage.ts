import type { WorldEntity } from './entityTypes';
import { openDb, ENTITY_STORE_NAME } from './db';

function emitEntityRecordsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wbd:entity-records-changed'));
}

export async function getAllEntities(): Promise<WorldEntity[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ENTITY_STORE_NAME, 'readonly');
    const store = tx.objectStore(ENTITY_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as WorldEntity[]);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getEntitiesByProject(projectId: string): Promise<WorldEntity[]> {
  const all = await getAllEntities();
  return all.filter(entity => entity.projectId === projectId);
}

export async function saveEntity(entity: WorldEntity): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ENTITY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(ENTITY_STORE_NAME);
    const request = store.put(entity);

    request.onsuccess = () => {
      emitEntityRecordsChanged();
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteEntity(id: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ENTITY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(ENTITY_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      emitEntityRecordsChanged();
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
