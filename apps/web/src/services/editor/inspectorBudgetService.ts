import type {AIProviderId} from '../../entityTypes';

/**
 * Per-project daily AI consultation budget.
 *
 * What it protects: runaway loops and surprise provider spend — not deliberate work. An author
 * who wants more today can grant themselves extra at the point of use; the persistent limit
 * stays in Settings.
 *
 * Scope: one budget per project (an author thinks in "requests this project made today"), but
 * every unit records which feature spent it so the usage can be broken down.
 *
 * Local providers are exempt: an Ollama request costs nothing and sends nothing, so counting it
 * would contradict the privacy pillar. A separate, higher daily guard still stops a runaway.
 *
 * Storage: one `localStorage` key per project, `inspectorBudget:<projectId>`. This replaces the
 * pre-4.39 `inspectorBudget:<projectId>:<YYYY-MM-DD>` keys, which held a bare number and were
 * never cleaned up (one key per project per day, forever). `readLedger` migrates a legacy key for
 * the current day into the new ledger on first read and sweeps the stale ones. The
 * `inspectorBudget` prefix is unchanged, so project deletion still clears it (`projectStorage.ts`).
 *
 * The day boundary is the author's local midnight (it was UTC before 4.39), so the reset time we
 * show is the reset that actually happens.
 *
 * No telemetry, no server-side accounting: clearing site data resets the budget, and that is fine.
 */

export type ConsultationFeature =
  | 'assistant'
  | 'writing-coach'
  | 'progression-continuity'
  | 'workspace-context'
  | 'canon-decision'
  | 'canvas-brainstorm'
  | 'canvas-coach'
  | 'canon-check';

const FEATURE_LABELS: Record<ConsultationFeature, string> = {
  assistant: 'Writing assistant',
  'writing-coach': 'Writing coach',
  'progression-continuity': 'Progression continuity',
  'workspace-context': 'Workspace context actions',
  'canon-decision': 'Canon decisions',
  'canvas-brainstorm': 'World Canvas brainstorming',
  'canvas-coach': 'World Canvas coaching',
  'canon-check': 'Model-assisted canon check'
};

export const CONSULTATION_FEATURES = Object.keys(FEATURE_LABELS) as ConsultationFeature[];

export const consultationFeatureLabel = (feature: ConsultationFeature): string =>
  FEATURE_LABELS[feature] ?? feature;

/** Fallback when a project has no explicit `maxConsultationsPerDay`. */
export const DEFAULT_CONSULTATION_LIMIT = 20;

/** Units added by one point-of-use "give me more today" grant. Today only; never persisted to Settings. */
export const CONSULTATION_GRANT_STEP = 10;

/**
 * Local requests do not spend the budget, but a runaway loop against a local model should still
 * stop. This guard is deliberately far above any plausible session of deliberate work.
 */
export const LOCAL_CONSULTATION_DAILY_GUARD = 200;

const LEDGER_VERSION = 2;

interface ConsultationLedger {
  v: number;
  day: string;
  total: number;
  byFeature: Partial<Record<ConsultationFeature, number>>;
  local: number;
  granted: number;
}

export interface ConsultationFeatureUsage {
  feature: ConsultationFeature;
  label: string;
  count: number;
}

export interface ConsultationBudgetStatus {
  /** Budgeted (non-local) consultations spent today. */
  used: number;
  /** Configured limit plus any extra the author granted themselves today. */
  limit: number;
  /** The persistent Settings limit, without today's grants. */
  configuredLimit: number;
  /** Extra units granted at the point of use today. */
  granted: number;
  remaining: number;
  exhausted: boolean;
  /** Features that spent something today, busiest first. */
  byFeature: ConsultationFeatureUsage[];
  /** Local requests made today — reported, never budgeted. */
  localUsed: number;
  localGuard: number;
  localGuardExhausted: boolean;
  /** Local midnight in the author's own timezone. */
  resetsAt: Date;
  /** e.g. "midnight tonight (12:00 AM EDT)". */
  resetsAtLabel: string;
  day: string;
}

const LOCAL_PROVIDERS: ReadonlySet<string> = new Set(['ollama']);

export const isLocalConsultationProvider = (provider?: AIProviderId | string | null): boolean =>
  typeof provider === 'string' && LOCAL_PROVIDERS.has(provider);

/** Local calendar day, not UTC — the reset the author sees is the reset that happens. */
const localDayKey = (now: Date = new Date()): string => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const keyFor = (projectId: string) => `inspectorBudget:${projectId}`;
const legacyKeyPrefix = (projectId: string) => `inspectorBudget:${projectId}:`;

const emptyLedger = (day: string): ConsultationLedger => ({
  v: LEDGER_VERSION,
  day,
  total: 0,
  byFeature: {},
  local: 0,
  granted: 0
});

const positiveInt = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

/**
 * Reads the pre-4.39 `inspectorBudget:<projectId>:<day>` keys. The one matching today seeds the
 * new ledger's total (the author's spend so far is not forgiven by the upgrade); every legacy key
 * for this project is then removed, since nothing wrote them per-day cleanup.
 *
 * The legacy counter had no per-feature detail, so the migrated units land under no feature and
 * simply do not appear in the breakdown. That is a one-day gap, not a persistent one.
 */
