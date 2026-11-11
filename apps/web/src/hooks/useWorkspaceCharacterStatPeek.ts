import {useEffect, useMemo, useState} from 'react';
import type {
  CharacterSheet,
  Project,
  ProjectSettings,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import type {ConsistencyAlias} from '../services/storage';
import {
  CHARACTER_STAT_PEEK_EVENT,
  type CharacterStatPeekRequestDetail
} from '../commands/characterStatPeek';
import {
  buildCharacterPeekTargets,
  resolveCharacterStatCardTemplate
} from '../services/state/characterPeek';
import {useWorkspaceUiStore} from '../store/workspaceUiStore';
import type {useWorkspaceSceneRoster} from './useWorkspaceSceneRoster';

type SceneRoster = ReturnType<typeof useWorkspaceSceneRoster>;

interface UseWorkspaceCharacterStatPeekParams {
  activeProject: Project | null;
  showGameSystems: boolean;
  selectedDocument: WritingDocument | null | undefined;
  selectedSceneOrder: number;
  sceneCursorPosition: number;
  characterSheets: CharacterSheet[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  statBlockPreferences: ProjectSettings['statBlockPreferences'];
  getCharacterStatSnapshot: SceneRoster['getCharacterStatSnapshot'];
  getCharacterStatSnapshotAt: SceneRoster['getCharacterStatSnapshotAt'];
}

/**
 * Character stat peeks in a game-systems project: which names in the scene
 * open a stat card, the scene and cursor the floating stat panel reads, and
 * peek requests sent from elsewhere (the command palette). Off when game
 * systems are hidden or no scene is open.
 */
export function useWorkspaceCharacterStatPeek({
  activeProject,
  showGameSystems,
  selectedDocument,
  selectedSceneOrder,
  sceneCursorPosition,
  characterSheets,
  entities,
  aliases,
  statBlockPreferences,
  getCharacterStatSnapshot,
  getCharacterStatSnapshotAt
}: UseWorkspaceCharacterStatPeekParams) {
  const characterPeekTargets = useMemo(
    () => buildCharacterPeekTargets({sheets: characterSheets, entities, aliases}),
    [aliases, characterSheets, entities]
  );
  const characterStatPeek = useMemo(
    () =>
      showGameSystems && selectedDocument
        ? {
            targets: characterPeekTargets,
            getSnapshot: getCharacterStatSnapshot,
            template: resolveCharacterStatCardTemplate(statBlockPreferences),
            sceneTitle: selectedDocument.title || 'Untitled scene'
          }
        : undefined,
    [
      characterPeekTargets,
      getCharacterStatSnapshot,
      selectedDocument,
      showGameSystems,
      statBlockPreferences
    ]
  );
  const setWorkspaceStatContext = useWorkspaceUiStore((s) => s.setWorkspaceStatContext);
  useEffect(() => {
    if (!activeProject || !showGameSystems || !selectedDocument || selectedSceneOrder <= 0) {
      setWorkspaceStatContext(null);
      return;
    }
    setWorkspaceStatContext({
      projectId: activeProject.id,
      sceneId: selectedDocument.id,
      sceneTitle: selectedDocument.title || 'Untitled scene',
      sceneOrder: selectedSceneOrder,
      cursorPosition: sceneCursorPosition,
      getSnapshot: getCharacterStatSnapshotAt
    });
  }, [
    activeProject,
    getCharacterStatSnapshotAt,
    sceneCursorPosition,
    selectedDocument,
    selectedSceneOrder,
    setWorkspaceStatContext,
    showGameSystems
  ]);
  useEffect(() => () => setWorkspaceStatContext(null), [setWorkspaceStatContext]);
  const [statPeekRequest, setStatPeekRequest] = useState<{
    sheetId: string;
    token: number;
  } | null>(null);
  useEffect(() => {
    if (!characterStatPeek) return;
    const onStatPeekRequest = (event: Event) => {
      const detail = (event as CustomEvent<CharacterStatPeekRequestDetail>).detail;
      if (!detail || detail.handled) return;
      if (!characterStatPeek.targets.some((target) => target.sheetId === detail.sheetId)) return;
      detail.handled = true;
      setStatPeekRequest((current) => ({
        sheetId: detail.sheetId,
        token: (current?.token ?? 0) + 1
      }));
    };
    window.addEventListener(CHARACTER_STAT_PEEK_EVENT, onStatPeekRequest);
    return () => window.removeEventListener(CHARACTER_STAT_PEEK_EVENT, onStatPeekRequest);
  }, [characterStatPeek]);

  return {characterStatPeek, statPeekRequest};
}
