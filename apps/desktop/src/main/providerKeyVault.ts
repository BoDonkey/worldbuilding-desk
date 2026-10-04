import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';

export const HOSTED_PROVIDER_IDS = ['anthropic', 'openai', 'gemini'] as const;
export type HostedProviderId = (typeof HOSTED_PROVIDER_IDS)[number];
export type ProviderKeyStatus = Record<HostedProviderId, boolean>;

/** The subset of Electron's `safeStorage` the vault uses, injectable for tests. */
export interface SecretCipher {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

const MAX_KEY_LENGTH = 512;

export function isHostedProviderId(value: unknown): value is HostedProviderId {
  return typeof value === 'string' && (HOSTED_PROVIDER_IDS as readonly string[]).includes(value);
}

/** Rejects anything that cannot be a provider API key before it is encrypted or sent. */
export function assertValidProviderKey(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('API key must be a non-empty string');
  }
  if (value.length > MAX_KEY_LENGTH || /\s/.test(value.trim()) || /[\r\n]/.test(value)) {
    throw new Error('API key has an unexpected format');
  }
}

/**
 * Provider API keys held by the main process, encrypted with the OS keychain
 * via `safeStorage` and written to one file under the app's user data folder.
 * The renderer can set, clear, and ask which providers have a key; it can
 * never read a key back. Refuses to store anything when OS encryption is
 * unavailable rather than falling back to plaintext.
 */
export class ProviderKeyVault {
  private readonly filePath: string;
  private readonly cipher: SecretCipher;
  private cache: Partial<Record<HostedProviderId, string>> | null = null;

  constructor(params: {directory: string; cipher: SecretCipher; fileName?: string}) {
    this.filePath = path.join(params.directory, params.fileName ?? 'provider-keys.json');
    this.cipher = params.cipher;
  }

  async status(): Promise<ProviderKeyStatus> {
    const stored = await this.load();
    return {
      anthropic: Boolean(stored.anthropic),
      openai: Boolean(stored.openai),
      gemini: Boolean(stored.gemini)
    };
  }

  async set(provider: HostedProviderId, key: string): Promise<void> {
    assertValidProviderKey(key);
    if (!this.cipher.isEncryptionAvailable()) {
      throw new Error(
        'Secure key storage is unavailable on this computer, so the API key was not saved.'
      );
    }
    const stored = await this.load();
    stored[provider] = this.cipher.encryptString(key.trim()).toString('base64');
    await this.persist(stored);
  }

  async clear(provider: HostedProviderId): Promise<void> {
    const stored = await this.load();
    if (!(provider in stored)) return;
    delete stored[provider];
    await this.persist(stored);
  }

  /** Main-process only. Never expose this over IPC. */
  async get(provider: HostedProviderId): Promise<string | undefined> {
    const encrypted = (await this.load())[provider];
    if (!encrypted) return undefined;
    return this.cipher.decryptString(Buffer.from(encrypted, 'base64'));
  }

  private async load(): Promise<Partial<Record<HostedProviderId, string>>> {
    if (this.cache) return this.cache;
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const stored: Partial<Record<HostedProviderId, string>> = {};
    if (parsed && typeof parsed === 'object') {
      for (const [provider, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (isHostedProviderId(provider) && typeof value === 'string' && value) {
          stored[provider] = value;
        }
      }
    }
    this.cache = stored;
    return stored;
  }

  private async persist(stored: Partial<Record<HostedProviderId, string>>): Promise<void> {
    await mkdir(path.dirname(this.filePath), {recursive: true});
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(stored), {encoding: 'utf8', mode: 0o600});
    await rename(temporary, this.filePath);
    this.cache = stored;
  }
}
