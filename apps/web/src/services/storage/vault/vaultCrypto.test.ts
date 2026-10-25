import {describe, expect, it} from 'vitest';
import {
  assertSealable,
  checkNewVaultPassphrase,
  createVaultKey,
  openRecord,
  readVaultManifest,
  rewrapVaultKey,
  sealRecord,
  unwrapVaultKey,
  VaultIntegrityError,
  VaultPassphraseError
} from './vaultCrypto';

const FAST = {iterations: 100_000};
const context = {store: 'worldbuilding-db/writingDocuments', projectId: 'p-1', id: 'scene-1'};

describe('vault keys and sealing (5.15a)', () => {
  it('wraps the data key to its project and passphrase, never storing either', async () => {
    const {manifest, dataKey} = await createVaultKey('p-1', 'correct horse battery', FAST);
    const text = JSON.stringify(manifest);
    expect(text).not.toContain('correct horse battery');
    expect(manifest).toMatchObject({version: 1, kdf: {name: 'PBKDF2', hash: 'SHA-256'}, label: 'Locked project'});
    expect(await unwrapVaultKey('p-1', manifest, 'correct horse battery')).toEqual(dataKey);
    // NFC: the same passphrase typed in another Unicode form.
    const {manifest: cafe, dataKey: cafeKey} = await createVaultKey('p-1', 'café passphrase', FAST);
    expect(await unwrapVaultKey('p-1', cafe, 'café passphrase')).toEqual(cafeKey);
    await expect(unwrapVaultKey('p-1', manifest, 'correct horse batterY')).rejects.toBeInstanceOf(VaultPassphraseError);
    // A manifest copied onto another project does not open there.
    await expect(unwrapVaultKey('p-2', manifest, 'correct horse battery')).rejects.toBeInstanceOf(VaultPassphraseError);
  });

  it('re-wraps the same data key under a new passphrase with a fresh salt', async () => {
    const {manifest, dataKey} = await createVaultKey('p-1', 'correct horse battery', FAST);
    const next = await rewrapVaultKey('p-1', manifest, dataKey, 'a brand new phrase');
    expect(next.kdf.salt).not.toBe(manifest.kdf.salt);
    expect(await unwrapVaultKey('p-1', next, 'a brand new phrase')).toEqual(dataKey);
    await expect(unwrapVaultKey('p-1', next, 'correct horse battery')).rejects.toBeInstanceOf(VaultPassphraseError);
  });

  it('binds a sealed record to its slot', async () => {
    const {dataKey} = await createVaultKey('p-1', 'correct horse battery', FAST);
    const record = {id: 'scene-1', projectId: 'p-1', content: '<p>the heron</p>', order: 2, tags: ['a'], gone: undefined};
    const sealed = sealRecord(dataKey, context, record);
    expect(JSON.stringify(sealed)).not.toContain('heron');
    expect(openRecord(dataKey, context, sealed)).toEqual({id: 'scene-1', projectId: 'p-1', content: '<p>the heron</p>', order: 2, tags: ['a']});
    for (const moved of [{...context, id: 'scene-2'}, {...context, projectId: 'p-2'}, {...context, store: 'worldbuilding-db/entities'}]) {
      expect(() => openRecord(dataKey, moved, sealed)).toThrow(VaultIntegrityError);
    }
    expect(sealRecord(dataKey, context, record).iv).not.toBe(sealed.iv);
  });

  it('refuses values a JSON round trip would change', () => {
    expect(() => assertSealable({a: [1, 'x', null, {b: true}]})).not.toThrow();
    for (const value of [{at: new Date()}, {n: Number.NaN}, {list: [undefined]}, {bytes: new Uint8Array(1)}, {map: new Map()}]) {
      expect(() => assertSealable(value)).toThrow(/cannot store/);
    }
  });

  it('refuses damaged manifests and asks for an update for a newer one', async () => {
    const {manifest} = await createVaultKey('p-1', 'correct horse battery', FAST);
    expect(() => readVaultManifest({...manifest, version: 2})).toThrow(/newer version of SagaSpine/);
    for (const damaged of [
      null,
      {...manifest, kdf: {...manifest.kdf, iterations: 1000}},
      {...manifest, kdf: {...manifest.kdf, hash: 'SHA-1'}},
      {...manifest, wrappedKey: {...manifest.wrappedKey, iv: 'AAAA'}},
      {...manifest, label: undefined}
    ]) {
      expect(() => readVaultManifest(damaged)).toThrow(VaultIntegrityError);
    }
  });

  it('checks a new passphrase for length and confirmation', async () => {
    expect(checkNewVaultPassphrase('short', 'short')).toMatch(/at least 8/);
    expect(checkNewVaultPassphrase('long enough', 'long enougH')).toMatch(/do not match/);
    expect(checkNewVaultPassphrase('long enough', 'long enough')).toBeNull();
    await expect(createVaultKey('p-1', 'short', FAST)).rejects.toThrow(/at least 8/);
  });
});
