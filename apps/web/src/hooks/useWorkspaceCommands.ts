import {useCallback, useEffect} from 'react';
import {
  WORKSPACE_COMMAND_EVENT,
  type WorkspaceCommandId
} from '../commands/workspaceCommands';
import type {WorkspaceContextDrawerView} from './useWorkspaceDrawers';

interface UseWorkspaceCommandsOptions {
  handleNewDocument: () => void | Promise<void>;
  handleSave: () => void | Promise<void>;
  openScratchpadModal: () => void;
  openCorkboardModal: () => void;
  toggleSceneDrawer: () => void;
  toggleContextDrawer: () => void;
  openContextDrawer: (view: WorkspaceContextDrawerView) => void;
  showRuleAuthoring: boolean;
  showGameSystems: boolean;
  runConsistencyReviewFromUi: () => void | Promise<void>;
  openExportModalWithDrawerHandling: (format: 'markdown' | 'docx' | 'epub') => void;
  openMemoryModal: () => void;
}

export function useWorkspaceCommands({
  handleNewDocument,
  handleSave,
  openScratchpadModal,
  openCorkboardModal,
  toggleSceneDrawer,
  toggleContextDrawer,
  openContextDrawer,
  showRuleAuthoring,
  showGameSystems,
  runConsistencyReviewFromUi,
  openExportModalWithDrawerHandling,
  openMemoryModal
}: UseWorkspaceCommandsOptions) {
  const dispatchWorkspaceCommand = useCallback(
    (commandId: WorkspaceCommandId) => {
      switch (commandId) {
        case 'new-scene':
          void handleNewDocument();
          break;
        case 'save-scene':
          void handleSave();
          break;
        case 'open-scratchpad':
          openScratchpadModal();
          break;
        case 'open-corkboard':
          openCorkboardModal();
          break;
        case 'toggle-left-drawer':
          toggleSceneDrawer();
          break;
        case 'toggle-right-drawer':
          toggleContextDrawer();
          break;
        case 'open-context-world-bible':
          openContextDrawer('world-bible');
          break;
        case 'open-context-ruleset':
          if (showRuleAuthoring) {
            openContextDrawer('ruleset');
          }
          break;
        case 'open-context-characters':
          openContextDrawer('characters');
          break;
        case 'open-context-compendium':
          if (showGameSystems) {
            openContextDrawer('compendium');
          }
          break;
        case 'run-consistency-review':
          void runConsistencyReviewFromUi();
          break;
        case 'export-markdown':
          openExportModalWithDrawerHandling('markdown');
          break;
        case 'export-docx':
          openExportModalWithDrawerHandling('docx');
          break;
        case 'export-epub':
          openExportModalWithDrawerHandling('epub');
          break;
        case 'extract-memory':
          openMemoryModal();
          break;
        case 'toggle-ai-panel':
          openContextDrawer('ai');
          break;
        case 'toggle-system-history-panel':
          openContextDrawer('system');
          break;
        default:
          break;
      }
    },
    [
      handleNewDocument,
      handleSave,
      openScratchpadModal,
      openCorkboardModal,
      toggleSceneDrawer,
      toggleContextDrawer,
      openContextDrawer,
      showRuleAuthoring,
      showGameSystems,
      runConsistencyReviewFromUi,
      openExportModalWithDrawerHandling,
      openMemoryModal
    ]
  );

  useEffect(() => {
    const onWorkspaceCommand = (event: Event) => {
      const detail = (event as CustomEvent<{id?: WorkspaceCommandId}>).detail;
      if (detail?.id) {
        dispatchWorkspaceCommand(detail.id);
      }
    };

    window.addEventListener(WORKSPACE_COMMAND_EVENT, onWorkspaceCommand);
    return () => {
      window.removeEventListener(WORKSPACE_COMMAND_EVENT, onWorkspaceCommand);
    };
  }, [dispatchWorkspaceCommand]);

  return dispatchWorkspaceCommand;
}
