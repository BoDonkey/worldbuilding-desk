import type { WritingDocument } from './entityTypes';
import { openDb, WRITING_STORE_NAME } from './db';

export async function getDocumentsByProject(projectId: string): Promise<WritingDocument[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(WRITING_STORE_NAME, 'readonly');
    const store = tx.objectStore(WRITING_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result as WritingDocument[];
      resolve(all.filter(doc => doc.projectId === projectId));
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveWritingDocument(doc: WritingDocument): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(WRITING_STORE_NAME, 'readwrite');
    const store = tx.objectStore(WRITING_STORE_NAME);
    const request = store.put(doc);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteWritingDocument(id: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(WRITING_STORE_NAME, 'readwrite');
    const store = tx.objectStore(WRITING_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
