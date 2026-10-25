/**
 * Optional passphrase protection for project backups (slice 5.14).
 *
 * An encrypted backup is a small JSON envelope around the ordinary backup zip:
 * PBKDF2-SHA256 turns the passphrase into an AES-256-GCM key, and the header
 * (format, version, key-derivation and cipher settings) is authenticated with
 * the ciphertext, so changing any of it makes decryption fail. The passphrase
 * is never stored, and there is no way to open the file without it.
 */

import {fromBase64, toBase64} from './base64';

export const ENCRYPTED_BACKUP_FORMAT = 'sagaspine-encrypted-backup';
export const ENCRYPTED_BACKUP_VERSION = 1;
export const ENCRYPTED_BACKUP_EXTENSION = '.sagabackup';
export const MIN_BACKUP_PASSPHRASE_LENGTH = 8;

const DEFAULT_ITERATIONS = 600_000;
// Bounds on what an imported file may ask for: low enough to refuse a weak
// file, high enough to refuse one built to hang the app.
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 10_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

interface EnvelopeHeader {
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  version: number;
  payload: 'project-backup-zip';
  kdf: {name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string};
  cipher: {name: 'AES-GCM'; iv: string};
}

interface Envelope extends EnvelopeHeader {
  ciphertext: string;
}

/** The passphrase did not open this backup (or the file was changed). */
export class BackupPassphraseError extends Error {
  constructor() {
    super('That passphrase does not open this backup. Check it and try again; nothing was imported.');
    this.name = 'BackupPassphraseError';
  }
}

/** The file is an encrypted backup this version of the app cannot read. */
export class UnsupportedEncryptedBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedEncryptedBackupError';
  }
}

/** The authenticated header bytes, in a fixed field order. */
function headerBytes(header: EnvelopeHeader): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    JSON.stringify({
      format: header.format,
      version: header.version,
      payload: header.payload,
      kdf: {name: header.kdf.name, hash: header.kdf.hash, iterations: header.kdf.iterations, salt: header.kdf.salt},
      cipher: {name: header.cipher.name, iv: header.cipher.iv}
    })
  );
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  // NFC so the same passphrase typed on another system gives the same key.
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {name: 'PBKDF2', hash: 'SHA-256', salt, iterations},
    material,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt', 'decrypt']
  );
}

/** Problems with a passphrase the author is choosing, or null when it can be used. */
export function checkNewBackupPassphrase(passphrase: string, confirmation: string): string | null {
  if (passphrase.length < MIN_BACKUP_PASSPHRASE_LENGTH) {
    return `Use at least ${MIN_BACKUP_PASSPHRASE_LENGTH} characters.`;
  }
  if (passphrase !== confirmation) return 'The two passphrases do not match.';
  return null;
}

export async function encryptBackup(
  zipBytes: Uint8Array,
  passphrase: string,
  options: {iterations?: number} = {}
): Promise<Uint8Array> {
  if (passphrase.length < MIN_BACKUP_PASSPHRASE_LENGTH) {
    throw new Error(`A backup passphrase needs at least ${MIN_BACKUP_PASSPHRASE_LENGTH} characters.`);
  }
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const header: EnvelopeHeader = {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: ENCRYPTED_BACKUP_VERSION,
    payload: 'project-backup-zip',
    kdf: {name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt)},
    cipher: {name: 'AES-GCM', iv: toBase64(iv)}
  };
  const key = await deriveKey(passphrase, salt, iterations);
  const plaintext = new Uint8Array(zipBytes.byteLength);
  plaintext.set(zipBytes);
  const ciphertext = await crypto.subtle.encrypt(
    {name: 'AES-GCM', iv, additionalData: headerBytes(header), tagLength: 128},
    key,
    plaintext
  );
  const envelope: Envelope = {...header, ciphertext: toBase64(new Uint8Array(ciphertext))};
  return new TextEncoder().encode(`${JSON.stringify(envelope, null, 2)}\n`);
}

/** Reads the envelope when these bytes are one, or returns null for anything else (a plain zip). */
function readEnvelope(bytes: Uint8Array): Record<string, unknown> | null {
  // A zip starts with "PK"; an envelope is JSON. Only look further at JSON.
  let start = 0;
  while (start < bytes.length && /\s/.test(String.fromCharCode(bytes[start]))) start += 1;
  if (bytes[start] !== 0x7b /* { */) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    if (parsed && typeof parsed === 'object' && (parsed as {format?: unknown}).format === ENCRYPTED_BACKUP_FORMAT) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Not JSON after all; the zip reader will report it.
  }
  return null;
}

export function isEncryptedBackup(bytes: Uint8Array): boolean {
  return readEnvelope(bytes) !== null;
}

function validEnvelope(raw: Record<string, unknown>): Envelope {
  const newer = new UnsupportedEncryptedBackupError(
    'This encrypted backup was made by a newer version of SagaSpine. Update the app, then import it again.'
  );
  const damaged = new UnsupportedEncryptedBackupError(
    'This encrypted backup is damaged or incomplete and cannot be opened.'
  );
  if (typeof raw.version !== 'number') throw damaged;
  if (raw.version > ENCRYPTED_BACKUP_VERSION) throw newer;
  if (raw.version !== ENCRYPTED_BACKUP_VERSION || raw.payload !== 'project-backup-zip') throw damaged;
  const kdf = raw.kdf as Envelope['kdf'] | undefined;
  const cipher = raw.cipher as Envelope['cipher'] | undefined;
  if (
    kdf?.name !== 'PBKDF2' ||
    kdf.hash !== 'SHA-256' ||
    !Number.isSafeInteger(kdf.iterations) ||
    kdf.iterations < MIN_ITERATIONS ||
    kdf.iterations > MAX_ITERATIONS ||
    typeof kdf.salt !== 'string' ||
    cipher?.name !== 'AES-GCM' ||
    typeof cipher.iv !== 'string' ||
    typeof raw.ciphertext !== 'string'
  ) {
    throw damaged;
  }
  try {
    if (fromBase64(kdf.salt).length !== SALT_BYTES || fromBase64(cipher.iv).length !== IV_BYTES) throw damaged;
    fromBase64(raw.ciphertext);
  } catch {
    throw damaged;
  }
  return raw as unknown as Envelope;
}

/** Returns the backup zip inside an encrypted backup. Fails closed on a wrong passphrase. */
export async function decryptBackup(bytes: Uint8Array, passphrase: string): Promise<Uint8Array> {
  const raw = readEnvelope(bytes);
  if (!raw) throw new UnsupportedEncryptedBackupError('This file is not an encrypted SagaSpine backup.');
  const envelope = validEnvelope(raw);
  const key = await deriveKey(passphrase, fromBase64(envelope.kdf.salt), envelope.kdf.iterations);
  try {
    const plaintext = await crypto.subtle.decrypt(
      {name: 'AES-GCM', iv: fromBase64(envelope.cipher.iv), additionalData: headerBytes(envelope), tagLength: 128},
      key,
      fromBase64(envelope.ciphertext)
    );
    return new Uint8Array(plaintext);
  } catch {
    // AES-GCM cannot tell a wrong passphrase from a changed file; both stop here.
    throw new BackupPassphraseError();
  }
}
