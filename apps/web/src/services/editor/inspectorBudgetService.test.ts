import {beforeEach, describe, expect, it} from 'vitest';
import {
  canSpendConsultation,
  CONSULTATION_GRANT_STEP,
  DEFAULT_CONSULTATION_LIMIT,
  getConsultationBudgetStatus,
  grantExtraConsultations,
  isPrivateLocalConsultation,
  LOCAL_CONSULTATION_DAILY_GUARD,
  recordConsultation
} from './inspectorBudgetService';

const projectId = 'project-1';
const otherProjectId = 'project-2';

// Same stand-in as progressionContinuityReviewPrefs' suite: this file runs under vitest's plain
// `node` project, which has no browser localStorage.
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

const storage = () => (globalThis as {localStorage: Storage}).localStorage;

beforeEach(() => {
  (globalThis as {localStorage: Storage}).localStorage = new MemoryStorage();
});


const PRIVATE_LOCAL = {isPrivateLocal: true};

describe('inspectorBudgetService — scope', () => {
  it('starts empty', () => {
    const status = getConsultationBudgetStatus(projectId, 20);
    expect(status.used).toBe(0);
    expect(status.limit).toBe(20);
    expect(status.remaining).toBe(20);
    expect(status.exhausted).toBe(false);
    expect(status.byFeature).toEqual([]);
  });

  it('keeps one budget per project rather than per feature', () => {
    recordConsultation(projectId, 'assistant', 'anthropic', 20);
    recordConsultation(projectId, 'writing-coach', 'anthropic', 20);
    recordConsultation(projectId, 'canon-decision', 'anthropic', 20);

    const status = getConsultationBudgetStatus(projectId, 20);
    expect(status.used).toBe(3);
    expect(status.remaining).toBe(17);
  });

  it('records which feature spent each unit, busiest first', () => {
    recordConsultation(projectId, 'writing-coach', 'anthropic', 20);
    recordConsultation(projectId, 'writing-coach', 'anthropic', 20);
    recordConsultation(projectId, 'assistant', 'anthropic', 20);

    const status = getConsultationBudgetStatus(projectId, 20);
    expect(status.byFeature).toEqual([
      {feature: 'writing-coach', label: 'Writing coach', count: 2},
      {feature: 'assistant', label: 'Writing assistant', count: 1}
    ]);
  });

  it('does not leak spend between projects', () => {
    recordConsultation(projectId, 'assistant', 'anthropic', 20);
    expect(getConsultationBudgetStatus(otherProjectId, 20).used).toBe(0);
  });

  it('blocks once the limit is reached and reports it', () => {
    for (let i = 0; i < 3; i += 1) recordConsultation(projectId, 'assistant', 'openai', 3);

    const status = getConsultationBudgetStatus(projectId, 3);
    expect(status.exhausted).toBe(true);
    expect(status.remaining).toBe(0);
    expect(canSpendConsultation(projectId, 3, 'openai')).toBe(false);
  });

  it('falls back to the default limit when none is configured', () => {
    expect(getConsultationBudgetStatus(projectId).limit).toBe(DEFAULT_CONSULTATION_LIMIT);
  });
});

describe('inspectorBudgetService — Ollama exemption', () => {
  it('identifies local providers', () => {
    expect(isPrivateLocalConsultation(PRIVATE_LOCAL)).toBe(true);
    // A provider name is never enough: unverified or cloud Ollama stays budgeted.
    expect(isPrivateLocalConsultation('ollama')).toBe(false);
    expect(isPrivateLocalConsultation({isPrivateLocal: false})).toBe(false);
    expect(isPrivateLocalConsultation('anthropic')).toBe(false);
    expect(isPrivateLocalConsultation(undefined)).toBe(false);
  });

  it('does not spend the budget for local requests', () => {
    recordConsultation(projectId, 'assistant', PRIVATE_LOCAL, 20);
    recordConsultation(projectId, 'writing-coach', PRIVATE_LOCAL, 20);

    const status = getConsultationBudgetStatus(projectId, 20);
    expect(status.used).toBe(0);
    expect(status.byFeature).toEqual([]);
    expect(status.localUsed).toBe(2);
  });

  it('lets local requests through even when the budget is spent', () => {
    for (let i = 0; i < 20; i += 1) recordConsultation(projectId, 'assistant', 'anthropic', 20);

    expect(canSpendConsultation(projectId, 20, 'anthropic')).toBe(false);
    expect(canSpendConsultation(projectId, 20, PRIVATE_LOCAL)).toBe(true);
  });

  it('still stops a runaway local loop at the separate guard', () => {
    for (let i = 0; i < LOCAL_CONSULTATION_DAILY_GUARD; i += 1) {
      recordConsultation(projectId, 'assistant', PRIVATE_LOCAL, 20);
    }

    const status = getConsultationBudgetStatus(projectId, 20);
    expect(status.localGuardExhausted).toBe(true);
    expect(status.exhausted).toBe(false);
    expect(canSpendConsultation(projectId, 20, PRIVATE_LOCAL)).toBe(false);
  });
});

