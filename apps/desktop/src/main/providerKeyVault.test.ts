import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {ProviderKeyVault, type SecretCipher} from './providerKeyVault';

/** Reversible stand-in for safeStorage; the stored form must not be the key. */
const fakeCipher = (available = true): SecretCipher => ({
  isEncryptionAvailable: () => available,
  encryptString: (text) => Buffer.from(`enc:${[...text].reverse().join('')}`),
  decryptString: (data) => [...data.toString().slice(4)].reverse().join('')
});

const directories: string[] = [];
async function tempDir() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'key-vault-'));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})));
});

describe('ProviderKeyVault', () => {
  it('stores keys encrypted, reports status, and returns them only to the main process', async () => {
    const directory = await tempDir();
    const vault = new ProviderKeyVault({directory, cipher: fakeCipher()});

    await vault.set('anthropic', '  sk-ant-secret  ');
    const onDisk = await readFile(path.join(directory, 'provider-keys.json'), 'utf8');

    expect(onDisk).not.toContain('sk-ant-secret');
    expect(await vault.status()).toEqual({anthropic: true, openai: false, gemini: false});
    expect(await vault.get('anthropic')).toBe('sk-ant-secret');

    const reopened = new ProviderKeyVault({directory, cipher: fakeCipher()});
    expect(await reopened.get('anthropic')).toBe('sk-ant-secret');
  });

  it('clears one provider without touching the others', async () => {
    const vault = new ProviderKeyVault({directory: await tempDir(), cipher: fakeCipher()});
    await vault.set('openai', 'sk-one');
    await vault.set('gemini', 'AIza-two');
    await vault.clear('openai');

    expect(await vault.status()).toEqual({anthropic: false, openai: false, gemini: true});
    expect(await vault.get('openai')).toBeUndefined();
  });

  it('refuses to store anything when OS encryption is unavailable', async () => {
    const directory = await tempDir();
    const vault = new ProviderKeyVault({directory, cipher: fakeCipher(false)});

    await expect(vault.set('anthropic', 'sk-ant-secret')).rejects.toThrow(/Secure key storage is unavailable/);
    await expect(readFile(path.join(directory, 'provider-keys.json'), 'utf8')).rejects.toThrow();
  });

  it('rejects values that cannot be API keys', async () => {
    const vault = new ProviderKeyVault({directory: await tempDir(), cipher: fakeCipher()});
    for (const value of ['', '   ', 'two words', 'line\nbreak', 'x'.repeat(513)]) {
      await expect(vault.set('openai', value)).rejects.toThrow();
    }
  });
});
