import { CONSISTENCY_ALIAS_STORE_NAME, openDb } from '../../db';

export interface ConsistencyAlias {
  id: string;
  projectId: string;
  entityId: string;
  alias: string;
  createdAt: number;
  updatedAt: number;
}

const normalizeAlias = (value: string): string => value.trim().toLowerCase();

export async function getAliasesByProject(projectId: string): Promise<ConsistencyAlias[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONSISTENCY_ALIAS_STORE_NAME, 'readonly');
    const store = tx.objectStore(CONSISTENCY_ALIAS_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result as ConsistencyAlias[];
      resolve(all.filter((alias) => alias.projectId === projectId));
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveAlias(input: Omit<ConsistencyAlias, 'id' | 'createdAt' | 'updatedAt'>): Promise<ConsistencyAlias> {
  const db = await openDb();

  const existing = await getAliasesByProject(input.projectId);
  const normalized = normalizeAlias(input.alias);
  const duplicate = existing.find(
    (alias) => normalizeAlias(alias.alias) === normalized
  );

  const now = Date.now();
  const aliasToSave: ConsistencyAlias = duplicate
    ? {
        ...duplicate,
        entityId: input.entityId,
        updatedAt: now
      }
    : {
        id: crypto.randomUUID(),
        projectId: input.projectId,
        entityId: input.entityId,
        alias: input.alias.trim(),
        createdAt: now,
        updatedAt: now
      };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONSISTENCY_ALIAS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CONSISTENCY_ALIAS_STORE_NAME);
    const request = store.put(aliasToSave);

    request.onsuccess = () => {
      resolve(aliasToSave);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
