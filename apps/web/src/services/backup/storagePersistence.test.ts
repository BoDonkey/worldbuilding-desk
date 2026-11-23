import {afterEach, describe, expect, it, vi} from 'vitest';
import {requestPersistentStorageOnce, resetPersistentStorageRequestForTests} from './storagePersistence';

function stubBrowser(storage: Partial<StorageManager> | undefined, electron = false) {
  vi.stubGlobal('window', electron ? {electronAPI: {}} : {});
  vi.stubGlobal('navigator', {storage});
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetPersistentStorageRequestForTests();
});

describe('persistent storage request (4.93)', () => {
  it('asks the browser once and reports a refusal', async () => {
    const persist = vi.fn(async () => false);
    stubBrowser({persisted: async () => false, persist});
    expect(await requestPersistentStorageOnce()).toBe('refused');
    expect(await requestPersistentStorageOnce()).toBe('refused');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does not ask again when storage is already persistent', async () => {
    const persist = vi.fn(async () => true);
    stubBrowser({persisted: async () => true, persist});
    expect(await requestPersistentStorageOnce()).toBe('persisted');
    expect(persist).not.toHaveBeenCalled();
  });

  it('never asks in the desktop app or without the API', async () => {
    const persist = vi.fn(async () => false);
    stubBrowser({persist}, true);
    expect(await requestPersistentStorageOnce()).toBe('not-applicable');
    resetPersistentStorageRequestForTests();
    stubBrowser(undefined);
    expect(await requestPersistentStorageOnce()).toBe('not-applicable');
    expect(persist).not.toHaveBeenCalled();
  });
});
