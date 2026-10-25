import {describe, expect, it} from 'vitest';
import {
  BackupPassphraseError,
  checkNewBackupPassphrase,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
  UnsupportedEncryptedBackupError
} from './backupEncryption';

// The real default (600,000) is slow under test; the floor accepted on import is 100,000.
const FAST = {iterations: 100_000};
const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 250, 251, 252]);

function edit(bytes: Uint8Array, change: (envelope: Record<string, any>) => void): Uint8Array {
  const envelope = JSON.parse(new TextDecoder().decode(bytes));
  change(envelope);
  return new TextEncoder().encode(JSON.stringify(envelope));
}

describe('backup encryption', () => {
  it('round-trips the backup bytes with the right passphrase', async () => {
    const encrypted = await encryptBackup(zip, 'correct horse battery', FAST);
    expect(isEncryptedBackup(encrypted)).toBe(true);
    expect(await decryptBackup(encrypted, 'correct horse battery')).toEqual(zip);
  });

  it('records versioned key-derivation and cipher settings but never the passphrase', async () => {
    const encrypted = await encryptBackup(zip, 'correct horse battery');
    const text = new TextDecoder().decode(encrypted);
    const envelope = JSON.parse(text);
    expect(envelope).toMatchObject({
      format: 'sagaspine-encrypted-backup',
      version: 1,
      payload: 'project-backup-zip',
      kdf: {name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000},
      cipher: {name: 'AES-GCM'}
    });
    expect(text).not.toContain('correct horse battery');
    // Fresh salt and IV each time.
    const again = JSON.parse(new TextDecoder().decode(await encryptBackup(zip, 'correct horse battery', FAST)));
    expect(again.kdf.salt).not.toBe(envelope.kdf.salt);
    expect(again.cipher.iv).not.toBe(envelope.cipher.iv);
  });

  it('fails closed on a wrong passphrase', async () => {
    const encrypted = await encryptBackup(zip, 'correct horse battery', FAST);
    await expect(decryptBackup(encrypted, 'correct horse batterY')).rejects.toBeInstanceOf(BackupPassphraseError);
  });

  it('treats the same passphrase in another Unicode form as the same passphrase', async () => {
    const composed = 'café passphrase';
    const decomposed = 'café passphrase';
    const encrypted = await encryptBackup(zip, composed, FAST);
    expect(await decryptBackup(encrypted, decomposed)).toEqual(zip);
  });

  it('refuses a file whose ciphertext or authenticated header was changed', async () => {
    const encrypted = await encryptBackup(zip, 'correct horse battery', FAST);
    const flipped = edit(encrypted, (envelope) => {
      const bytes = Uint8Array.from(atob(envelope.ciphertext), (c) => c.charCodeAt(0));
      bytes[0] ^= 1;
      envelope.ciphertext = btoa(String.fromCharCode(...bytes));
    });
    await expect(decryptBackup(flipped, 'correct horse battery')).rejects.toBeInstanceOf(BackupPassphraseError);
    const relabeled = edit(encrypted, (envelope) => {
      envelope.kdf.iterations = 100_001;
    });
    await expect(decryptBackup(relabeled, 'correct horse battery')).rejects.toBeInstanceOf(BackupPassphraseError);
  });

  it('asks for an app update for a newer envelope and refuses damaged or hostile settings', async () => {
    const encrypted = await encryptBackup(zip, 'correct horse battery', FAST);
    await expect(decryptBackup(edit(encrypted, (e) => (e.version = 2)), 'correct horse battery')).rejects.toThrow(
      /newer version of SagaSpine/
    );
    for (const change of [
      (e: Record<string, any>) => (e.kdf.iterations = 1000),
      (e: Record<string, any>) => (e.kdf.iterations = 50_000_000),
      (e: Record<string, any>) => (e.kdf.hash = 'SHA-1'),
      (e: Record<string, any>) => (e.cipher.iv = 'AAAA'),
      (e: Record<string, any>) => delete e.ciphertext
    ]) {
      await expect(decryptBackup(edit(encrypted, change), 'correct horse battery')).rejects.toBeInstanceOf(
        UnsupportedEncryptedBackupError
      );
    }
  });

  it('leaves plain backups alone', () => {
    expect(isEncryptedBackup(zip)).toBe(false);
    expect(isEncryptedBackup(new TextEncoder().encode('{"schemaVersion": 6}'))).toBe(false);
    expect(isEncryptedBackup(new TextEncoder().encode('{not json'))).toBe(false);
  });

  it('checks a new passphrase for length and a matching confirmation', async () => {
    expect(checkNewBackupPassphrase('short', 'short')).toMatch(/at least 8/);
    expect(checkNewBackupPassphrase('long enough', 'long enougH')).toMatch(/do not match/);
    expect(checkNewBackupPassphrase('long enough', 'long enough')).toBeNull();
    await expect(encryptBackup(zip, 'short', FAST)).rejects.toThrow(/at least 8/);
  });
});
