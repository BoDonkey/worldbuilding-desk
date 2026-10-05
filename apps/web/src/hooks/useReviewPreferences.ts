import {useEffect, useState} from 'react';
import type {Project, ProjectSettings} from '../entityTypes';

/**
 * Per-project review preferences kept in this browser: unknown names the
 * author dismissed per scene, and suggested state changes hidden for now.
 * Also folds the legacy local ignore list into project settings once.
 */
export function useReviewPreferences({
  activeProject,
  projectSettings,
  saveProjectSettings
}: {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  saveProjectSettings: (settings: ProjectSettings) => Promise<ProjectSettings>;
}) {
  const [dismissedUnknownByDocument, setDismissedUnknownByDocument] = useState<
    Record<string, string[]>
  >({});
  const [hiddenStateMutationReviewKeys, setHiddenStateMutationReviewKeys] = useState<string[]>(
    []
  );
  const [isReviewPrefsHydrated, setReviewPrefsHydrated] = useState(false);

  useEffect(() => {
    if (!activeProject) {
      setDismissedUnknownByDocument({});
      setHiddenStateMutationReviewKeys([]);
      setReviewPrefsHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(`workspaceReviewPrefs:${activeProject.id}`);
      if (!raw) {
        setDismissedUnknownByDocument({});
        setReviewPrefsHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        setDismissedUnknownByDocument({});
        setReviewPrefsHydrated(true);
        return;
      }
      const prefs = parsed as {
        dismissedUnknownByDocument?: unknown;
        hiddenStateMutationReviewKeys?: unknown;
      };
      const nextDismissed: Record<string, string[]> = {};
      if (
        prefs.dismissedUnknownByDocument &&
        typeof prefs.dismissedUnknownByDocument === 'object'
      ) {
        Object.entries(prefs.dismissedUnknownByDocument as Record<string, unknown>).forEach(
          ([docId, values]) => {
            if (!Array.isArray(values)) return;
            nextDismissed[docId] = values
              .filter((value): value is string => typeof value === 'string')
              .map((value) => value.trim())
              .filter(Boolean);
          }
        );
      }
      const nextHiddenKeys = Array.isArray(prefs.hiddenStateMutationReviewKeys)
        ? prefs.hiddenStateMutationReviewKeys.filter(
            (value): value is string => typeof value === 'string' && value.trim().length > 0
          )
        : [];
      setDismissedUnknownByDocument(nextDismissed);
      setHiddenStateMutationReviewKeys(nextHiddenKeys);
    } catch {
      setDismissedUnknownByDocument({});
      setHiddenStateMutationReviewKeys([]);
    } finally {
      setReviewPrefsHydrated(true);
    }
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject || !projectSettings || !isReviewPrefsHydrated) return;
    try {
      const raw = localStorage.getItem(`workspaceReviewPrefs:${activeProject.id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as
        | {
            ignoredUnknownSurfaces?: unknown;
          }
        | null;
      const legacyIgnoredValues = parsed?.ignoredUnknownSurfaces;
      const legacyIgnored = (
        Array.isArray(legacyIgnoredValues) ? legacyIgnoredValues : []
      )
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      if (legacyIgnored.length === 0) return;

      const mergedIgnored = Array.from(
        new Set([...(projectSettings.ignoredUnknownSurfaces ?? []), ...legacyIgnored])
      );
      if (mergedIgnored.length === (projectSettings.ignoredUnknownSurfaces ?? []).length) {
        return;
      }

      const nextSettings: ProjectSettings = {
        ...projectSettings,
        ignoredUnknownSurfaces: mergedIgnored,
        updatedAt: Date.now()
      };
      void saveProjectSettings(nextSettings)
        .catch(() => {
          // Ignore migration errors and continue using current settings.
        });
    } catch {
      // Ignore malformed legacy local storage.
    }
  }, [activeProject, isReviewPrefsHydrated, projectSettings, saveProjectSettings]);

  useEffect(() => {
    if (!activeProject || !isReviewPrefsHydrated) return;
    localStorage.setItem(
      `workspaceReviewPrefs:${activeProject.id}`,
      JSON.stringify({
        dismissedUnknownByDocument,
        hiddenStateMutationReviewKeys
      })
    );
  }, [
    activeProject,
    dismissedUnknownByDocument,
    hiddenStateMutationReviewKeys,
    isReviewPrefsHydrated
  ]);

  return {
    dismissedUnknownByDocument,
    setDismissedUnknownByDocument,
    hiddenStateMutationReviewKeys,
    setHiddenStateMutationReviewKeys,
    isReviewPrefsHydrated
  };
}
