import {registerDiagnosticSecrets} from '../errors/diagnostics';

export const HOSTED_PROVIDER_IDS = ['anthropic', 'openai', 'gemini'] as const;
export type HostedProviderId = (typeof HOSTED_PROVIDER_IDS)[number];
export type ProviderKeyStatus = Record<HostedProviderId, boolean>;

/** Where the browser-only dev build keeps keys (and where older desktop builds kept them). */
const BROWSER_STORAGE_KEYS: Record<HostedProviderId, string> = {
  anthropic: 'anthropic_api_key',
  openai: 'openai_api_key',
  gemini: 'gemini_api_key'
};

let cachedStatus: ProviderKeyStatus | null = null;

function desktopVault(): ElectronProviderKeysAPI | undefined {
  return typeof window === 'undefined' ? undefined : window.electronAPI?.providerKeys;
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function readBrowserStatus(): ProviderKeyStatus {
  const storage = browserStorage();
  return {
    anthropic: Boolean(storage?.getItem(BROWSER_STORAGE_KEYS.anthropic)),
    openai: Boolean(storage?.getItem(BROWSER_STORAGE_KEYS.openai)),
    gemini: Boolean(storage?.getItem(BROWSER_STORAGE_KEYS.gemini))
  };
}

/**
 * True in the desktop app, where keys live in the main process (OS-encrypted)
 * and the renderer can only set, clear, or check them.
 */
export function usesDesktopKeyVault(): boolean {
  return Boolean(desktopVault());
}

/** Which hosted providers have a saved key. Never returns key values. */
export async function getProviderKeyStatus(): Promise<ProviderKeyStatus> {
  const vault = desktopVault();
  if (!vault) return readBrowserStatus();
  cachedStatus = await vault.status();
  return cachedStatus;
}

/**
 * Last known status, for synchronous checks. In the browser build it is read
 * directly; in the desktop app it is null until the first status call.
 */
export function getCachedProviderKeyStatus(): ProviderKeyStatus | null {
  return desktopVault() ? cachedStatus : readBrowserStatus();
}

export async function saveProviderKey(provider: HostedProviderId, key: string): Promise<ProviderKeyStatus> {
  const trimmed = key.trim();
  if (!trimmed) throw new Error('API key is empty.');
  const vault = desktopVault();
  if (vault) {
    cachedStatus = await vault.set(provider, trimmed);
    return cachedStatus;
  }
  browserStorage()?.setItem(BROWSER_STORAGE_KEYS[provider], trimmed);
  registerBrowserKeySecrets();
  return getProviderKeyStatus();
}

export async function clearProviderKey(provider: HostedProviderId): Promise<ProviderKeyStatus> {
  const vault = desktopVault();
  if (vault) {
    cachedStatus = await vault.clear(provider);
    return cachedStatus;
  }
  browserStorage()?.removeItem(BROWSER_STORAGE_KEYS[provider]);
  registerBrowserKeySecrets();
  return getProviderKeyStatus();
}

/**
 * The key itself, for the browser-only dev build, where the renderer calls
 * providers directly. Always undefined in the desktop app.
 */
export function readBrowserProviderKey(provider: HostedProviderId): string | undefined {
  if (desktopVault()) return undefined;
  return browserStorage()?.getItem(BROWSER_STORAGE_KEYS[provider]) ?? undefined;
}

/** Keeps browser-build keys out of copyable diagnostics. */
export function registerBrowserKeySecrets(extra: readonly (string | undefined)[] = []): void {
  registerDiagnosticSecrets([
    ...HOSTED_PROVIDER_IDS.map((provider) => readBrowserProviderKey(provider)),
    ...extra
  ]);
}

/**
 * Desktop app: moves keys that older builds left in plaintext localStorage
 * into the OS-encrypted vault, removing each plaintext copy only after the
 * vault accepted it. A key already in the vault wins and the stale copy is
 * removed. Returns the providers whose keys moved.
 */
export async function migrateBrowserKeysToDesktopVault(): Promise<HostedProviderId[]> {
  const vault = desktopVault();
  const storage = browserStorage();
  if (!vault || !storage) return [];
  const status = await vault.status();
  const moved: HostedProviderId[] = [];
  for (const provider of HOSTED_PROVIDER_IDS) {
    const storageKey = BROWSER_STORAGE_KEYS[provider];
    const legacy = storage.getItem(storageKey);
    if (!legacy) continue;
    if (!status[provider]) {
      await vault.set(provider, legacy.trim());
      moved.push(provider);
    }
    storage.removeItem(storageKey);
  }
  cachedStatus = await vault.status();
  return moved;
}
