/**
 * Keys and record sealing for project vaults (slice 5.15a).
 *
 * A protected project owns a random 256-bit data key. The author's passphrase
 * derives a key-encryption key (PBKDF2-SHA256) that wraps the data key with
 * AES-256-GCM; only the wrapped key is stored. Records are sealed with the data
 * key using synchronous AES-256-GCM, because sealing happens inside IndexedDB
 * transactions, which commit as soon as their code awaits anything else.
 */
import {gcm} from '@noble/ciphers/aes.js';
import {fromBase64, toBase64} from '../base64';
import {MIN_BACKUP_PASSPHRASE_LENGTH} from '../backupEncryption';

export const VAULT_FORMAT_VERSION = 1;
export const DEFAULT_VAULT_LABEL = 'Locked project';
export const MIN_VAULT_PASSPHRASE_LENGTH = MIN_BACKUP_PASSPHRASE_LENGTH;

const DEFAULT_ITERATIONS = 600_000;
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 10_000_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** The only part of a protected project stored in the clear, besides its id. */
export interface VaultManifest {
  version: typeof VAULT_FORMAT_VERSION;
  kdf: {name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string};
  wrappedKey: {name: 'AES-GCM'; iv: string; ct: string};
  label: string;
}

/** A sealed record body. */
export interface SealedPayload {
  v: typeof VAULT_FORMAT_VERSION;
  iv: string;
  ct: string;
}

/** Names the slot a record lives in; sealing binds the ciphertext to it. */
export interface SealContext {
  store: string;
  projectId: string;
  id: string;
}

/** The passphrase does not open this project. */
export class VaultPassphraseError extends Error {
  constructor() {
    super('That passphrase does not unlock this project. Check it and try again.');
    this.name = 'VaultPassphraseError';
  }
}

/** Stored vault data is damaged, was changed, or comes from a newer app version. */
export class VaultIntegrityError extends Error {
  constructor(message = 'Part of this protected project is damaged or was changed, so it cannot be opened.') {
    super(message);
    this.name = 'VaultIntegrityError';
  }
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});

function wrapAad(projectId: string, manifest: Pick<VaultManifest, 'version' | 'kdf'>): Uint8Array {
  return encoder.encode(
    JSON.stringify({
      purpose: 'sagaspine-vault-key',
      version: manifest.version,
      projectId,
      kdf: {
        name: manifest.kdf.name,
        hash: manifest.kdf.hash,
        iterations: manifest.kdf.iterations,
        salt: manifest.kdf.salt
      }
    })
  );
}

function recordAad(context: SealContext): Uint8Array {
  return encoder.encode(
    JSON.stringify({
      purpose: 'sagaspine-vault-record',
      version: VAULT_FORMAT_VERSION,
      store: context.store,
      projectId: context.projectId,
      id: context.id
    })
  );
}

async function deriveKeyEncryptionKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {name: 'PBKDF2', hash: 'SHA-256', salt, iterations},
    material,
    KEY_BYTES * 8
  );
  return new Uint8Array(bits);
}

/** Problems with a passphrase the author is choosing, or null when it can be used. */
export function checkNewVaultPassphrase(passphrase: string, confirmation: string): string | null {
  if (passphrase.length < MIN_VAULT_PASSPHRASE_LENGTH) {
    return `Use at least ${MIN_VAULT_PASSPHRASE_LENGTH} characters.`;
  }
  if (passphrase !== confirmation) return 'The two passphrases do not match.';
  return null;
}

async function wrapDataKey(
  projectId: string,
  dataKey: Uint8Array,
  passphrase: string,
  options: {iterations?: number; label?: string}
): Promise<VaultManifest> {
  if (passphrase.length < MIN_VAULT_PASSPHRASE_LENGTH) {
    throw new Error(`A project passphrase needs at least ${MIN_VAULT_PASSPHRASE_LENGTH} characters.`);
  }
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const salt = randomBytes(SALT_BYTES);
  const header = {
    version: VAULT_FORMAT_VERSION,
    kdf: {name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt)}
  } as const;
  const kek = await deriveKeyEncryptionKey(passphrase, salt, iterations);
  const iv = randomBytes(IV_BYTES);
  const ct = gcm(kek, iv, wrapAad(projectId, header)).encrypt(dataKey);
  kek.fill(0);
  return {
    ...header,
    wrappedKey: {name: 'AES-GCM', iv: toBase64(iv), ct: toBase64(ct)},
    label: options.label?.trim() || DEFAULT_VAULT_LABEL
  };
}

/** Makes a new data key and the manifest that wraps it under `passphrase`. */
export async function createVaultKey(
  projectId: string,
  passphrase: string,
  options: {iterations?: number; label?: string} = {}
): Promise<{manifest: VaultManifest; dataKey: Uint8Array}> {
  const dataKey = randomBytes(KEY_BYTES);
  const manifest = await wrapDataKey(projectId, dataKey, passphrase, options);
  return {manifest, dataKey};
}