describe('inspectorBudgetService — reset boundaries', () => {
  it('reports the next local midnight, not a UTC one', () => {
    const now = new Date(2026, 8, 19, 14, 30, 0);
    const status = getConsultationBudgetStatus(projectId, 20, now);

    expect(status.day).toBe('2026-09-19');
    expect(status.resetsAt.getFullYear()).toBe(2026);
    expect(status.resetsAt.getMonth()).toBe(8);
    expect(status.resetsAt.getDate()).toBe(20);
    expect(status.resetsAt.getHours()).toBe(0);
    expect(status.resetsAt.getMinutes()).toBe(0);
  });

  it('carries spend across the same local day', () => {
    const morning = new Date(2026, 8, 19, 9, 0, 0);
    const evening = new Date(2026, 8, 19, 23, 59, 0);

    recordConsultation(projectId, 'assistant', 'anthropic', 20, morning);
    expect(getConsultationBudgetStatus(projectId, 20, evening).used).toBe(1);
  });

  it('resets everything at the local day boundary', () => {
    const lateTonight = new Date(2026, 8, 19, 23, 59, 0);
    const afterMidnight = new Date(2026, 8, 20, 0, 1, 0);

    recordConsultation(projectId, 'assistant', 'anthropic', 20, lateTonight);
    recordConsultation(projectId, 'assistant', PRIVATE_LOCAL, 20, lateTonight);
    grantExtraConsultations(projectId, 10, 20, lateTonight);

    const status = getConsultationBudgetStatus(projectId, 20, afterMidnight);
    expect(status.used).toBe(0);
    expect(status.localUsed).toBe(0);
    expect(status.granted).toBe(0);
    expect(status.limit).toBe(20);
    expect(status.byFeature).toEqual([]);
  });
});

describe('inspectorBudgetService — point-of-use grant', () => {
  it('raises today’s limit without touching the configured one', () => {
    for (let i = 0; i < 5; i += 1) recordConsultation(projectId, 'assistant', 'anthropic', 5);
    expect(getConsultationBudgetStatus(projectId, 5).exhausted).toBe(true);

    const status = grantExtraConsultations(projectId, CONSULTATION_GRANT_STEP, 5);
    expect(status.configuredLimit).toBe(5);
    expect(status.granted).toBe(CONSULTATION_GRANT_STEP);
    expect(status.limit).toBe(5 + CONSULTATION_GRANT_STEP);
    expect(status.exhausted).toBe(false);
    expect(canSpendConsultation(projectId, 5, 'anthropic')).toBe(true);
  });

  it('accumulates repeated grants within the day', () => {
    grantExtraConsultations(projectId, 10, 20);
    const status = grantExtraConsultations(projectId, 10, 20);
    expect(status.granted).toBe(20);
  });
});

describe('inspectorBudgetService — legacy key migration', () => {
  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
  };

  it("carries today's legacy count forward so the upgrade does not forgive spend", () => {
    storage().setItem(`inspectorBudget:${projectId}:${today()}`, '7');

    const status = getConsultationBudgetStatus(projectId, 20);
    expect(status.used).toBe(7);
    expect(status.remaining).toBe(13);
  });

  it('sweeps the old per-day keys instead of leaving them to accumulate', () => {
    storage().setItem(`inspectorBudget:${projectId}:${today()}`, '2');
    storage().setItem(`inspectorBudget:${projectId}:2026-01-01`, '9');
    storage().setItem(`inspectorBudget:${projectId}:2026-01-02`, '4');

    recordConsultation(projectId, 'assistant', 'anthropic', 20);

    expect(storage().getItem(`inspectorBudget:${projectId}:2026-01-01`)).toBeNull();
    expect(storage().getItem(`inspectorBudget:${projectId}:2026-01-02`)).toBeNull();
    expect(storage().getItem(`inspectorBudget:${projectId}:${today()}`)).toBeNull();
    expect(getConsultationBudgetStatus(projectId, 20).used).toBe(3);
  });

  it('leaves another project’s legacy keys alone', () => {
    storage().setItem(`inspectorBudget:${otherProjectId}:${today()}`, '5');
    getConsultationBudgetStatus(projectId, 20);
    expect(storage().getItem(`inspectorBudget:${otherProjectId}:${today()}`)).toBe('5');
  });

  it('ignores an unreadable ledger rather than throwing', () => {
    storage().setItem(`inspectorBudget:${projectId}`, 'not json');
    expect(getConsultationBudgetStatus(projectId, 20).used).toBe(0);
  });
});
