import type {Project, ProjectMode, ProjectSettings} from '../../entityTypes';
import {saveProject} from '../../projectStorage';
import {createDefaultSettings} from '../../settingsStorage';
import {getDefaultFeatureToggles} from '../../projectMode';
import {saveWritingDocument} from '../../writingStorage';
import {saveLoreDocument} from '../../loreStorage';
import {saveRuleset} from '../rules/rulesetService';
import {
  TRUST_DOGFOOD_CHAPTERS,
  TRUST_DOGFOOD_LORE_DOCUMENTS,
  TRUST_DOGFOOD_RULESET
} from '../../fixtures/trustDogfoodContent.generated';

export const TRUST_DOGFOOD_PROJECT_NAME = 'Ember Ledger Dogfood';
const TRUST_DOGFOOD_PROJECT_MODE: ProjectMode = 'litrpg';

export interface CreateTrustDogfoodProjectOptions {
  saveProjectSettings: (settings: ProjectSettings) => Promise<unknown>;
  /** Project name; defaults to the runbook's suggested name. */
  name?: string;
  /** Include the fixture ruleset and link it to the project (runbook step A-2). Default true. */
  includeRuleset?: boolean;
  /** Include the four lore files as Source Notes (runbook step A-6 import half). Default true. */
  includeLore?: boolean;
}

/**
 * Seeds the Slice 1.1 trust-dogfood fixture as a fresh project: the five
 * manuscript chapters as scenes, the four lore files as Source Notes, and
 * the fixture ruleset linked to the project. Nothing else: no World Bible
 * records, aliases, accepted facts, sheets, or state events, because every
 * one of those is an author action the run is meant to observe. This only
 * replaces the file-by-file import steps (A-1, A-2, the import halves of
 * A-4/A-5 and A-6), whose import paths are covered by Cypress.
 */
export async function createTrustDogfoodProject(
  options: CreateTrustDogfoodProjectOptions
): Promise<Project> {
  const {saveProjectSettings, includeRuleset = true, includeLore = true} = options;
  const now = Date.now();
  let project: Project = {
    id: crypto.randomUUID(),
    name: options.name?.trim() || TRUST_DOGFOOD_PROJECT_NAME,
    inheritRag: true,
    inheritShodh: true,
    createdAt: now,
    updatedAt: now
  };
  await saveProject(project);

  const defaultSettings = await createDefaultSettings(project.id);
  await saveProjectSettings({
    ...defaultSettings,
    projectMode: TRUST_DOGFOOD_PROJECT_MODE,
    featureToggles: getDefaultFeatureToggles(TRUST_DOGFOOD_PROJECT_MODE)
  });

  if (includeRuleset) {
    await saveRuleset(TRUST_DOGFOOD_RULESET, project.id);
    project = {...project, rulesetId: TRUST_DOGFOOD_RULESET.id, updatedAt: Date.now()};
    await saveProject(project);
  }

  for (const [index, chapter] of TRUST_DOGFOOD_CHAPTERS.entries()) {
    await saveWritingDocument({
      id: crypto.randomUUID(),
      projectId: project.id,
      title: chapter.title,
      content: chapter.content,
      order: index,
      createdAt: now + index,
      updatedAt: now + index
    });
  }

  if (includeLore) {
    for (const [index, document] of TRUST_DOGFOOD_LORE_DOCUMENTS.entries()) {
      await saveLoreDocument({
        id: crypto.randomUUID(),
        projectId: project.id,
        title: document.title,
        kind: document.kind,
        format: 'markdown',
        content: document.content,
        source: {type: 'import', fileName: document.fileName, mimeType: 'text/markdown'},
        status: 'active',
        createdAt: now + index,
        updatedAt: now + index
      });
    }
  }

  return project;
}
