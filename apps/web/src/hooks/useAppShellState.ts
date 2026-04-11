import {useEffect, useState} from 'react';
import type {Project, ProjectSettings} from '../entityTypes';
import {getOrCreateSettings} from '../settingsStorage';

const ACTIVE_PROJECT_KEY = 'activeProject';
const RAIL_COLLAPSED_KEY = 'ui.railCollapsed';

const readStoredProject = (): Project | null => {
  const raw = localStorage.getItem(ACTIVE_PROJECT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
};

const readStoredRailState = (): boolean => {
  const raw = localStorage.getItem(RAIL_COLLAPSED_KEY);
  return raw === '1';
};

export const useAppShellState = () => {
  const [activeProject, setActiveProject] = useState<Project | null>(readStoredProject);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);
  const [isRailCollapsed, setRailCollapsed] = useState<boolean>(readStoredRailState);

  useEffect(() => {
    localStorage.setItem(RAIL_COLLAPSED_KEY, isRailCollapsed ? '1' : '0');
  }, [isRailCollapsed]);

  useEffect(() => {
    if (activeProject) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, JSON.stringify(activeProject));
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      setProjectSettings(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const settings = await getOrCreateSettings(activeProject.id);
      if (!cancelled) {
        setProjectSettings(settings);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  return {
    activeProject,
    setActiveProject,
    projectSettings,
    setProjectSettings,
    isRailCollapsed,
    setRailCollapsed
  };
};
