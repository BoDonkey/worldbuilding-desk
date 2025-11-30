import type { ProjectSettings } from './entityTypes';
import { openDb, SETTINGS_STORE_NAME } from './db';

export async function getProjectSettings(projectId: string): Promise<ProjectSettings | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE_NAME, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result as ProjectSettings[];
      const settings = all.find(s => s.projectId === projectId);
      resolve(settings ?? null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveProjectSettings(settings: ProjectSettings): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE_NAME);
    const request = store.put(settings);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function createDefaultSettings(projectId: string): Promise<ProjectSettings> {
  const now = Date.now();
  const settings: ProjectSettings = {
    id: crypto.randomUUID(),
    projectId,
    characterStyles: [],
    createdAt: now,
    updatedAt: now
  };

  await saveProjectSettings(settings);
  return settings;
}

export async function getOrCreateSettings(projectId: string): Promise<ProjectSettings> {
  const existing = await getProjectSettings(projectId);
  if (existing) return existing;
  return createDefaultSettings(projectId);
}