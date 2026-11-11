import {useCallback, useEffect, useState} from 'react';
import type {
  EditorTextSnapshot,
  StateMutationTextAnchor
} from '../services/state/stateMutationAnchor';
import type {
  PendingInventoryCapture,
  PendingPositionedChange
} from '../services/workspace/sceneRosterMutationTypes';

/**
 * Where the writer is in the open scene (cursor position, the text around
 * it, and which moment the scene roster shows), plus the state-change
 * dialogs opened from that spot. Switching scenes moves back to the opening
 * and closes a pending positioned change.
 */
export function useWorkspaceSceneCursor(selectedId: string | null) {
  const [sceneRosterStateMoment, setSceneRosterStateMoment] = useState<
    'opening' | 'cursor' | 'ending'
  >('opening');
  const [sceneCursorPosition, setSceneCursorPosition] = useState(1);
  const [sceneCursorSnapshot, setSceneCursorSnapshot] = useState<EditorTextSnapshot>({
    text: '',
    spans: []
  });
  const [sceneCursorAnchor, setSceneCursorAnchor] = useState<StateMutationTextAnchor>({
    before: '',
    after: ''
  });
  const [pendingPositionedChange, setPendingPositionedChange] =
    useState<PendingPositionedChange | null>(null);
  const [isSavingPositionedChange, setSavingPositionedChange] = useState(false);
  const [pendingInventoryCapture, setPendingInventoryCapture] =
    useState<PendingInventoryCapture | null>(null);
  const [isSavingInventoryCapture, setSavingInventoryCapture] = useState(false);

  useEffect(() => {
    setSceneCursorPosition(1);
    setSceneRosterStateMoment('opening');
    setPendingPositionedChange(null);
  }, [selectedId]);

  /** For the editor's cursor-context callback. */
  const handleCursorContextChange = useCallback(
    ({position, snapshot, anchor}: {
      position: number;
      snapshot: EditorTextSnapshot;
      anchor: StateMutationTextAnchor;
    }) => {
      setSceneCursorPosition(position);
      setSceneCursorSnapshot(snapshot);
      setSceneCursorAnchor(anchor);
    },
    []
  );

  return {
    sceneRosterStateMoment,
    setSceneRosterStateMoment,
    sceneCursorPosition,
    setSceneCursorPosition,
    sceneCursorSnapshot,
    sceneCursorAnchor,
    setSceneCursorAnchor,
    handleCursorContextChange,
    pendingPositionedChange,
    setPendingPositionedChange,
    isSavingPositionedChange,
    setSavingPositionedChange,
    pendingInventoryCapture,
    setPendingInventoryCapture,
    isSavingInventoryCapture,
    setSavingInventoryCapture
  };
}
