import {beforeEach, describe, expect, it} from 'vitest';
import {
  dismissProgressionContinuityCandidate,
  getDismissedProgressionContinuityKeys,
  restoreAllDismissedProgressionContinuityCandidates
} from './progressionContinuityReviewPrefs';

const projectId = 'project-1';

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

describe('progressionContinuityReviewPrefs', () => {
  it('starts with no dismissed candidates', () => {
    expect(getDismissedProgressionContinuityKeys(projectId)).toEqual(new Set());
  });

  it('persists a dismissed candidate key', () => {
    dismissProgressionContinuityCandidate(projectId, 'unused_solution:char-1:fact-1');
    expect(getDismissedProgressionContinuityKeys(projectId)).toEqual(
      new Set(['unused_solution:char-1:fact-1'])
    );
  });

  it('is idempotent when the same key is dismissed twice', () => {
    dismissProgressionContinuityCandidate(projectId, 'key-1');
    dismissProgressionContinuityCandidate(projectId, 'key-1');
    expect(getDismissedProgressionContinuityKeys(projectId)).toEqual(new Set(['key-1']));
  });

  it('scopes dismissals per project', () => {
    dismissProgressionContinuityCandidate('project-a', 'key-1');
    expect(getDismissedProgressionContinuityKeys('project-b')).toEqual(new Set());
  });

  it('restores all dismissed candidates for a project', () => {
    dismissProgressionContinuityCandidate(projectId, 'key-1');
    dismissProgressionContinuityCandidate(projectId, 'key-2');
    restoreAllDismissedProgressionContinuityCandidates(projectId);
    expect(getDismissedProgressionContinuityKeys(projectId)).toEqual(new Set());
  });
});
