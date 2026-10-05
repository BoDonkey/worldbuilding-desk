import {useEffect, useState} from 'react';
import type {ProjectAISettings} from '../../entityTypes';
import type {AITextProvenance} from '../../services/editor/aiTextProvenance';
import {canDraftScenes, isSceneDraftable} from '../../services/sceneDraft/sceneDraft';
import {useWorkspaceUiStore} from '../../store/workspaceUiStore';
import {SceneDraftDialog} from '../SceneDraft/SceneDraftDialog';

interface WorkspaceSceneDraftEntryProps {
  projectId: string;
  sceneId: string;
  sceneTitle: string;
  /** The scene as edited; drafting is offered only while it is empty or nearly so. */
  content: string;
  aiSettings: ProjectAISettings | undefined;
  onInsert: (html: string, provenance: AITextProvenance) => void;
}

/**
 * **Draft this scene** on an empty or near-empty scene, when the project allows
 * AI scene drafts. Also opens for a request from a Corkboard chapter card.
 * Render it keyed by scene, so switching scenes closes the dialog.
 */
export function WorkspaceSceneDraftEntry({
  projectId,
  sceneId,
  sceneTitle,
  content,
  aiSettings,
  onInsert
}: WorkspaceSceneDraftEntryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const requestedSceneId = useWorkspaceUiStore((state) => state.sceneDraftRequestSceneId);
  const requestSceneDraft = useWorkspaceUiStore((state) => state.requestSceneDraft);
  const available = canDraftScenes(aiSettings) && isSceneDraftable(content);

  useEffect(() => {
    if (requestedSceneId !== sceneId) return;
    requestSceneDraft(null);
    if (available) setIsOpen(true);
  }, [available, requestSceneDraft, requestedSceneId, sceneId]);

  return (
    <>
      {available && (
        <button type='button' onClick={() => setIsOpen(true)}>
          Draft this scene
        </button>
      )}
      <SceneDraftDialog
        isOpen={isOpen}
        projectId={projectId}
        sceneId={sceneId}
        sceneTitle={sceneTitle}
        onInsert={onInsert}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
