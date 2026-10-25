/**
 * The vault seam (slice 5.15a): wraps an IndexedDB connection so that records
 * of protected projects are sealed on every write and opened on every read.
 *
 * Repositories keep using plain `get`, `getAll`, `put`, `delete`, and
 * `index(...).getAll` and never see ciphertext while a project is unlocked.
 * A locked project's records come back still sealed (only `id` and
 * `projectId` readable); its project record comes back as a placeholder named
 * by the manifest label. Writing to a locked project throws `VaultLockedError`.
 * Cursors are refused, because `cursor.update` would bypass sealing.
 */
import {DEFAULT_VAULT_LABEL, isSealedPayload, openRecord, sealRecord, type SealContext} from './vaultCrypto';
import {getReadKey, getVaultManifest, getWriteKey, isVaultProject} from './vaultRegistry';

export interface VaultDatabaseOptions {
  /** Distinguishes databases in the authenticated data, so records cannot move between them. */
  databaseName: string;
  /** The store whose records are projects (keyed by project id), if this database has one. */
  projectStoreName?: string;
}

export interface StoredRecord {
  id?: unknown;
  projectId?: unknown;
  sealed?: unknown;
  vaultManifest?: unknown;
}

interface StoreCodec {
  encode(value: unknown): unknown;
  decode(raw: unknown): unknown;
}

/** The slot a record is sealed to: its database and store, project, and id. */
export function vaultRecordContext(
  databaseName: string,
  storeName: string,
  projectId: string,
  id: unknown
): SealContext {
  return {store: `${databaseName}/${storeName}`, projectId, id: String(id)};
}

/** True for a record already in sealed form, which is stored as given. */
export function isSealedRecord(value: StoredRecord, isProjectStore: boolean): boolean {
  if (!isSealedPayload(value.sealed)) return false;
  const allowed = isProjectStore ? ['id', 'vaultManifest', 'sealed'] : ['id', 'projectId', 'sealed'];
  return Object.keys(value).every((key) => allowed.includes(key));
}

function storeCodec(options: VaultDatabaseOptions, storeName: string): StoreCodec {
  const isProjectStore = storeName === options.projectStoreName;
  const ownerOf = (record: StoredRecord): unknown => (isProjectStore ? record.id : record.projectId);
  const contextFor = (record: StoredRecord, projectId: string): SealContext =>
    vaultRecordContext(options.databaseName, storeName, projectId, record.id);

  return {
    encode(value) {
      if (!value || typeof value !== 'object') return value;
      const record = value as StoredRecord;
      const projectId = ownerOf(record);
      if (typeof projectId !== 'string' || !isVaultProject(projectId)) return value;
      if (isSealedRecord(record, isProjectStore)) return value;
      const sealed = sealRecord(getWriteKey(projectId), contextFor(record, projectId), value);
      return isProjectStore
        ? {id: record.id, vaultManifest: getVaultManifest(projectId), sealed}
        : {id: record.id, projectId, sealed};
    },
    decode(raw) {
      if (!raw || typeof raw !== 'object') return raw;
      const record = raw as StoredRecord;
      if (!isSealedPayload(record.sealed)) return raw;
      const projectId = ownerOf(record);
      const key = typeof projectId === 'string' ? getReadKey(projectId) : null;
      if (!key) {
        if (!isProjectStore) return raw;
        const label = (record.vaultManifest as {label?: unknown} | undefined)?.label;
        return {
          id: record.id,
          name: typeof label === 'string' && label.trim() ? label : DEFAULT_VAULT_LABEL,
          createdAt: 0,
          updatedAt: 0
        };
      }
      return openRecord(key, contextFor(record, projectId as string), record.sealed);
    }
  };
}

/** Forwards everything to `target` except `overrides`, binding methods to the real object. */
function forward<T extends object>(target: T, overrides: Record<string, unknown>): T {
  return new Proxy(target, {
    get(object, property) {
      if (typeof property === 'string' && Object.prototype.hasOwnProperty.call(overrides, property)) {
        return overrides[property];
      }
      const value = Reflect.get(object, property, object);
      return typeof value === 'function' ? value.bind(object) : value;
    },
    set(object, property, value) {
      return Reflect.set(object, property, value, object);
    }
  });
}

