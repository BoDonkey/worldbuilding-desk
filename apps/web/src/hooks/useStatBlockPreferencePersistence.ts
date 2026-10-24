import {useEffect} from 'react';
import type {Project, ProjectSettings} from '../entityTypes';
import {
  buildStatBlockPreferences,
  statBlockPreferencesMatch,
  type StatBlockPreferenceInput
} from '../services/workspace/statBlockResolution';

/**
 * Saves the Workspace stat-block selections to project settings whenever they
 * differ from what is stored, once the saved preferences have been hydrated.
 */
export const useStatBlockPreferencePersistence = (params: {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  saveProjectSettings: (settings: ProjectSettings) => Promise<ProjectSettings>;
  isStatPreferencesHydrated: boolean;
  preferences: StatBlockPreferenceInput;
}) => {
  const {activeProject, projectSettings, saveProjectSettings, isStatPreferencesHydrated, preferences} = params;
  const {sourceType, style, insertMode, scopePreset, selectedGroupId, selectedStatIds, selectedResourceIds, groups} =
    preferences;

  useEffect(() => {
    if (!activeProject || !projectSettings || !isStatPreferencesHydrated) {
      return;
    }
    const nextPreferences: StatBlockPreferenceInput = {
      sourceType,
      style,
      insertMode,
      scopePreset,
      selectedGroupId,
      selectedStatIds,
      selectedResourceIds,
      groups
    };
    if (statBlockPreferencesMatch(projectSettings.statBlockPreferences, nextPreferences)) {
      return;
    }
    const nextSettings: ProjectSettings = {
      ...projectSettings,
      statBlockPreferences: buildStatBlockPreferences(nextPreferences),
      updatedAt: Date.now()
    };
    void saveProjectSettings(nextSettings);
  }, [
    activeProject,
    projectSettings,
    sourceType,
    style,
    insertMode,
    scopePreset,
    selectedGroupId,
    selectedStatIds,
    selectedResourceIds,
    groups,
    isStatPreferencesHydrated,
    saveProjectSettings
  ]);
};
