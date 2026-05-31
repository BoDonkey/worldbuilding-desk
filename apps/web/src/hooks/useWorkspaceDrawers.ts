import {useEffect} from 'react';
import {
  useWorkspaceUiStore,
  type WorkspaceContextDrawerView
} from '../store/workspaceUiStore';

export type {WorkspaceContextDrawerView};

export const useWorkspaceDrawers = (params: {
  activeProjectId: string | null;
  isNarrowViewport: boolean;
}) => {
  const {activeProjectId, isNarrowViewport} = params;
  const isSceneDrawerOpen = useWorkspaceUiStore((state) => state.isSceneDrawerOpen);
  const setSceneDrawerOpen = useWorkspaceUiStore((state) => state.setSceneDrawerOpen);
  const isContextDrawerOpen = useWorkspaceUiStore((state) => state.isContextDrawerOpen);
  const setContextDrawerOpen = useWorkspaceUiStore((state) => state.setContextDrawerOpen);
  const activeContextView = useWorkspaceUiStore((state) => state.activeContextView);
  const setActiveContextView = useWorkspaceUiStore((state) => state.setActiveContextView);
  const setWorkspaceDrawerContext = useWorkspaceUiStore(
    (state) => state.setWorkspaceDrawerContext
  );

  useEffect(() => {
    setWorkspaceDrawerContext(activeProjectId, isNarrowViewport);
  }, [activeProjectId, isNarrowViewport, setWorkspaceDrawerContext]);

  return {
    isSceneDrawerOpen,
    setSceneDrawerOpen,
    isContextDrawerOpen,
    setContextDrawerOpen,
    activeContextView,
    setActiveContextView
  };
};