/** Wraps an unlocked project's data key under a new passphrase (fresh salt); records are untouched. */
export function rewrapVaultKey(
  projectId: string,
  manifest: VaultManifest,
  dataKey: Uint8Array,
  newPassphrase: string,
  options: {iterations?: number} = {}
): Promise<VaultManifest> {
  return wrapDataKey(projectId, dataKey, newPassphrase, {
    iterations: options.iterations ?? manifest.kdf.iterations,
    label: manifest.label
  });
}

/** Checks a stored manifest before trusting its settings. */
export function readVaultManifest(raw: unknown): VaultManifest {
  const manifest = raw as Partial<VaultManifest> | null;
  if (!manifest || typeof manifest !== 'object' || typeof manifest.version !== 'number') {
    throw new VaultIntegrityError();
  }
  if (manifest.version > VAULT_FORMAT_VERSION) {
    throw new VaultIntegrityError(
      'This project was protected by a newer version of SagaSpine. Update the app to open it.'
    );
  }
  const {kdf, wrappedKey} = manifest;
  if (
    manifest.version !== VAULT_FORMAT_VERSION ||
    kdf?.name !== 'PBKDF2' ||
    kdf.hash !== 'SHA-256' ||
    !Number.isSafeInteger(kdf.iterations) ||
    kdf.iterations < MIN_ITERATIONS ||
    kdf.iterations > MAX_ITERATIONS ||
    typeof kdf.salt !== 'string' ||
    wrappedKey?.name !== 'AES-GCM' ||
    typeof wrappedKey.iv !== 'string' ||
    typeof wrappedKey.ct !== 'string' ||
    typeof manifest.label !== 'string'
  ) {
    throw new VaultIntegrityError();
  }
  try {
    if (fromBase64(kdf.salt).length !== SALT_BYTES || fromBase64(wrappedKey.iv).length !== IV_BYTES) {
      throw new VaultIntegrityError();
    }
    fromBase64(wrappedKey.ct);
  } catch {
    throw new VaultIntegrityError();
  }
  return manifest as VaultManifest;
}

/** Returns the project's data key. Fails closed on a wrong passphrase or a changed manifest. */
export async function unwrapVaultKey(projectId: string, rawManifest: unknown, passphrase: string): Promise<Uint8Array> {
  const manifest = readVaultManifest(rawManifest);
  const kek = await deriveKeyEncryptionKey(passphrase, fromBase64(manifest.kdf.salt), manifest.kdf.iterations);
  try {
    const dataKey = gcm(kek, fromBase64(manifest.wrappedKey.iv), wrapAad(projectId, manifest)).decrypt(
      fromBase64(manifest.wrappedKey.ct)
    );
    if (dataKey.length !== KEY_BYTES) throw new VaultIntegrityError();
    return dataKey;
  } catch {
    // AES-GCM cannot tell a wrong passphrase from a changed manifest.
    throw new VaultPassphraseError();
  } finally {
    kek.fill(0);
  }
}

/**
 * Throws unless `value` survives a JSON round trip unchanged in type: plain
 * objects, arrays, strings, finite numbers, booleans, null, and undefined
 * object fields. A Date, Blob, Map, or typed array would come back as
 * something else, so a vault refuses it instead of changing the record.
 */
export function assertSealable(value: unknown, path = 'record'): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} holds a number a protected project cannot store.`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item === undefined) throw new Error(`${path}[${index}] is empty, which a protected project cannot store.`);
      assertSealable(item, `${path}[${index}]`);
    });
    return;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) assertSealable(item, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`${path} holds a value a protected project cannot store.`);
}

/** Seals one record body with the project's data key, bound to its store, project, and id. */
export function sealRecord(dataKey: Uint8Array, context: SealContext, value: unknown): SealedPayload {
  assertSealable(value);
  const iv = randomBytes(IV_BYTES);
  const ct = gcm(dataKey, iv, recordAad(context)).encrypt(encoder.encode(JSON.stringify(value)));
  return {v: VAULT_FORMAT_VERSION, iv: toBase64(iv), ct: toBase64(ct)};
}

/** Opens a sealed record body. Throws `VaultIntegrityError` if it was changed or moved. */
export function openRecord<T = unknown>(dataKey: Uint8Array, context: SealContext, sealed: SealedPayload): T {
  if (!isSealedPayload(sealed)) throw new VaultIntegrityError();
  try {
    const plaintext = gcm(dataKey, fromBase64(sealed.iv), recordAad(context)).decrypt(fromBase64(sealed.ct));
    return JSON.parse(decoder.decode(plaintext)) as T;
  } catch {
    throw new VaultIntegrityError();
  }
}

export function isSealedPayload(value: unknown): value is SealedPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<SealedPayload>;
  return payload.v === VAULT_FORMAT_VERSION && typeof payload.iv === 'string' && typeof payload.ct === 'string';
}
