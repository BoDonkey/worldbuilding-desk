/**
 * Protecting a project with a passphrase (slice 5.15a).
 *
 * Enable and disable rewrite every record the project owns. Each database is
 * rewritten in one `readwrite` transaction: the records are read, sealed (or
 * opened) in memory, checked against the originals, written back in place,
 * then read again and checked once more before the transaction commits. Any
 * failure aborts it and leaves the project as it was. The rulesets database
 * is separate, so it is rewritten second; if that fails, the main database is
 * put back (compensating recovery, as project deletion does). No plaintext
 * copy of the project is made along the way.
 */
import {
  DB_NAME,
  ensureVaultRegistry,
  openRawDb,
  PROJECT_ID_INDEX,
  PROJECT_INDEXED_STORE_NAMES,
  PROJECT_STORE_NAME
} from '../db';
import {requestToPromise} from '../idbRequest';
import {deleteProjectAuxiliaryStorage} from '../repositories/projectStorage';
import {migrateLegacyMechanicsDrafts} from '../repositories/mechanicsDraftStorage';
import {openRawRulesetDb, RULESET_STORE_NAME, RULESETS_DATABASE_NAME} from '../repositories/rulesetStorage';
import {
  createVaultKey,
  openRecord,
  readVaultManifest,
  rewrapVaultKey,
  sealRecord,
  unwrapVaultKey,
  VaultIntegrityError,
  type VaultManifest
} from './vaultCrypto';
import {moveProjectBrowserContentToMemory, moveProjectBrowserContentToStorage} from './projectBrowserStorage';
import {isSealedRecord, vaultRecordContext, type StoredRecord} from './vaultDatabase';
import {
  beginVaultMigration,
  endVaultMigration,
  getVaultManifest,
  getVaultState,
  isVaultProject,
  lockVault,
  unlockVault,
  updateVaultManifest,
  type VaultState
} from './vaultRegistry';

type Direction = 'seal' | 'open';

interface DatabasePlan {
  databaseName: string;
  db: IDBDatabase;
  /** Stores read through their `projectId` index. */
  storeNames: readonly string[];
  /** The store holding the project record itself, keyed by project id. */
  projectStoreName?: string;
}

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

function rewriteFailed(): Error {
  return new VaultIntegrityError('A record did not read back exactly as written, so nothing was changed.');
}

/** Rewrites one database's records for `projectId` in a single transaction. */
async function rewriteDatabase(
  plan: DatabasePlan,
  projectId: string,
  direction: Direction,
  dataKey: Uint8Array,
  manifest: VaultManifest
): Promise<void> {
  const storeNames = plan.projectStoreName ? [plan.projectStoreName, ...plan.storeNames] : [...plan.storeNames];
  const transaction = plan.db.transaction(storeNames, 'readwrite');
  const committed = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new DOMException('The change was cancelled.', 'AbortError'));
  });
  committed.catch(() => undefined);

  const readOwned = async (storeName: string): Promise<StoredRecord[]> => {
    const store = transaction.objectStore(storeName);
    if (storeName === plan.projectStoreName) {
      const project = await requestToPromise(store.get(projectId));
      if (!project) throw new Error('That project no longer exists.');
      return [project as StoredRecord];
    }
    return (await requestToPromise(store.index(PROJECT_ID_INDEX).getAll(projectId))) as StoredRecord[];
  };

  try {
    // Plaintext of every record, keyed by store, to compare against at the end.
    const expected = new Map<string, Map<string, unknown>>();
    for (const storeName of storeNames) {
      const isProjectStore = storeName === plan.projectStoreName;
      const store = transaction.objectStore(storeName);
      const plain = new Map<string, unknown>();
      for (const record of await readOwned(storeName)) {
        const context = vaultRecordContext(plan.databaseName, storeName, projectId, record.id);
        const alreadySealed = isSealedRecord(record, isProjectStore);
        let value: unknown;
        let next: unknown;
        if (direction === 'seal') {
          if (alreadySealed) throw new VaultIntegrityError('Part of this project is already protected.');
          value = record;
          const sealed = sealRecord(dataKey, context, record);
          if (!sameJson(openRecord(dataKey, context, sealed), record)) throw rewriteFailed();
          next = isProjectStore ? {id: record.id, vaultManifest: manifest, sealed} : {id: record.id, projectId, sealed};
        } else {
          // A plaintext record here was written by a tab that missed the change; keep it.
          value = alreadySealed ? openRecord(dataKey, context, record.sealed as never) : record;
          next = value;
        }
        plain.set(String(record.id), value);
        await requestToPromise(store.put(next));
      }
      expected.set(storeName, plain);
    }

    // Read everything back inside the same transaction before it may commit.
    for (const storeName of storeNames) {
      const isProjectStore = storeName === plan.projectStoreName;
      const plain = expected.get(storeName)!;
      const stored = await readOwned(storeName);
      if (stored.length !== plain.size) throw rewriteFailed();
      for (const record of stored) {
        const sealed = isSealedRecord(record, isProjectStore);
        if (sealed !== (direction === 'seal')) throw rewriteFailed();
        const context = vaultRecordContext(plan.databaseName, storeName, projectId, record.id);
        const value = sealed ? openRecord(dataKey, context, record.sealed as never) : record;
        if (!sameJson(value, plain.get(String(record.id)))) throw rewriteFailed();
      }
    }
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // Already finished; the original error is what matters.
    }
    throw error;
  }
  await committed;
}

