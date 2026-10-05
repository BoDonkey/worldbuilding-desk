import type {AITextProvenance} from '../../services/editor/aiTextProvenance';
import type {CharacterVoicePosition} from '../../services/characterLab';
import {CharacterLabDialog} from '../CharacterLab/CharacterLabDialog';
import {CharacterSceneDialog} from '../CharacterLab/CharacterSceneDialog';

interface WorkspaceCharacterLabDialogsProps {
  projectId: string;
  selectedSceneId: string | null;
  cursorPosition: number;
  labEntityId: string | null;
  sceneLabEntityId: string | null;
  onCloseLab: () => void;
  onCloseSceneLab: () => void;
  onInsertAtCursor: (html: string, provenance: AITextProvenance) => void;
}

/** The character lab and character scene dialogs, opened from the Workspace context drawer. */
export function WorkspaceCharacterLabDialogs({
  projectId,
  selectedSceneId,
  cursorPosition,
  labEntityId,
  sceneLabEntityId,
  onCloseLab,
  onCloseSceneLab,
  onInsertAtCursor
}: WorkspaceCharacterLabDialogsProps) {
  const defaultPosition: CharacterVoicePosition = selectedSceneId
    ? {kind: 'scene', sceneId: selectedSceneId, moment: 'cursor', cursorPosition}
    : {kind: 'latest'};
  return (
    <>
      {labEntityId && (
        <CharacterLabDialog
          isOpen
          projectId={projectId}
          entityId={labEntityId}
          defaultPosition={defaultPosition}
          onClose={onCloseLab}
        />
      )}
      {sceneLabEntityId && (
        <CharacterSceneDialog
          isOpen
          projectId={projectId}
          initialEntityIds={[sceneLabEntityId]}
          defaultPosition={defaultPosition}
          onInsertAtCursor={selectedSceneId ? onInsertAtCursor : undefined}
          onClose={onCloseSceneLab}
        />
      )}
    </>
  );
}
