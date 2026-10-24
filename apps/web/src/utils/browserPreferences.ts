/**
 * Device-local UI preferences kept in `localStorage` (slice 3.23c): collapsed
 * panels, recent commands, and similar choices about how the app looks on this
 * computer. Author-typed content never goes here; it goes through
 * `services/storage`. None of these calls throw: when `localStorage` is
 * blocked or full, the preference is simply not remembered.
 */

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readPreference(key: string): string | null {
  try {
    return browserStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    browserStorage()?.setItem(key, value);
  } catch {
    // Not remembered; the current session still uses the new value.
  }
}

export function removePreference(key: string): void {
  try {
    browserStorage()?.removeItem(key);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

/** Stored as `'true'`/`'false'`, the format the existing keys already use. */
export function readBooleanPreference(key: string): boolean {
  return readPreference(key) === 'true';
}

export function writeBooleanPreference(key: string, value: boolean): void {
  writePreference(key, String(value));
}

/** `parse` validates the decoded value; it returns null to reject it. */
export function readJsonPreference<T>(key: string, parse: (value: unknown) => T | null): T | null {
  const raw = readPreference(key);
  if (raw === null) return null;
  try {
    return parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeJsonPreference(key: string, value: unknown): void {
  writePreference(key, JSON.stringify(value));
}
