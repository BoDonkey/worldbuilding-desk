import {beforeEach, describe, expect, it} from 'vitest';
import {
  dismissOnboardingGuide,
  getOnboardingGuideVariant,
  isOnboardingGuideDismissed,
  markProjectForOnboardingGuide,
  resetOnboardingGuide
} from './onboardingGuide';

// This suite runs under vitest's plain-node project (see vitest.config.ts), which has no
// browser localStorage. A minimal in-memory stand-in is enough to exercise the module.
class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  (globalThis as {localStorage: Storage}).localStorage = new MemoryStorage();
});

describe('onboardingGuide', () => {
  it('has no marked variant for an unmarked project', () => {
    expect(getOnboardingGuideVariant('project-1')).toBeNull();
  });

  it('marks and reads back a project variant', () => {
    markProjectForOnboardingGuide('project-1', 'sample');
    expect(getOnboardingGuideVariant('project-1')).toBe('sample');
  });

  it('marks projects independently', () => {
    markProjectForOnboardingGuide('project-1', 'blank');
    markProjectForOnboardingGuide('project-2', 'sample');
    expect(getOnboardingGuideVariant('project-1')).toBe('blank');
    expect(getOnboardingGuideVariant('project-2')).toBe('sample');
  });

  it('is not dismissed by default', () => {
    expect(isOnboardingGuideDismissed('project-1')).toBe(false);
  });

  it('persists a dismissal and allows resetting it', () => {
    dismissOnboardingGuide('project-1');
    expect(isOnboardingGuideDismissed('project-1')).toBe(true);
    resetOnboardingGuide('project-1');
    expect(isOnboardingGuideDismissed('project-1')).toBe(false);
  });
});
