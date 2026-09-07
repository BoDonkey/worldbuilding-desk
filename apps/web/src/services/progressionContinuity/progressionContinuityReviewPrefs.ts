/**
 * Dismissal is UI workflow state, not canon — like the Workspace consistency
 * review's hidden-item preferences, it lives in localStorage rather than the
 * project's IndexedDB stores, so it carries none of the backup/migration
 * weight a canon-adjacent store would. Findings are recomputed fresh from
 * live project data on every load; this is the only thing that needs to
 * persist, so a false positive costs the author exactly one click, once.
 */

const keyFor = (projectId: string) => `progressionContinuityReview:${projectId}`;

interface StoredPrefs {
  dismissedKeys: string[];
}

function readPrefs(projectId: string): StoredPrefs {
  try {
    const raw = localStorage.getItem(keyFor(projectId));
    if (!raw) return {dismissedKeys: []};
    const parsed = JSON.parse(raw) as Partial<StoredPrefs> | null;
    const dismissedKeys = Array.isArray(parsed?.dismissedKeys)
      ? parsed!.dismissedKeys.filter((value): value is string => typeof value === 'string')
      : [];
    return {dismissedKeys};
  } catch {
    return {dismissedKeys: []};
  }
}

function writePrefs(projectId: string, prefs: StoredPrefs): void {
  try {
    localStorage.setItem(keyFor(projectId), JSON.stringify(prefs));
  } catch {
    // Dismissal is a convenience, not a reason to block review.
  }
}

export function getDismissedProgressionContinuityKeys(projectId: string): Set<string> {
  return new Set(readPrefs(projectId).dismissedKeys);
}

export function dismissProgressionContinuityCandidate(projectId: string, key: string): void {
  const prefs = readPrefs(projectId);
  if (prefs.dismissedKeys.includes(key)) return;
  writePrefs(projectId, {dismissedKeys: [...prefs.dismissedKeys, key]});
}

export function restoreAllDismissedProgressionContinuityCandidates(projectId: string): void {
  writePrefs(projectId, {dismissedKeys: []});
}
