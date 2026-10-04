import {openDb} from '../../db';

/**
 * One IndexedDB `readwrite` transaction across several stores. Everything a
 * unit of work writes either commits together or not at all.
 *
 * Rules for `work`:
 * - Only await this transaction's own requests (via the helpers below). An
 *   unrelated await (another database call, a timer, a fetch) lets IndexedDB
 *   auto-commit the transaction early. Read what you need before starting,
 *   plan in plain code, then commit here.
 * - Throwing aborts the transaction; nothing it wrote is kept.
 * - Change notifications go through `afterCommit`, so listeners never see a
 *   write that is later rolled back.
 */
export interface ProjectWriteTransaction {
  get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined>;
  getAll<T>(storeName: string): Promise<T[]>;
  put(storeName: string, value: unknown): Promise<void>;
  delete(storeName: string, key: IDBValidKey): Promise<void>;
  afterCommit(callback: () => void): void;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function runProjectWriteTransaction<R>(
  storeNames: readonly string[],
  work: (tx: ProjectWriteTransaction) => Promise<R>,
  options: {db?: IDBDatabase} = {}
): Promise<R> {
  const db = options.db ?? (await openDb());
  const transaction = db.transaction([...new Set(storeNames)], 'readwrite');
  const completed = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new DOMException('The write was cancelled.', 'AbortError'));
  });
  // Rejections are surfaced below; keep an abort from also reporting as unhandled.
  completed.catch(() => undefined);

  const callbacks = new Set<() => void>();
  const tx: ProjectWriteTransaction = {
    get: (storeName, key) => requestToPromise(transaction.objectStore(storeName).get(key)),
    getAll: (storeName) => requestToPromise(transaction.objectStore(storeName).getAll()),
    put: async (storeName, value) => {
      await requestToPromise(transaction.objectStore(storeName).put(value));
    },
    delete: async (storeName, key) => {
      await requestToPromise(transaction.objectStore(storeName).delete(key));
    },
    afterCommit: (callback) => {
      callbacks.add(callback);
    }
  };

  let result: R;
  try {
    result = await work(tx);
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // Already finished or aborted; the original error is what matters.
    }
    throw error;
  }
  await completed;
  callbacks.forEach((callback) => callback());
  return result;
}
