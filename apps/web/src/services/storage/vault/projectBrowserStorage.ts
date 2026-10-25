/**
 * Browser storage for project-derived text (slice 5.15b).
 *
 * A few small features keep project text in `localStorage`/`sessionStorage`:
 * System history, cached lore synopses, dismissed review names, and the
 * assistant conversation (see the browser storage inventory in
 * `docs/architecture-review.md`). For a protected project these live in
 * memory instead, and are dropped when the project locks. Unprotected
 * projects keep using browser storage under the same keys.
 */
import {getVaultState, isVaultProject, subscribeVaultChanges} from './vaultRegistry';

export type BrowserStorageArea = 'local' | 'session';
export type ProjectBrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Content keys for a project, by area. Preferences are not listed and stay where they are. */
const CONTENT_KEYS: Record<BrowserStorageArea, (key: string, projectId: string) => boolean> = {
  local: (key, projectId) =>
    key === `systemHistory:${projectId}` ||
    key === `workspaceReviewPrefs:${projectId}` ||
    key.startsWith(`loreSynopsis:${projectId}:`),
  session: (key, projectId) =>
    key === `wbd:assistant-conversation:${projectId}` ||
    (key.startsWith('wbd:assistant-conversation:') && key.endsWith(`:${projectId}`))
};

const memory = new Map<string, Map<string, string>>();
const slot = (projectId: string, area: BrowserStorageArea) => `${area}|${projectId}`;

subscribeVaultChanges((projectId) => {
  const state = getVaultState(projectId);
  if (state === 'unlocked' || state === 'migrating') return;
  memory.delete(slot(projectId, 'local'));
  memory.delete(slot(projectId, 'session'));
});

function browserArea(area: BrowserStorageArea): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return area === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function memoryArea(projectId: string, area: BrowserStorageArea): Map<string, string> {
  const key = slot(projectId, area);
  let values = memory.get(key);
  if (!values) {
    values = new Map();
    memory.set(key, values);
  }
  return values;
}

/** Where to keep this project's text: memory for a protected project, browser storage otherwise. */
export function projectBrowserStorage(projectId: string, area: BrowserStorageArea): ProjectBrowserStorage | null {
  if (!isVaultProject(projectId)) return browserArea(area);
  // A locked project has nothing to show and nothing should be kept for it.
  const writable = getVaultState(projectId) !== 'locked';
  return {
    getItem: (key) => (writable ? memoryArea(projectId, area).get(key) ?? null : null),
    setItem: (key, value) => {
      if (writable) memoryArea(projectId, area).set(key, String(value));
    },
    removeItem: (key) => {
      memory.get(slot(projectId, area))?.delete(key);
    }
  };
}

function contentKeys(storage: Storage, area: BrowserStorageArea, projectId: string): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && CONTENT_KEYS[area](key, projectId)) keys.push(key);
  }
  return keys;
}

/** After protection is enabled: moves the project's text out of browser storage into memory. */
export function moveProjectBrowserContentToMemory(projectId: string): void {
  for (const area of ['local', 'session'] as const) {
    const storage = browserArea(area);
    if (!storage) continue;
    const values = memoryArea(projectId, area);
    for (const key of contentKeys(storage, area, projectId)) {
      const value = storage.getItem(key);
      if (value !== null) values.set(key, value);
      storage.removeItem(key);
    }
  }
}

/** After protection is removed: puts the project's in-memory text back into browser storage. */
export function moveProjectBrowserContentToStorage(projectId: string): void {
  for (const area of ['local', 'session'] as const) {
    const storage = browserArea(area);
    const values = memory.get(slot(projectId, area));
    memory.delete(slot(projectId, area));
    if (!storage || !values) continue;
    for (const [key, value] of values) {
      try {
        storage.setItem(key, value);
      } catch {
        // Full storage: these are conveniences; the project itself is unaffected.
      }
    }
  }
}

/** Test-only. */
export function resetProjectBrowserStorageForTests(): void {
  memory.clear();
}
