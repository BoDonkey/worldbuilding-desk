import type {Project, ProjectMode, ProjectSettings} from '../../entityTypes';
import {saveProject} from '../../projectStorage';
import {createDefaultSettings} from '../../settingsStorage';
import {getDefaultFeatureToggles} from '../../projectMode';
import {saveWritingDocument} from '../../writingStorage';
import {markProjectForOnboardingGuide} from './onboardingGuide';

const FIRST_RUN_CHECK_KEY = 'wbd:first-run-checked';
const FIRST_RUN_PROJECT_MODE: ProjectMode = 'general';

/** Whether the one-time first-run check (create a blank project if none exist) has
 * already run. Checked once per install, never re-triggered by later deleting all
 * projects — that is a deliberate author choice, not a fresh install.
 *
 * Also true under Cypress: e2e specs seed their own known project state on the very
 * first visit, before test isolation has necessarily left anything in IndexedDB for
 * this check to see, and must not race against an unrequested project being created. */
export function hasCheckedFirstRun(): boolean {
  if (typeof window !== 'undefined' && 'Cypress' in window) return true;
  try {
    return localStorage.getItem(FIRST_RUN_CHECK_KEY) === 'true';
  } catch {
    return true;
  }
}

export function markFirstRunChecked(): void {
  try {
    localStorage.setItem(FIRST_RUN_CHECK_KEY, 'true');
  } catch {
    // Non-critical: worst case, the check runs again next launch.
  }
}

/**
 * Creates the blank draft-ready project a brand-new install lands in
 * immediately — one untitled scene, no provider or ruleset setup, general
 * fiction by default (the lowest-friction blank canvas). This is distinct
 * from the bundled sample project (createSampleProject.ts), which the
 * getting-started guide offers as an alternative, opt-in path.
 */
export async function createFirstRunProject(params: {
  saveProjectSettings: (settings: ProjectSettings) => Promise<unknown>;
}): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: crypto.randomUUID(),
    name: 'My First Project',
    inheritRag: true,
    inheritShodh: true,
    createdAt: now,
    updatedAt: now
  };
  await saveProject(project);

  const defaultSettings = await createDefaultSettings(project.id);
  if (defaultSettings.projectMode !== FIRST_RUN_PROJECT_MODE) {
    await params.saveProjectSettings({
      ...defaultSettings,
      projectMode: FIRST_RUN_PROJECT_MODE,
      featureToggles: getDefaultFeatureToggles(FIRST_RUN_PROJECT_MODE)
    });
  }

  await saveWritingDocument({
    id: crypto.randomUUID(),
    projectId: project.id,
    title: 'Chapter One',
    content: '',
    order: 0,
    createdAt: now,
    updatedAt: now
  });

  markProjectForOnboardingGuide(project.id, 'blank');
  return project;
}
