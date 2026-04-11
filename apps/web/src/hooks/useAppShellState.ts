import {useAppStore} from '../store/appStore';

/**
 * Thin wrapper over the Zustand app store.
 * Preserves the same API shape so App.tsx does not need changes beyond
 * removing prop drilling to child routes.
 */
export const useAppShellState = () => {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const isRailCollapsed = useAppStore((s) => s.isRailCollapsed);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const setProjectSettings = useAppStore((s) => s.setProjectSettings);
  const setRailCollapsed = useAppStore((s) => s.setRailCollapsed);

  return {
    activeProject,
    setActiveProject,
    projectSettings,
    setProjectSettings,
    isRailCollapsed,
    setRailCollapsed,
  };
};
