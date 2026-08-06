import {useCallback, useEffect, useRef, useState} from 'react';
import {
  useWorkspaceUiStore,
  type WorkspaceContextDrawerView
} from '../store/workspaceUiStore';
import {useFocusTrap} from './useFocusTrap';

export type {WorkspaceContextDrawerView};

export const useWorkspaceDrawers = (params: {
  activeProjectId: string | null;
}) => {
  const {activeProjectId} = params;
  const sceneDrawerDialogRef = useRef<HTMLDivElement | null>(null);
  const contextDrawerDialogRef = useRef<HTMLDivElement | null>(null);
  const [isNarrowViewport, setNarrowViewport] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 1200px)').matches
      : false
  );
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

  const closeSceneDrawer = useCallback(() => {
    setSceneDrawerOpen(false);
  }, [setSceneDrawerOpen]);

  const closeContextDrawer = useCallback(() => {
    setContextDrawerOpen(false);
  }, [setContextDrawerOpen]);

  const toggleSceneDrawer = useCallback(() => {
    setSceneDrawerOpen((previous) => {
      const next = !previous;
      if (isNarrowViewport && next) {
        setContextDrawerOpen(false);
      }
      return next;
    });
  }, [isNarrowViewport, setContextDrawerOpen, setSceneDrawerOpen]);

  const toggleContextDrawer = useCallback(() => {
    setContextDrawerOpen((previous) => {
      const next = !previous;
      if (isNarrowViewport && next) {
        setSceneDrawerOpen(false);
      }
      return next;
    });
  }, [isNarrowViewport, setContextDrawerOpen, setSceneDrawerOpen]);

  const openContextDrawer = useCallback((view: WorkspaceContextDrawerView) => {
    setActiveContextView(view);
    setContextDrawerOpen(true);
    if (isNarrowViewport) {
      setSceneDrawerOpen(false);
    }
  }, [isNarrowViewport, setActiveContextView, setContextDrawerOpen, setSceneDrawerOpen]);

  useFocusTrap(sceneDrawerDialogRef, isSceneDrawerOpen && isNarrowViewport);
  useFocusTrap(contextDrawerDialogRef, isContextDrawerOpen && isNarrowViewport);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1200px)');
    const update = () => setNarrowViewport(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isNarrowViewport) return;
    closeSceneDrawer();
    closeContextDrawer();
  }, [closeContextDrawer, closeSceneDrawer, isNarrowViewport]);

  useEffect(() => {
    if (!isNarrowViewport || (!isContextDrawerOpen && !isSceneDrawerOpen)) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isContextDrawerOpen) {
        closeContextDrawer();
        return;
      }
      closeSceneDrawer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    closeContextDrawer,
    closeSceneDrawer,
    isContextDrawerOpen,
    isNarrowViewport,
    isSceneDrawerOpen
  ]);

  return {
    sceneDrawerDialogRef,
    contextDrawerDialogRef,
    isNarrowViewport,
    isSceneDrawerOpen,
    setSceneDrawerOpen,
    isContextDrawerOpen,
    setContextDrawerOpen,
    activeContextView,
    setActiveContextView,
    closeSceneDrawer,
    closeContextDrawer,
    toggleSceneDrawer,
    toggleContextDrawer,
    openContextDrawer
  };
};
