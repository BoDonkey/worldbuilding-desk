import { CONSISTENCY_ALIAS_STORE_NAME, openDb } from '../../db';

export interface ConsistencyAlias {
  id: string;
  projectId: string;
  targetId: string;
  targetType: 'entity' | 'character';
  entityId?: string;
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
      const all = request.result as Array<Partial<ConsistencyAlias>>;
      resolve(
        all
          .filter((alias): alias is Partial<ConsistencyAlias> & {projectId: string; alias: string} =>
            alias.projectId === projectId && typeof alias.alias === 'string'
          )
          .map((alias) => {
            const targetType = alias.targetType ?? 'entity';
            const targetId = alias.targetId ?? alias.entityId;
            if (!targetId) {
              throw new Error('Alias record missing target id.');
            }
            return {
              id: alias.id ?? crypto.randomUUID(),
              projectId: alias.projectId,
              targetId,
              targetType,
              entityId: targetType === 'entity' ? targetId : undefined,
              alias: alias.alias,
              createdAt: alias.createdAt ?? Date.now(),
              updatedAt: alias.updatedAt ?? alias.createdAt ?? Date.now()
            };
          })
      );
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveAlias(
  input: Omit<ConsistencyAlias, 'id' | 'createdAt' | 'updatedAt' | 'entityId'>
): Promise<ConsistencyAlias> {
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
        targetId: input.targetId,
        targetType: input.targetType,
        entityId: input.targetType === 'entity' ? input.targetId : undefined,
        updatedAt: now
      }
    : {
        id: crypto.randomUUID(),
        projectId: input.projectId,
        targetId: input.targetId,
        targetType: input.targetType,
        entityId: input.targetType === 'entity' ? input.targetId : undefined,
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
  return replaceAliasesForTarget({
    projectId: input.projectId,
    targetId: input.entityId,
    targetType: 'entity',
    aliases: input.aliases
  });
}

export async function replaceAliasesForTarget(input: {
  projectId: string;
  targetId: string;
  targetType: 'entity' | 'character';
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
    const keptNormalizedAliases = new Set<string>();

    existing.forEach((aliasRecord) => {
      const normalized = normalizeAlias(aliasRecord.alias);
      const shouldBelongToEntity = desiredAliases.some(
        (alias) => normalizeAlias(alias) === normalized
      );

      if (shouldBelongToEntity) {
        if (keptNormalizedAliases.has(normalized)) {
          store.delete(aliasRecord.id);
          return;
        }
        const nextRecord: ConsistencyAlias = {
          ...aliasRecord,
          targetId: input.targetId,
          targetType: input.targetType,
          entityId: input.targetType === 'entity' ? input.targetId : undefined,
          updatedAt: now
        };
        keptNormalizedAliases.add(normalized);
        kept.push(nextRecord);
        store.put(nextRecord);
        return;
      }

      if (
        (aliasRecord.targetType ?? 'entity') === input.targetType &&
        aliasRecord.targetId === input.targetId
      ) {
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
            targetId: input.targetId,
            targetType: input.targetType,
            entityId: input.targetType === 'entity' ? input.targetId : undefined,
            updatedAt: now
          }
        : {
            id: crypto.randomUUID(),
            projectId: input.projectId,
            targetId: input.targetId,
            targetType: input.targetType,
            entityId: input.targetType === 'entity' ? input.targetId : undefined,
            alias,
            createdAt: now,
            updatedAt: now
          };
      keptNormalizedAliases.add(normalized);
      kept.push(nextRecord);
      store.put(nextRecord);
    });

    tx.oncomplete = () => {
      emitAliasRecordsChanged();
      resolve(
        kept.filter(
          (entry) =>
            (entry.targetType ?? 'entity') === input.targetType &&
            entry.targetId === input.targetId
        )
      );
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function deleteAliasesForEntity(
  projectId: string,
  entityId: string
): Promise<void> {
  return deleteAliasesForTarget({
    projectId,
    targetId: entityId,
    targetType: 'entity'
  });
}

export async function deleteAliasesForTarget(input: {
  projectId: string;
  targetId: string;
  targetType: 'entity' | 'character';
}): Promise<void> {
  const db = await openDb();
  const existing = await getAliasesByProject(input.projectId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONSISTENCY_ALIAS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CONSISTENCY_ALIAS_STORE_NAME);

    existing
      .filter(
        (alias) =>
          (alias.targetType ?? 'entity') === input.targetType &&
          alias.targetId === input.targetId
      )
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
