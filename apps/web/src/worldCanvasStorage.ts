import type {WorldCanvasDocument} from './entityTypes';
import {openDb, WORLD_CANVAS_STORE_NAME} from './db';
import {migrateWorldCanvasDocument} from './services/worldBible/worldCanvasService';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getWorldCanvasByProjectId(
  projectId: string
): Promise<WorldCanvasDocument | null> {
  const db = await openDb();
  const tx = db.transaction(WORLD_CANVAS_STORE_NAME, 'readonly');
  const index = tx.objectStore(WORLD_CANVAS_STORE_NAME).index('projectId');
  const result = await requestToPromise(index.get(projectId));
  if (!result) return null;
  const migrated = migrateWorldCanvasDocument(result);
  if ((result as {schemaVersion?: number}).schemaVersion !== migrated.schemaVersion) {
    await saveWorldCanvas(migrated);
  }
  return migrated;
}

export async function saveWorldCanvas(canvas: WorldCanvasDocument): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(WORLD_CANVAS_STORE_NAME, 'readwrite');
  await requestToPromise(tx.objectStore(WORLD_CANVAS_STORE_NAME).put(migrateWorldCanvasDocument(canvas)));
}
