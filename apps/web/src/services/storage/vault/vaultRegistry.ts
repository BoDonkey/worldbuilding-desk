/**
 * Which projects are protected, and which of those are unlocked (slice 5.15a).
 *
 * The database wrapper consults this synchronously on every read and write, so
 * it must be loaded before any wrapped database is handed out (see `db.ts`).
 * Data keys live only here, in memory: a reload or restart locks every project.
 */
import type {VaultManifest} from './vaultCrypto';

export type VaultState = 'locked' | 'unlocked' | 'migrating';

interface VaultEntry {
  manifest: VaultManifest;
  dataKey: Uint8Array | null;
  /** Set while enable/disable rewrites the project; ordinary writes are refused. */
  migrating: boolean;
}

/** Writing to a protected project that is locked. */
export class VaultLockedError extends Error {
  constructor(message = 'This project is locked. Unlock it with its passphrase to make changes.') {
    super(message);
    this.name = 'VaultLockedError';
  }
}

const entries = new Map<string, VaultEntry>();
const listeners = new Set<(projectId: string) => void>();
let loaded = false;

const CHANNEL_NAME = 'wbd-project-vaults';
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<{projectId?: unknown}>) => {
    // Another tab changed a vault. Lock it here and re-read manifests before
    // the next database access, rather than trust what this tab remembers.
    const projectId = event.data?.projectId;
    if (typeof projectId === 'string') {
      clearKey(projectId);
      notify(projectId);
    }
    loaded = false;
  };
  return channel;
}

function clearKey(projectId: string): void {
  const entry = entries.get(projectId);
  if (entry?.dataKey) {
    entry.dataKey.fill(0);
    entry.dataKey = null;
  }
}

function notify(projectId: string): void {
  listeners.forEach((listener) => listener(projectId));
}

function changed(projectId: string, options: {broadcast?: boolean} = {}): void {
  notify(projectId);
  if (options.broadcast) getChannel()?.postMessage({projectId});
}

export function isVaultRegistryLoaded(): boolean {
  getChannel();
  return loaded;
}

/**
 * Replaces the registry from stored manifests. Keys of projects that are still
 * protected with the same wrapped key stay unlocked; anything else is locked.
 */
export function loadVaultRegistry(manifests: ReadonlyMap<string, VaultManifest>): void {
  for (const [projectId, entry] of entries) {
    // A migration in progress owns its entry until it ends.
    if (entry.migrating) continue;
    const next = manifests.get(projectId);
    if (!next || next.wrappedKey.ct !== entry.manifest.wrappedKey.ct) {
      clearKey(projectId);
      entries.delete(projectId);
    }
  }
  for (const [projectId, manifest] of manifests) {
    const entry = entries.get(projectId);
    if (entry?.migrating) continue;
    if (entry) entry.manifest = manifest;
    else entries.set(projectId, {manifest, dataKey: null, migrating: false});
  }
  loaded = true;
}

export function isVaultProject(projectId: string): boolean {
  return entries.has(projectId);
}

export function getVaultState(projectId: string): VaultState | null {
  const entry = entries.get(projectId);
  if (!entry) return null;
  if (entry.migrating) return 'migrating';
  return entry.dataKey ? 'unlocked' : 'locked';
}

export function getVaultManifest(projectId: string): VaultManifest | null {
  return entries.get(projectId)?.manifest ?? null;
}

/** The key to open this project's records with, or null when it is locked or not protected. */
export function getReadKey(projectId: string): Uint8Array | null {
  return entries.get(projectId)?.dataKey ?? null;
}

/** The key to seal a write with. Throws when the project is protected and locked or mid-migration. */
export function getWriteKey(projectId: string): Uint8Array {
  const entry = entries.get(projectId);
  if (!entry) throw new Error('This project is not protected.');
  if (entry.migrating) {
    throw new VaultLockedError('This project is being protected or unprotected. Try again in a moment.');
  }
  if (!entry.dataKey) throw new VaultLockedError();
  return entry.dataKey;
}

/** Records a vault that enable is about to write; ordinary writes wait out the migration. */
export function beginVaultMigration(projectId: string, manifest: VaultManifest, dataKey: Uint8Array | null): void {
  const entry = entries.get(projectId);
  if (entry) {
    entry.migrating = true;
    entry.manifest = manifest;
    if (dataKey) entry.dataKey = dataKey;
  } else {
    entries.set(projectId, {manifest, dataKey, migrating: true});
  }
  changed(projectId);
}

/** Ends a migration: `protected` keeps the project protected and unlocked; otherwise it is forgotten. */
export function endVaultMigration(projectId: string, outcome: 'protected' | 'unprotected'): void {
  const entry = entries.get(projectId);
  if (!entry) return;
  if (outcome === 'protected') {
    entry.migrating = false;
  } else {
    clearKey(projectId);
    entries.delete(projectId);
  }
  changed(projectId, {broadcast: true});
}

export function unlockVault(projectId: string, dataKey: Uint8Array): void {
  const entry = entries.get(projectId);
  if (!entry) throw new Error('This project is not protected.');
  if (entry.dataKey !== dataKey) clearKey(projectId);
  entry.dataKey = dataKey;
  changed(projectId);
}

export function updateVaultManifest(projectId: string, manifest: VaultManifest): void {
  const entry = entries.get(projectId);
  if (!entry) throw new Error('This project is not protected.');
  entry.manifest = manifest;
  changed(projectId, {broadcast: true});
}

export function lockVault(projectId: string): void {
  if (!entries.get(projectId)?.dataKey) return;
  clearKey(projectId);
  changed(projectId, {broadcast: true});
}

export function lockAllVaults(): void {
  for (const [projectId, entry] of entries) {
    if (entry.dataKey) lockVault(projectId);
  }
}

/** Drops a deleted project from the registry. */
export function forgetVault(projectId: string): void {
  if (!entries.has(projectId)) return;
  clearKey(projectId);
  entries.delete(projectId);
  changed(projectId, {broadcast: true});
}

export function subscribeVaultChanges(listener: (projectId: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test-only: forget every vault and require a reload. */
export function resetVaultRegistryForTests(): void {
  for (const projectId of entries.keys()) clearKey(projectId);
  entries.clear();
  loaded = false;
}
