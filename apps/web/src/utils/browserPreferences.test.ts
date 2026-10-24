// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  readBooleanPreference,
  readJsonPreference,
  readPreference,
  removePreference,
  writeBooleanPreference,
  writeJsonPreference
} from './browserPreferences';

const isStringArray = (value: unknown) =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? (value as string[]) : null;

describe('browserPreferences', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('keeps the existing string formats, so stored choices survive the change', () => {
    localStorage.setItem('wbd:lore:document-rail-collapsed:p', 'true');
    localStorage.setItem('recentCommands', JSON.stringify(['go-lore', 'go-bible']));

    expect(readBooleanPreference('wbd:lore:document-rail-collapsed:p')).toBe(true);
    expect(readBooleanPreference('wbd:lore:document-rail-collapsed:other')).toBe(false);
    expect(readJsonPreference('recentCommands', isStringArray)).toEqual(['go-lore', 'go-bible']);

    writeBooleanPreference('wbd:lore:document-rail-collapsed:p', false);
    writeJsonPreference('recentCommands', ['go-sheets']);
    expect(localStorage.getItem('wbd:lore:document-rail-collapsed:p')).toBe('false');
    expect(localStorage.getItem('recentCommands')).toBe('["go-sheets"]');

    removePreference('recentCommands');
    expect(readPreference('recentCommands')).toBeNull();
  });

  it('rejects malformed or invalid JSON instead of throwing', () => {
    localStorage.setItem('recentCommands', '{broken');
    expect(readJsonPreference('recentCommands', isStringArray)).toBeNull();
    localStorage.setItem('recentCommands', '{"not":"an array"}');
    expect(readJsonPreference('recentCommands', isStringArray)).toBeNull();
  });

  it('never throws when storage is blocked or full', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(readBooleanPreference('any')).toBe(false);
    expect(readJsonPreference('any', isStringArray)).toBeNull();
    expect(() => writeBooleanPreference('any', true)).not.toThrow();
    expect(() => writeJsonPreference('any', ['x'])).not.toThrow();
    expect(() => removePreference('any')).not.toThrow();
  });
});
