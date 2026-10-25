/**
 * Storage for rebuildable per-project data: retrieval chunks and project
 * memories (slice 5.15b).
 *
 * An unprotected project keeps these in its own IndexedDB database, as
 * before. A protected project keeps them only in memory, so no plaintext copy
 * of its text is written to disk; they are rebuilt from the project's own
 * records after unlock and dropped when it locks.
 */
import {openDB, type IDBPDatabase} from 'idb';
import {ensureVaultRegistry} from './db';
import {getVaultState, isVaultProject, subscribeVaultChanges} from './vault/vaultRegistry';

export interface DerivedRecord {
  id: string;
  documentId: string;
}

export interface DerivedRecordStore<T extends DerivedRecord> {
  /** True when nothing is written to disk. */
  readonly inMemory: boolean;
  put(record: T): Promise<void>;
  /** Every record, in id order. */
  getAll(): Promise<T[]>;
  delete(id: string): Promise<void>;
  deleteByDocument(documentId: string): Promise<void>;
  close(): void;
}

export interface DerivedStoreOptions {
  projectId: string;
  databaseName: string;
  version: number;
  storeName: string;
  /** Creates the store (with a `by-document` index) in the on-disk database. */
  upgrade: (db: IDBPDatabase<unknown>) => void;
  /** Another connection needs the database closed (deletion or upgrade). */
  onBlocking?: () => void;
}

/**
 * In-memory records, shared by every handle on the same database name (a
 * project's primary and inherited views open separate handles). Dropped
 * when the project locks or stops being protected.
 */
const memoryDatabases = new Map<string, {projectId: string; records: Map<string, unknown>}>();

subscribeVaultChanges((projectId) => {
  const state = getVaultState(projectId);
  if (state === 'unlocked' || state === 'migrating') return;
  for (const [name, database] of memoryDatabases) {
    if (database.projectId === projectId) memoryDatabases.delete(name);
  }
});

class MemoryRecordStore<T extends DerivedRecord> implements DerivedRecordStore<T> {
  readonly inMemory = true;
  private closed = false;
  private readonly databaseName: string;
  private readonly projectId: string;

  constructor(databaseName: string, projectId: string) {
    this.databaseName = databaseName;
    this.projectId = projectId;
  }

  private records(): Map<string, T> {
    if (this.closed) throw new Error('This project context database has been closed.');
    let database = memoryDatabases.get(this.databaseName);
    if (!database) {
      // Nothing is kept for a project that has since locked.
      if (getVaultState(this.projectId) === 'locked') throw new Error('This project is locked.');
      database = {projectId: this.projectId, records: new Map()};
      memoryDatabases.set(this.databaseName, database);
    }
    return database.records as Map<string, T>;
  }

  async put(record: T): Promise<void> {
    this.records().set(record.id, structuredClone(record));
  }

  async getAll(): Promise<T[]> {
    return [...this.records().values()]
      .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
      .map((record) => structuredClone(record));
  }

  async delete(id: string): Promise<void> {
    this.records().delete(id);
  }

  async deleteByDocument(documentId: string): Promise<void> {
    const records = this.records();
    for (const [id, record] of records) {
      if (record.documentId === documentId) records.delete(id);
    }
  }

  close(): void {
    this.closed = true;
  }
}

class IndexedDbRecordStore<T extends DerivedRecord> implements DerivedRecordStore<T> {
  readonly inMemory = false;

  private db: IDBPDatabase<unknown> | null;
  private readonly storeName: string;

  constructor(db: IDBPDatabase<unknown>, storeName: string) {
    this.db = db;
    this.storeName = storeName;
  }

  private requireDb(): IDBPDatabase<any> {
    if (!this.db) throw new Error('This project context database has been closed.');
    return this.db;
  }

  async put(record: T): Promise<void> {
    await this.requireDb().put(this.storeName, record);
  }

  async getAll(): Promise<T[]> {
    return this.requireDb().getAll(this.storeName);
  }

  async delete(id: string): Promise<void> {
    await this.requireDb().delete(this.storeName, id);
  }

  async deleteByDocument(documentId: string): Promise<void> {
    const tx = this.requireDb().transaction(this.storeName, 'readwrite');
    let cursor = await tx.store.index('by-document').openCursor(documentId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }
}

/** Opens the derived store for a project: in memory when the project is protected, on disk otherwise. */
export async function openDerivedRecordStore<T extends DerivedRecord>(
  options: DerivedStoreOptions
): Promise<DerivedRecordStore<T>> {
  await ensureVaultRegistry();
  if (isVaultProject(options.projectId)) return new MemoryRecordStore<T>(options.databaseName, options.projectId);
  let store: IndexedDbRecordStore<T> | null = null;
  const db = await openDB(options.databaseName, options.version, {
    upgrade: (database) => options.upgrade(database),
    blocking: () => {
      store?.close();
      options.onBlocking?.();
    }
  });
  store = new IndexedDbRecordStore<T>(db, options.storeName);
  return store;
}
