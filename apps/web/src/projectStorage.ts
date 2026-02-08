import type { Project } from './entityTypes';
import { openDb, PROJECT_STORE_NAME } from './db';

export async function getAllProjects(): Promise<Project[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE_NAME, 'readonly');
    const store = tx.objectStore(PROJECT_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as Project[]);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getProjectById(id: string): Promise<Project | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE_NAME, 'readonly');
    const store = tx.objectStore(PROJECT_STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve((request.result as Project) ?? null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveProject(project: Project): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PROJECT_STORE_NAME);
    const request = store.put(project);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PROJECT_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
