import {useEffect, useState} from 'react';

export type WorkspaceContextDrawerView =
  | 'world-bible'
  | 'ruleset'
  | 'characters'
  | 'compendium'
  | 'review'
  | 'ai'
  | 'system'
  | 'lore';

interface WorkspaceDrawerPreferences {
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;
  activeContextView: WorkspaceContextDrawerView;
}

const isValidContextView = (
  value: unknown
): value is WorkspaceContextDrawerView =>
  value === 'world-bible' ||
  value === 'ruleset' ||
  value === 'characters' ||
  value === 'compendium' ||
  value === 'review' ||
  value === 'ai' ||
  value === 'system' ||
  value === 'lore';

export const useWorkspaceDrawers = (params: {
  activeProjectId: string | null;
  isNarrowViewport: boolean;
}) => {
  const {activeProjectId, isNarrowViewport} = params;
  const [isSceneDrawerOpen, setSceneDrawerOpen] = useState(false);
  const [isContextDrawerOpen, setContextDrawerOpen] = useState(false);
  const [activeContextView, setActiveContextView] =
    useState<WorkspaceContextDrawerView>('world-bible');
  const [isDrawerPrefsHydrated, setDrawerPrefsHydrated] = useState(false);

  useEffect(() => {
    if (!activeProjectId) return;
    setDrawerPrefsHydrated(false);
    const key = `workspaceDrawers:${activeProjectId}`;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        setSceneDrawerOpen(false);
        setContextDrawerOpen(false);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<WorkspaceDrawerPreferences>;
      if (isNarrowViewport) {
        setSceneDrawerOpen(false);
        setContextDrawerOpen(false);
      } else if (typeof parsed.leftDrawerOpen === 'boolean') {
        setSceneDrawerOpen(parsed.leftDrawerOpen);
      } else {
        setSceneDrawerOpen(false);
      }

      if (!isNarrowViewport && typeof parsed.rightDrawerOpen === 'boolean') {
        setContextDrawerOpen(parsed.rightDrawerOpen);
      } else if (!isNarrowViewport) {
        setContextDrawerOpen(false);
      }

      if (isValidContextView(parsed.activeContextView)) {
        setActiveContextView(parsed.activeContextView);
      }
    } catch {
      // Ignore malformed local state and continue with defaults.
    } finally {
      setDrawerPrefsHydrated(true);
    }
  }, [activeProjectId, isNarrowViewport]);

  useEffect(() => {
    if (!activeProjectId || !isDrawerPrefsHydrated) return;
    const key = `workspaceDrawers:${activeProjectId}`;
    const payload: WorkspaceDrawerPreferences = {
      leftDrawerOpen: isSceneDrawerOpen,
      rightDrawerOpen: isContextDrawerOpen,
      activeContextView
    };
    localStorage.setItem(key, JSON.stringify(payload));
  }, [
    activeProjectId,
    isDrawerPrefsHydrated,
    isSceneDrawerOpen,
    isContextDrawerOpen,
    activeContextView
  ]);

  return {
    isSceneDrawerOpen,
    setSceneDrawerOpen,
    isContextDrawerOpen,
    setContextDrawerOpen,
    activeContextView,
    setActiveContextView
  };
};
