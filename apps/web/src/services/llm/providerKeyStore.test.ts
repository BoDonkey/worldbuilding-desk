import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  clearProviderKey,
  getCachedProviderKeyStatus,
  getProviderKeyStatus,
  migrateBrowserKeysToDesktopVault,
  readBrowserProviderKey,
  saveProviderKey,
  usesDesktopKeyVault
} from './providerKeyStore';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key)
  };
}

function fakeVault(initial: Partial<Record<'anthropic' | 'openai' | 'gemini', string>> = {}) {
  const keys = new Map(Object.entries(initial));
  const status = () => ({anthropic: keys.has('anthropic'), openai: keys.has('openai'), gemini: keys.has('gemini')});
  return {
    keys,
    status: vi.fn(async () => status()),
    set: vi.fn(async (provider: string, key: string) => {
      keys.set(provider, key);
      return status();
    }),
    clear: vi.fn(async (provider: string) => {
      keys.delete(provider);
      return status();
    })
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('browser build', () => {
  it('keeps keys in browser storage under the existing names', async () => {
    const localStorage = memoryStorage();
    vi.stubGlobal('window', {localStorage});

    expect(usesDesktopKeyVault()).toBe(false);
    await saveProviderKey('anthropic', '  sk-ant-1  ');
    expect(localStorage.data.get('anthropic_api_key')).toBe('sk-ant-1');
    expect(readBrowserProviderKey('anthropic')).toBe('sk-ant-1');
    expect(await getProviderKeyStatus()).toEqual({anthropic: true, openai: false, gemini: false});

    await clearProviderKey('anthropic');
    expect(getCachedProviderKeyStatus()).toEqual({anthropic: false, openai: false, gemini: false});
  });

  it('refuses an empty key', async () => {
    vi.stubGlobal('window', {localStorage: memoryStorage()});
    await expect(saveProviderKey('openai', '   ')).rejects.toThrow(/empty/);
  });
});

describe('desktop app', () => {
  it('never reads a key in the renderer and caches status from the vault', async () => {
    const providerKeys = fakeVault({gemini: 'AIza-1'});
    vi.stubGlobal('window', {localStorage: memoryStorage({gemini_api_key: 'stale'}), electronAPI: {providerKeys}});

    expect(usesDesktopKeyVault()).toBe(true);
    expect(readBrowserProviderKey('gemini')).toBeUndefined();
    expect(getCachedProviderKeyStatus()).toBeNull();
    await getProviderKeyStatus();
    expect(getCachedProviderKeyStatus()).toEqual({anthropic: false, openai: false, gemini: true});

    await saveProviderKey('openai', 'sk-2');
    expect(providerKeys.set).toHaveBeenCalledWith('openai', 'sk-2');
    expect(getCachedProviderKeyStatus()?.openai).toBe(true);
  });

  it('moves plaintext keys into the vault and removes each copy only after it is stored', async () => {
    const localStorage = memoryStorage({openai_api_key: ' sk-legacy ', gemini_api_key: 'AIza-stale'});
    const providerKeys = fakeVault({gemini: 'AIza-current'});
    vi.stubGlobal('window', {localStorage, electronAPI: {providerKeys}});

    expect(await migrateBrowserKeysToDesktopVault()).toEqual(['openai']);
    expect(providerKeys.keys.get('openai')).toBe('sk-legacy');
    expect(providerKeys.keys.get('gemini')).toBe('AIza-current');
    expect(localStorage.data.size).toBe(0);
  });

  it('keeps the plaintext copy when the vault refuses it', async () => {
    const localStorage = memoryStorage({anthropic_api_key: 'sk-ant-legacy'});
    const providerKeys = fakeVault();
    providerKeys.set.mockRejectedValueOnce(new Error('Secure key storage is unavailable'));
    vi.stubGlobal('window', {localStorage, electronAPI: {providerKeys}});

    await expect(migrateBrowserKeysToDesktopVault()).rejects.toThrow(/unavailable/);
    expect(localStorage.data.get('anthropic_api_key')).toBe('sk-ant-legacy');
  });

  it('does nothing in the browser build', async () => {
    const localStorage = memoryStorage({openai_api_key: 'sk-browser'});
    vi.stubGlobal('window', {localStorage});

    expect(await migrateBrowserKeysToDesktopVault()).toEqual([]);
    expect(localStorage.data.get('openai_api_key')).toBe('sk-browser');
  });
});
