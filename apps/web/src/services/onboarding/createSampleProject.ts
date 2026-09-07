import type {Project, ProjectMode, ProjectSettings} from '../../entityTypes';
import {saveProject} from '../../projectStorage';
import {createDefaultSettings} from '../../settingsStorage';
import {getDefaultFeatureToggles} from '../../projectMode';
import {saveWritingDocument} from '../../writingStorage';
import {saveLoreDocument} from '../../loreStorage';
import {SAMPLE_CHAPTERS, SAMPLE_LORE_DOCUMENTS, SAMPLE_PROJECT_NAME} from '../../fixtures/sampleProjectContent';
import {markProjectForOnboardingGuide} from './onboardingGuide';

const SAMPLE_PROJECT_MODE: ProjectMode = 'litrpg';

/**
 * Creates the bundled first-run sample project: two manuscript scenes and
 * two lore documents (a character dossier and faction notes) with a
 * deliberate, self-contained factual conflict between the faction notes
 * and a trimmed brainstorm note about how long a character has served his
 * faction. Nothing is pre-extracted or pre-accepted as canon — the
 * getting-started guide walks the author through finding and resolving
 * that conflict themselves, through the real extraction and canon-decision
 * pipeline, not a fixture standing in for it.
 */
export async function createSampleProject(params: {
  saveProjectSettings: (settings: ProjectSettings) => Promise<unknown>;
}): Promise<Project> {
  const {saveProjectSettings} = params;
  const now = Date.now();
  const project: Project = {
    id: crypto.randomUUID(),
    name: SAMPLE_PROJECT_NAME,
    inheritRag: true,
    inheritShodh: true,
    createdAt: now,
    updatedAt: now
  };
  await saveProject(project);

  const defaultSettings = await createDefaultSettings(project.id);
  await saveProjectSettings({
    ...defaultSettings,
    projectMode: SAMPLE_PROJECT_MODE,
    featureToggles: getDefaultFeatureToggles(SAMPLE_PROJECT_MODE)
  });

  await Promise.all(
    SAMPLE_CHAPTERS.map((chapter, index) =>
      saveWritingDocument({
        id: crypto.randomUUID(),
        projectId: project.id,
        title: chapter.title,
        content: chapter.content,
        order: index,
        createdAt: now + index,
        updatedAt: now + index
      })
    )
  );

  await Promise.all(
    SAMPLE_LORE_DOCUMENTS.map((document, index) =>
      saveLoreDocument({
        id: crypto.randomUUID(),
        projectId: project.id,
        title: document.title,
        kind: document.kind,
        format: 'plain_text',
        content: document.content,
        source: {type: 'manual'},
        status: 'active',
        createdAt: now + index,
        updatedAt: now + index
      })
    )
  );

  markProjectForOnboardingGuide(project.id, 'sample');
  return project;
}
