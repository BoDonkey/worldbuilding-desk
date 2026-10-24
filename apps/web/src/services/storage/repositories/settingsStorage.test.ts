import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  createDefaultAISettings,
  getDefaultAIProvider,
  rememberDefaultAIProvider
} from './settingsStorage';

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  }
};

describe('settingsStorage AI defaults', () => {
  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorageMock
    });
  });

  afterEach(() => {
    storage.clear();
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('defaults new AI settings to local Ollama when no provider was remembered', () => {
    expect(getDefaultAIProvider()).toBe('ollama');
    expect(createDefaultAISettings().provider).toBe('ollama');
  });

  it('uses the last selected provider for new AI settings', () => {
    rememberDefaultAIProvider('openai');

    expect(getDefaultAIProvider()).toBe('openai');
    expect(createDefaultAISettings().provider).toBe('openai');
  });
});
