import {useCallback} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {Project, ProjectSettings} from '../entityTypes';
import type {GuardrailIssue} from '../services/consistency';
import type {ConsistencyReviewItem} from '../services/consistency/reviewReadiness';
import {canonicalizeUnknownSurface} from '../services/consistency/sceneReviewHelpers';
import {describeError} from '../services/errors';
import type {ConsistencyFeedback} from './useConsistencyReviewRuns';
import type {ConsistencyPopoverState} from './useUnknownEntityResolution';

/** Setting unknown names aside: for a scene, for all current ones, or project-wide. */
export function useUnknownEntityDismissal({
  activeProject,
  projectSettings,
  saveProjectSettings,
  selectedDocumentId,
  setFeedback,
  unknownGuardrailIssues,
  removeReviewSurface,
  setGuardrailIssues,
  setConsistencyReviewItems,
  setDismissedUnknownByDocument,
  setConsistencyPopover
}: {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  saveProjectSettings: (settings: ProjectSettings) => Promise<ProjectSettings>;
  selectedDocumentId: string | null;
  setFeedback: ConsistencyFeedback;
  unknownGuardrailIssues: GuardrailIssue[];
  removeReviewSurface: (surface: string, options?: {docId?: string}) => void;
  setGuardrailIssues: Dispatch<SetStateAction<GuardrailIssue[]>>;
  setConsistencyReviewItems: Dispatch<SetStateAction<ConsistencyReviewItem[]>>;
  setDismissedUnknownByDocument: Dispatch<SetStateAction<Record<string, string[]>>>;
  setConsistencyPopover: Dispatch<SetStateAction<ConsistencyPopoverState | null>>;
}) {
  const clearUnknownSurface = useCallback((surface: string) => {
    removeReviewSurface(surface, {docId: selectedDocumentId ?? undefined});
  }, [removeReviewSurface, selectedDocumentId]);

  const dismissAllUnknownEntities = useCallback((docId?: string) => {
    const dismissedSurfaces = Array.from(
      new Set(
        unknownGuardrailIssues
          .map((issue) => issue.surface?.trim())
          .filter((surface): surface is string => Boolean(surface))
      )
    );
    const blocked = new Set(
        unknownGuardrailIssues
          .map((issue) => (issue.surface ? canonicalizeUnknownSurface(issue.surface) : ''))
          .filter((surface): surface is string => Boolean(surface))
    );
    if (docId && dismissedSurfaces.length > 0) {
      setDismissedUnknownByDocument((prev) => ({
        ...prev,
        [docId]: Array.from(
          new Set([...(prev[docId] ?? []), ...dismissedSurfaces])
        )
      }));
    }
    setGuardrailIssues((prev) =>
      prev.filter((issue) => {
        const surface = issue.surface ? canonicalizeUnknownSurface(issue.surface) : '';
        return !surface || !blocked.has(surface);
      })
    );
    setConsistencyReviewItems((prev) =>
      prev.filter((item) => {
        const surface = item.issue.surface
          ? canonicalizeUnknownSurface(item.issue.surface)
          : '';
        return !surface || !blocked.has(surface);
      })
    );
    setFeedback({
      tone: 'success',
      message: 'Unknown entity warnings dismissed for now.'
    });
  }, [setConsistencyReviewItems, setDismissedUnknownByDocument, setGuardrailIssues, setFeedback, unknownGuardrailIssues]);

  const dismissUnknownEntity = useCallback((surface: string, docId?: string) => {
    const normalized = canonicalizeUnknownSurface(surface);
    if (!normalized) return;
    if (docId) {
      setDismissedUnknownByDocument((prev) => ({
        ...prev,
        [docId]: Array.from(new Set([...(prev[docId] ?? []), surface.trim()]))
      }));
    }
    removeReviewSurface(surface, {docId});
    setConsistencyPopover((prev) =>
      canonicalizeUnknownSurface(prev?.surface ?? '') === normalized ? null : prev
    );
  }, [setConsistencyPopover, setDismissedUnknownByDocument, removeReviewSurface]);

  const ignoreUnknownSurfaceProjectWide = useCallback(
    (surface: string, docId?: string) => {
      const normalized = surface.trim();
      if (!normalized) return;
      if (!projectSettings || !activeProject) {
        setFeedback({
          tone: 'error',
          message: 'Project settings are not available yet. Try again in a moment.'
        });
        return;
      }
      const mergedIgnored = Array.from(
        new Set([...(projectSettings.ignoredUnknownSurfaces ?? []), normalized.toLowerCase()])
      );
      if (docId) {
        setDismissedUnknownByDocument((prev) => ({
          ...prev,
          [docId]: Array.from(new Set([...(prev[docId] ?? []), surface.trim()]))
        }));
      }
      removeReviewSurface(surface);
      setConsistencyPopover((prev) =>
        canonicalizeUnknownSurface(prev?.surface ?? '') ===
        canonicalizeUnknownSurface(surface)
          ? null
          : prev
      );
      const nextSettings: ProjectSettings = {
        ...projectSettings,
        ignoredUnknownSurfaces: mergedIgnored,
        updatedAt: Date.now()
      };
      void saveProjectSettings(nextSettings)
        .then(() => {
          setFeedback({
            tone: 'success',
            message: `"${normalized}" will be ignored for this project in future reviews.`
          });
        })
        .catch((error) => {
          const message =
            describeError(error, 'Unable to save project review settings.');
          setFeedback({tone: 'error', message});
        });
    },
    [
      setConsistencyPopover,
      setDismissedUnknownByDocument,
      activeProject,
      projectSettings,
      removeReviewSurface,
      setFeedback,
      saveProjectSettings
    ]
  );

  return {
    clearUnknownSurface,
    dismissAllUnknownEntities,
    dismissUnknownEntity,
    ignoreUnknownSurfaceProjectWide
  };
}
