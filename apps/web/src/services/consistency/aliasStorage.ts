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

function emitAliasRecordsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wbd:alias-records-changed'));
}

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
      emitAliasRecordsChanged();
      resolve(aliasToSave);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function replaceAliasesForEntity(input: {
  projectId: string;
  entityId: string;
  aliases: string[];
}): Promise<ConsistencyAlias[]> {
  const db = await openDb();
  const existing = await getAliasesByProject(input.projectId);
  const desiredAliases = Array.from(
    new Map(
      input.aliases
        .map((alias) => alias.trim())
        .filter(Boolean)
        .map((alias) => [normalizeAlias(alias), alias])
    ).values()
  );
  const now = Date.now();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONSISTENCY_ALIAS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CONSISTENCY_ALIAS_STORE_NAME);

    const kept: ConsistencyAlias[] = [];

    existing.forEach((aliasRecord) => {
      const normalized = normalizeAlias(aliasRecord.alias);
      const shouldBelongToEntity = desiredAliases.some(
        (alias) => normalizeAlias(alias) === normalized
      );

      if (shouldBelongToEntity) {
        const nextRecord: ConsistencyAlias = {
          ...aliasRecord,
          entityId: input.entityId,
          updatedAt: now
        };
        kept.push(nextRecord);
        store.put(nextRecord);
        return;
      }

      if (aliasRecord.entityId === input.entityId) {
        store.delete(aliasRecord.id);
      }
    });

    desiredAliases.forEach((alias) => {
      const normalized = normalizeAlias(alias);
      const existingRecord = kept.find(
        (entry) => normalizeAlias(entry.alias) === normalized
      );
      if (existingRecord) return;

      const duplicate = existing.find(
        (entry) => normalizeAlias(entry.alias) === normalized
      );
      const nextRecord: ConsistencyAlias = duplicate
        ? {
            ...duplicate,
            entityId: input.entityId,
            updatedAt: now
          }
        : {
            id: crypto.randomUUID(),
            projectId: input.projectId,
            entityId: input.entityId,
            alias,
            createdAt: now,
            updatedAt: now
          };
      kept.push(nextRecord);
      store.put(nextRecord);
    });

    tx.oncomplete = () => {
      emitAliasRecordsChanged();
      resolve(kept.filter((entry) => entry.entityId === input.entityId));
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function deleteAliasesForEntity(
  projectId: string,
  entityId: string
): Promise<void> {
  const db = await openDb();
  const existing = await getAliasesByProject(projectId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONSISTENCY_ALIAS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CONSISTENCY_ALIAS_STORE_NAME);

    existing
      .filter((alias) => alias.entityId === entityId)
      .forEach((alias) => {
        store.delete(alias.id);
      });

    tx.oncomplete = () => {
      emitAliasRecordsChanged();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
