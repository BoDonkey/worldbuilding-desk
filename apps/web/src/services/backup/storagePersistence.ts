/**
 * The web build asks the browser once per session to keep SagaSpine's data
 * (`navigator.storage.persist()`, slice 4.93). A browser that refuses may
 * clear it when space runs low, so the backup reminder says so. The desktop
 * app keeps its data in its own folder and never asks.
 */

export type StoragePersistence = 'persisted' | 'refused' | 'not-applicable';

let request: Promise<StoragePersistence> | null = null;

export function requestPersistentStorageOnce(): Promise<StoragePersistence> {
  request ??= askForPersistentStorage();
  return request;
}

async function askForPersistentStorage(): Promise<StoragePersistence> {
  if (typeof window === 'undefined' || window.electronAPI) return 'not-applicable';
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
  if (!storage?.persist) return 'not-applicable';
  try {
    if (storage.persisted && (await storage.persisted())) return 'persisted';
    return (await storage.persist()) ? 'persisted' : 'refused';
  } catch {
    return 'not-applicable';
  }
}

/** For tests: forget the answer so the next call asks again. */
export function resetPersistentStorageRequestForTests(): void {
  request = null;
}

export const STORAGE_MAY_BE_CLEARED_NOTE =
  'This browser has not agreed to keep SagaSpine data, so it may clear it when space runs low.';
