import type {MechanicsDraft} from '../../../entityTypes';
import {MECHANICS_DRAFT_STORE_NAME, openDb} from '../db';
import {requestToPromise, transactionToPromise} from '../idbRequest';

/**
 * Unfinished first-mechanics forms (slice 3.23c). They live in project storage
 * so they survive a reload, travel with backups, and are removed with the
 * project. Older builds kept them in `localStorage` under
 * `wbd:first-mechanics:<projectId>:<entityId>`; `migrateLegacyMechanicsDrafts`
 * moves those here once.
 */

export const mechanicsDraftId = (projectId: string, entityId: string): string =>
  `${projectId}:mechanics-draft:${entityId}`;

const LEGACY_KEY_PREFIX = 'wbd:first-mechanics:';

export async function getMechanicsDraft(
  projectId: string,
  entityId: string
): Promise<MechanicsDraft | null> {
  const db = await openDb();
  const record = await requestToPromise(
    db
      .transaction(MECHANICS_DRAFT_STORE_NAME, 'readonly')
      .objectStore(MECHANICS_DRAFT_STORE_NAME)
      .get(mechanicsDraftId(projectId, entityId))
  );
  return (record as MechanicsDraft | undefined) ?? null;
}

export async function saveMechanicsDraft(
  input: Omit<MechanicsDraft, 'id' | 'updatedAt'> & {updatedAt?: number}
): Promise<MechanicsDraft> {
  const draft: MechanicsDraft = {
    ...input,
    id: mechanicsDraftId(input.projectId, input.entityId),
    updatedAt: input.updatedAt ?? Date.now()
  };
  const db = await openDb();
  const tx = db.transaction(MECHANICS_DRAFT_STORE_NAME, 'readwrite');
  tx.objectStore(MECHANICS_DRAFT_STORE_NAME).put(draft);
  await transactionToPromise(tx);
  return draft;
}

export async function deleteMechanicsDraft(projectId: string, entityId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(MECHANICS_DRAFT_STORE_NAME, 'readwrite');
  tx.objectStore(MECHANICS_DRAFT_STORE_NAME).delete(mechanicsDraftId(projectId, entityId));
  await transactionToPromise(tx);
}

function parseLegacyDraft(raw: string | null): Pick<MechanicsDraft, 'kind' | 'name' | 'defaultValue'> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown> | null;
    if (!value || typeof value !== 'object' || value.isAdding !== true) return null;
    return {
      kind: value.kind === 'stat' ? 'stat' : 'resource',
      name: typeof value.name === 'string' ? value.name : '',
      defaultValue: typeof value.defaultValue === 'string' ? value.defaultValue : ''
    };
  } catch {
    return null;
  }
}

/**
 * Moves this project's `localStorage` drafts into project storage, then
 * removes the keys. A draft already in project storage wins, because it is
 * newer than anything an older build left behind. A key is removed only after
 * its draft is saved, so a failed write leaves it for the next attempt.
 */
export async function migrateLegacyMechanicsDrafts(projectId: string): Promise<number> {
  let storage: Storage;
  try {
    if (typeof window === 'undefined') return 0;
    storage = window.localStorage;
  } catch {
    return 0;
  }
  const prefix = `${LEGACY_KEY_PREFIX}${projectId}:`;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  let moved = 0;
  for (const key of keys) {
    const entityId = key.slice(prefix.length);
    const legacy = parseLegacyDraft(storage.getItem(key));
    if (entityId && legacy && !(await getMechanicsDraft(projectId, entityId))) {
      await saveMechanicsDraft({projectId, entityId, ...legacy});
      moved += 1;
    }
    storage.removeItem(key);
  }
  return moved;
}
