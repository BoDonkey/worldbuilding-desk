import { CONSISTENCY_ALIAS_STORE_NAME, openDb } from '../../db';

export interface ConsistencyAlias {
  id: string;
  projectId: string;
  entityId: string;
  targetType?: 'entity' | 'character';
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

export async function saveAlias(
  input: Omit<ConsistencyAlias, 'id' | 'createdAt' | 'updatedAt'>
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
        entityId: input.entityId,
        targetType: input.targetType ?? duplicate.targetType ?? 'entity',
        updatedAt: now
      }
    : {
        id: crypto.randomUUID(),
        projectId: input.projectId,
        entityId: input.entityId,
        targetType: input.targetType ?? 'entity',
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

export async function deleteAlias(id: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONSISTENCY_ALIAS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CONSISTENCY_ALIAS_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteAliasesForEntity(
  projectId: string,
  entityId: string,
  targetType: 'entity' | 'character' = 'entity'
): Promise<void> {
  const aliases = await getAliasesByProject(projectId);
  const matches = aliases.filter(
    (alias) =>
      alias.entityId === entityId && (alias.targetType ?? 'entity') === targetType
  );

  await Promise.all(matches.map((alias) => deleteAlias(alias.id)));
}

export async function replaceAliasesForEntity(params: {
  projectId: string;
  entityId: string;
  aliases: string[];
  targetType?: 'entity' | 'character';
}): Promise<ConsistencyAlias[]> {
  const targetType = params.targetType ?? 'entity';
  const normalizedWanted = new Set(
    params.aliases
      .map((alias) => alias.trim())
      .filter(Boolean)
      .map((alias) => normalizeAlias(alias))
  );

  const existing = await getAliasesByProject(params.projectId);
  const entityAliases = existing.filter(
    (alias) =>
      alias.entityId === params.entityId && (alias.targetType ?? 'entity') === targetType
  );

  const aliasesToDelete = entityAliases.filter(
    (alias) => !normalizedWanted.has(normalizeAlias(alias.alias))
  );
  await Promise.all(aliasesToDelete.map((alias) => deleteAlias(alias.id)));

  const savedAliases: ConsistencyAlias[] = [];
  for (const alias of params.aliases) {
    const trimmed = alias.trim();
    if (!trimmed) continue;
    const saved = await saveAlias({
      projectId: params.projectId,
      entityId: params.entityId,
      targetType,
      alias: trimmed
    });
    savedAliases.push(saved);
  }

  return getAliasesByProject(params.projectId).then((aliases) =>
    aliases.filter(
      (alias) =>
        alias.entityId === params.entityId && (alias.targetType ?? 'entity') === targetType
    )
  );
}
