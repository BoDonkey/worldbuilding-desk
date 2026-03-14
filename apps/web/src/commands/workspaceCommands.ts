export const WORKSPACE_COMMAND_EVENT = 'workspace-command';

export type WorkspaceCommandId =
  | 'new-scene'
  | 'save-scene'
  | 'toggle-left-drawer'
  | 'toggle-right-drawer'
  | 'open-context-world-bible'
  | 'open-context-ruleset'
  | 'open-context-characters'
  | 'open-context-compendium'
  | 'toggle-system-history-panel'
  | 'run-consistency-review'
  | 'export-markdown'
  | 'export-docx'
  | 'export-epub'
  | 'extract-memory'
  | 'toggle-ai-panel';

interface WorkspaceCommandDetail {
  id: WorkspaceCommandId;
}

export const dispatchWorkspaceCommand = (id: WorkspaceCommandId): void => {
  window.dispatchEvent(
    new CustomEvent<WorkspaceCommandDetail>(WORKSPACE_COMMAND_EVENT, {
      detail: {id}
    })
  );
};
