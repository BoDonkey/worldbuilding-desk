/**
 * Which projects should show the getting-started guide, and whether the
 * author has dismissed it. Deliberately not tied to "is this a new
 * project" heuristics — only projects created through the first-run or
 * sample-project paths are marked, so existing authors never see a
 * guidance panel appear unprompted on projects they already had.
 */

export type OnboardingGuideVariant = 'blank' | 'sample';

const MARKED_PROJECTS_KEY = 'wbd:onboarding-guide-projects';
const dismissedKey = (projectId: string) => `wbd:onboarding-guide-dismissed:${projectId}`;

function readMarkedProjects(): Record<string, OnboardingGuideVariant> {
  try {
    const raw = localStorage.getItem(MARKED_PROJECTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const result: Record<string, OnboardingGuideVariant> = {};
    for (const [projectId, variant] of Object.entries(parsed as Record<string, unknown>)) {
      if (variant === 'blank' || variant === 'sample') result[projectId] = variant;
    }
    return result;
  } catch {
    return {};
  }
}

export function markProjectForOnboardingGuide(projectId: string, variant: OnboardingGuideVariant): void {
  try {
    const marked = readMarkedProjects();
    marked[projectId] = variant;
    localStorage.setItem(MARKED_PROJECTS_KEY, JSON.stringify(marked));
  } catch {
    // Guidance is a convenience; failing to persist the mark just means it won't show.
  }
}

export function getOnboardingGuideVariant(projectId: string): OnboardingGuideVariant | null {
  return readMarkedProjects()[projectId] ?? null;
}

export function isOnboardingGuideDismissed(projectId: string): boolean {
  try {
    return localStorage.getItem(dismissedKey(projectId)) === 'true';
  } catch {
    return true;
  }
}

export function dismissOnboardingGuide(projectId: string): void {
  try {
    localStorage.setItem(dismissedKey(projectId), 'true');
  } catch {
    // Non-critical.
  }
}

/** Lets the author bring the guide back for a project (e.g. from Settings). */
export function resetOnboardingGuide(projectId: string): void {
  try {
    localStorage.removeItem(dismissedKey(projectId));
  } catch {
    // Non-critical.
  }
}
