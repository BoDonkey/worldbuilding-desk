export type WorkspaceScrollScope =
  | 'workspace-editor-scroll'
  | 'workspace-scroll'
  | 'wbd:workspace-window-scroll';

export const getWorkspaceSceneScrollKey = (
  scope: WorkspaceScrollScope,
  projectId: string,
  sceneId: string
): string => `${scope}:${projectId}:${sceneId}`;