/**
 * A request whose `result` is decoded before the caller's `onsuccess` runs. A
 * record that fails to open is reported through `onerror` with the
 * `VaultIntegrityError` as `request.error`.
 */
function wrapRequest<T>(request: IDBRequest<T>, decode: (raw: T) => unknown): IDBRequest {
  let onsuccess: ((this: IDBRequest, event: Event) => unknown) | null = null;
  let onerror: ((this: IDBRequest, event: Event) => unknown) | null = null;
  let result: unknown;
  let decodeError: unknown = null;

  const wrapped = new Proxy(request, {
    get(object, property) {
      switch (property) {
        case 'result':
          return result;
        case 'error':
          return decodeError ?? object.error;
        case 'onsuccess':
          return onsuccess;
        case 'onerror':
          return onerror;
      }
      const value = Reflect.get(object, property, object);
      return typeof value === 'function' ? value.bind(object) : value;
    },
    set(object, property, value) {
      if (property === 'onsuccess') onsuccess = value;
      else if (property === 'onerror') onerror = value;
      else return Reflect.set(object, property, value, object);
      return true;
    }
  });

  request.onsuccess = (event) => {
    try {
      result = decode(request.result);
    } catch (error) {
      decodeError = error;
      onerror?.call(wrapped, event);
      return;
    }
    onsuccess?.call(wrapped, event);
  };
  request.onerror = (event) => {
    onerror?.call(wrapped, event);
  };
  return wrapped;
}

function refuseCursor(): never {
  throw new Error('Cursors are not available on project storage; read with get or getAll.');
}

function decodeAll(codec: StoreCodec) {
  return (records: unknown[]) => records.map((record) => codec.decode(record));
}

function wrapIndex(index: IDBIndex, codec: StoreCodec, store: IDBObjectStore): IDBIndex {
  return forward(index, {
    objectStore: store,
    get: (query: IDBValidKey | IDBKeyRange) => wrapRequest(index.get(query), (raw) => codec.decode(raw)),
    getAll: (query?: IDBValidKey | IDBKeyRange | null, count?: number) =>
      wrapRequest(index.getAll(query, count), decodeAll(codec)),
    openCursor: refuseCursor
  });
}

function wrapStore(
  store: IDBObjectStore,
  transaction: IDBTransaction,
  options: VaultDatabaseOptions
): IDBObjectStore {
  const codec = storeCodec(options, store.name);
  const wrapped: IDBObjectStore = forward(store, {
    transaction,
    get: (query: IDBValidKey | IDBKeyRange) => wrapRequest(store.get(query), (raw) => codec.decode(raw)),
    getAll: (query?: IDBValidKey | IDBKeyRange | null, count?: number) =>
      wrapRequest(store.getAll(query, count), decodeAll(codec)),
    put: (value: unknown, key?: IDBValidKey) =>
      key === undefined ? store.put(codec.encode(value)) : store.put(codec.encode(value), key),
    add: (value: unknown, key?: IDBValidKey) =>
      key === undefined ? store.add(codec.encode(value)) : store.add(codec.encode(value), key),
    index: (name: string) => wrapIndex(store.index(name), codec, wrapped),
    openCursor: refuseCursor
  });
  return wrapped;
}

function wrapTransaction(transaction: IDBTransaction, db: IDBDatabase, options: VaultDatabaseOptions): IDBTransaction {
  const wrapped: IDBTransaction = forward(transaction, {
    db,
    objectStore: (name: string) => wrapStore(transaction.objectStore(name), wrapped, options)
  });
  return wrapped;
}

/** Returns a connection that seals and opens protected projects' records. */
export function wrapVaultDatabase(db: IDBDatabase, options: VaultDatabaseOptions): IDBDatabase {
  const wrapped: IDBDatabase = forward(db, {
    transaction: (storeNames: string | string[], mode?: IDBTransactionMode, txOptions?: IDBTransactionOptions) =>
      wrapTransaction(db.transaction(storeNames, mode, txOptions), wrapped, options)
  });
  return wrapped;
}