async function rewriteProject(projectId: string, direction: Direction, dataKey: Uint8Array, manifest: VaultManifest) {
  const main = await openRawDb();
  try {
    const mainPlan: DatabasePlan = {
      databaseName: DB_NAME,
      db: main,
      storeNames: PROJECT_INDEXED_STORE_NAMES,
      projectStoreName: PROJECT_STORE_NAME
    };
    await rewriteDatabase(mainPlan, projectId, direction, dataKey, manifest);
    try {
      const rulesetPlan: DatabasePlan = {
        databaseName: RULESETS_DATABASE_NAME,
        db: await openRawRulesetDb(),
        storeNames: [RULESET_STORE_NAME]
      };
      await rewriteDatabase(rulesetPlan, projectId, direction, dataKey, manifest);
    } catch (error) {
      // Put the main database back the way it was.
      await rewriteDatabase(mainPlan, projectId, direction === 'seal' ? 'open' : 'seal', dataKey, manifest);
      throw error;
    }
  } finally {
    main.close();
  }
}

async function readStoredManifest(projectId: string): Promise<VaultManifest> {
  const db = await openRawDb();
  try {
    const project = (await requestToPromise(
      db.transaction(PROJECT_STORE_NAME, 'readonly').objectStore(PROJECT_STORE_NAME).get(projectId)
    )) as StoredRecord | undefined;
    if (!project) throw new Error('That project no longer exists.');
    if (!project.vaultManifest) throw new Error('This project is not protected.');
    return readVaultManifest(project.vaultManifest);
  } finally {
    db.close();
  }
}

/** `null` for an unprotected project. */
export async function getProjectVaultState(projectId: string): Promise<VaultState | null> {
  await ensureVaultRegistry();
  return getVaultState(projectId);
}

/**
 * Protects a project with a passphrase. On success the project is protected
 * and unlocked in this session; on any failure it is unchanged.
 */
export async function enableProjectVault(
  projectId: string,
  passphrase: string,
  options: {label?: string; iterations?: number} = {}
): Promise<void> {
  await ensureVaultRegistry();
  if (isVaultProject(projectId)) throw new Error('This project is already protected.');
  // An older build kept unfinished mechanics text in localStorage. Bring it
  // through the primary storage seam before the sealing transaction starts.
  await migrateLegacyMechanicsDrafts(projectId);
  const {manifest, dataKey} = await createVaultKey(projectId, passphrase, options);
  beginVaultMigration(projectId, manifest, dataKey);
  try {
    // Retrieval and memory data hold plaintext excerpts. From here on they are
    // kept in memory for this project, so the on-disk copies are deleted first.
    // They are rebuilt from the project's records.
    await deleteProjectAuxiliaryStorage(projectId);
    await rewriteProject(projectId, 'seal', dataKey, manifest);
  } catch (error) {
    endVaultMigration(projectId, 'unprotected');
    throw error;
  }
  endVaultMigration(projectId, 'protected');
  moveProjectBrowserContentToMemory(projectId);
}

/** Removes protection. Needs the passphrase; on any failure the project stays protected. */
export async function disableProjectVault(projectId: string, passphrase: string): Promise<void> {
  await ensureVaultRegistry();
  const manifest = await readStoredManifest(projectId);
  const dataKey = await unwrapVaultKey(projectId, manifest, passphrase);
  const wasUnlocked = getVaultState(projectId) === 'unlocked';
  beginVaultMigration(projectId, manifest, dataKey);
  try {
    await rewriteProject(projectId, 'open', dataKey, manifest);
  } catch (error) {
    endVaultMigration(projectId, 'protected');
    if (!wasUnlocked) lockVault(projectId);
    throw error;
  }
  moveProjectBrowserContentToStorage(projectId);
  endVaultMigration(projectId, 'unprotected');
}

/** Unlocks a protected project for this session. Throws `VaultPassphraseError` on a wrong passphrase. */
export async function unlockProjectVault(projectId: string, passphrase: string): Promise<void> {
  await ensureVaultRegistry();
  const manifest = await readStoredManifest(projectId);
  unlockVault(projectId, await unwrapVaultKey(projectId, manifest, passphrase));
}

/** Forgets the project's key; its records stay sealed until it is unlocked again. */
export function lockProjectVault(projectId: string): void {
  lockVault(projectId);
}

/**
 * Changes the passphrase. Only the wrapped key is rewritten; records keep
 * their ciphertext. Needs the current passphrase even while unlocked.
 */
export async function changeProjectVaultPassphrase(
  projectId: string,
  currentPassphrase: string,
  newPassphrase: string
): Promise<void> {
  await ensureVaultRegistry();
  const manifest = await readStoredManifest(projectId);
  const dataKey = await unwrapVaultKey(projectId, manifest, currentPassphrase);
  try {
    const next = await rewrapVaultKey(projectId, manifest, dataKey, newPassphrase);
    const db = await openRawDb();
    try {
      const transaction = db.transaction(PROJECT_STORE_NAME, 'readwrite');
      const committed = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      committed.catch(() => undefined);
      const store = transaction.objectStore(PROJECT_STORE_NAME);
      const stored = (await requestToPromise(store.get(projectId))) as StoredRecord | undefined;
      const storedManifest = stored?.vaultManifest as VaultManifest | undefined;
      if (!stored || storedManifest?.wrappedKey.ct !== manifest.wrappedKey.ct) {
        transaction.abort();
        throw new Error('The passphrase was changed somewhere else. Try again.');
      }
      await requestToPromise(store.put({...stored, vaultManifest: next}));
      await committed;
    } finally {
      db.close();
    }
    updateVaultManifest(projectId, next);
  } finally {
    // An unlocked session keeps its own copy of the key; this one is temporary.
    dataKey.fill(0);
  }
}

/** The label a locked project shows, or null when it is not protected. */
export function getProjectVaultLabel(projectId: string): string | null {
  return getVaultManifest(projectId)?.label ?? null;
}
