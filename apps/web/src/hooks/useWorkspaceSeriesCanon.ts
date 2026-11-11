import {useCallback, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {Project, WritingDocument} from '../entityTypes';
import {
  promoteDocumentToParent,
  syncChildWithParent,
  type SeriesBibleConfig
} from '../services/seriesBible/SeriesBibleService';
import {describeError} from '../services/errors';
import type {useWorkspaceProjectData} from './useWorkspaceProjectData';
import type {useWorkspaceSystemHistory} from './useWorkspaceSystemHistory';

type ProjectData = ReturnType<typeof useWorkspaceProjectData>;

interface UseWorkspaceSeriesCanonParams {
  activeProject: Project | null;
  seriesBibleConfig: SeriesBibleConfig | null;
  selectedDocument: WritingDocument | null | undefined;
  setCanonState: ProjectData['setCanonState'];
  addSystemHistory: ReturnType<typeof useWorkspaceSystemHistory>['addSystemHistory'];
  setFeedback: Dispatch<SetStateAction<{tone: 'success' | 'error'; message: string} | null>>;
}

/**
 * A book in a series: promoting the open scene to the parent project's canon,
 * and marking this project as synced with the parent's canon.
 */
export function useWorkspaceSeriesCanon({
  activeProject,
  seriesBibleConfig,
  selectedDocument,
  setCanonState,
  addSystemHistory,
  setFeedback
}: UseWorkspaceSeriesCanonParams) {
  const [isPromotingDocument, setIsPromotingDocument] = useState(false);
  const [isSyncingCanon, setIsSyncingCanon] = useState(false);

  const handlePromoteDocument = useCallback(async () => {
    if (
      !seriesBibleConfig?.parentProjectId ||
      !selectedDocument
    ) {
      return;
    }
    setIsPromotingDocument(true);
    setFeedback(null);
    try {
      await promoteDocumentToParent({
        parentProjectId: seriesBibleConfig.parentProjectId,
        documentId: selectedDocument.id,
        title: selectedDocument.title || 'Untitled scene',
        content: selectedDocument.content,
        type: 'scene',
        tags: ['scene']
      });
      setFeedback({tone: 'success', message: 'Scene promoted to parent canon.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to promote scene.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsPromotingDocument(false);
    }
  }, [seriesBibleConfig?.parentProjectId, selectedDocument, setFeedback]);

  const handleCanonSync = useCallback(async () => {
    if (!activeProject) return;
    setIsSyncingCanon(true);
    setFeedback(null);
    try {
      const updated = await syncChildWithParent(activeProject.id);
      if (updated) {
        setCanonState((prev) => ({
          ...prev,
          childLastSynced: updated.lastSyncedCanon
        }));
      }
      setFeedback({tone: 'success', message: 'Canon sync state updated.'});
      addSystemHistory({
        category: 'consistency',
        message: 'Canon sync state marked as updated.'
      });
    } catch (error) {
      const message =
        describeError(error, 'Unable to mark canon as synced.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsSyncingCanon(false);
    }
  }, [activeProject, addSystemHistory, setCanonState, setFeedback]);

  return {isPromotingDocument, handlePromoteDocument, isSyncingCanon, handleCanonSync};
}