const migrateLegacyKeys = (projectId: string, day: string): number => {
  const prefix = legacyKeyPrefix(projectId);
  let migrated = 0;
  const stale: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(prefix)) continue;
    if (key.slice(prefix.length) === day) migrated = positiveInt(localStorage.getItem(key));
    stale.push(key);
  }

  stale.forEach((key) => localStorage.removeItem(key));
  return migrated;
};

const readLedger = (projectId: string, now: Date = new Date()): ConsultationLedger => {
  const day = localDayKey(now);
  let ledger: ConsultationLedger | null = null;

  const raw = localStorage.getItem(keyFor(projectId));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<ConsultationLedger>;
      if (parsed && typeof parsed === 'object' && typeof parsed.day === 'string') {
        ledger = {
          v: LEDGER_VERSION,
          day: parsed.day,
          total: positiveInt(parsed.total),
          byFeature: (parsed.byFeature ?? {}) as Partial<Record<ConsultationFeature, number>>,
          local: positiveInt(parsed.local),
          granted: positiveInt(parsed.granted)
        };
      }
    } catch {
      ledger = null;
    }
  }

  // A ledger from an earlier day is spent — the budget resets at local midnight.
  if (!ledger || ledger.day !== day) {
    const fresh = emptyLedger(day);
    fresh.total = migrateLegacyKeys(projectId, day);
    return fresh;
  }

  return ledger;
};

const writeLedger = (projectId: string, ledger: ConsultationLedger): void => {
  try {
    localStorage.setItem(keyFor(projectId), JSON.stringify(ledger));
  } catch {
    // A full or unavailable localStorage must not block the author's work; the budget is a
    // local convenience, not a correctness guarantee.
  }
};

const nextLocalMidnight = (now: Date = new Date()): Date => {
  const reset = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return reset;
};

const formatResetLabel = (resetsAt: Date): string => {
  try {
    const time = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }).format(resetsAt);
    return `midnight tonight (${time})`;
  } catch {
    return 'midnight tonight';
  }
};

const summarize = (ledger: ConsultationLedger, configuredLimit: number, now: Date): ConsultationBudgetStatus => {
  const safeConfigured = positiveInt(configuredLimit) || DEFAULT_CONSULTATION_LIMIT;
  const limit = safeConfigured + ledger.granted;
  const used = ledger.total;
  const resetsAt = nextLocalMidnight(now);

  const byFeature = CONSULTATION_FEATURES.map((feature) => ({
    feature,
    label: consultationFeatureLabel(feature),
    count: positiveInt(ledger.byFeature[feature])
  }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    used,
    limit,
    configuredLimit: safeConfigured,
    granted: ledger.granted,
    remaining: Math.max(0, limit - used),
    exhausted: used >= limit,
    byFeature,
    localUsed: ledger.local,
    localGuard: LOCAL_CONSULTATION_DAILY_GUARD,
    localGuardExhausted: ledger.local >= LOCAL_CONSULTATION_DAILY_GUARD,
    resetsAt,
    resetsAtLabel: formatResetLabel(resetsAt),
    day: ledger.day
  };
};

export const getConsultationBudgetStatus = (
  projectId: string,
  configuredLimit: number = DEFAULT_CONSULTATION_LIMIT,
  now: Date = new Date()
): ConsultationBudgetStatus => summarize(readLedger(projectId, now), configuredLimit, now);

/**
 * Whether a request may proceed. Local requests are checked against the loop guard instead of the
 * budget; everything else against the budget.
 */
export const canSpendConsultation = (
  projectId: string,
  configuredLimit: number,
  provider?: AIProviderId | string | null,
  now: Date = new Date()
): boolean => {
  const status = getConsultationBudgetStatus(projectId, configuredLimit, now);
  return isLocalConsultationProvider(provider) ? !status.localGuardExhausted : !status.exhausted;
};

/**
 * Records one consultation and returns the status the caller should display. A local request
 * increments only the loop guard, never the budget.
 */
export const recordConsultation = (
  projectId: string,
  feature: ConsultationFeature,
  provider?: AIProviderId | string | null,
  configuredLimit: number = DEFAULT_CONSULTATION_LIMIT,
  now: Date = new Date()
): ConsultationBudgetStatus => {
  const ledger = readLedger(projectId, now);

  if (isLocalConsultationProvider(provider)) {
    ledger.local += 1;
  } else {
    ledger.total += 1;
    ledger.byFeature[feature] = positiveInt(ledger.byFeature[feature]) + 1;
  }

  writeLedger(projectId, ledger);
  return summarize(ledger, configuredLimit, now);
};

/**
 * Point-of-use escape hatch for decision (a): the budget guards against runaway loops, not against
 * deliberate work, so an author who means to keep going gets more today with one click. Today only
 * — it resets with everything else at local midnight, and the persistent limit stays in Settings.
 */
export const grantExtraConsultations = (
  projectId: string,
  step: number = CONSULTATION_GRANT_STEP,
  configuredLimit: number = DEFAULT_CONSULTATION_LIMIT,
  now: Date = new Date()
): ConsultationBudgetStatus => {
  const ledger = readLedger(projectId, now);
  ledger.granted += positiveInt(step) || CONSULTATION_GRANT_STEP;
  writeLedger(projectId, ledger);
  return summarize(ledger, configuredLimit, now);
};
