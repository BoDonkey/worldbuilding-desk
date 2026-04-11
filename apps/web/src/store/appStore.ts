import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import type {Project, ProjectSettings} from '../entityTypes';
import {getOrCreateSettings} from '../settingsStorage';

interface AppState {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  isRailCollapsed: boolean;

  setActiveProject: (project: Project | null) => Promise<void>;
  setProjectSettings: (settings: ProjectSettings | null) => void;
  setRailCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProject: null,
      projectSettings: null,
      isRailCollapsed: false,

      setActiveProject: async (project) => {
        set({activeProject: project, projectSettings: null});
        if (project) {
          const settings = await getOrCreateSettings(project.id);
          set({projectSettings: settings});
        }
      },

      setProjectSettings: (settings) => set({projectSettings: settings}),

      setRailCollapsed: (collapsed) => set({isRailCollapsed: collapsed}),
    }),
    {
      name: 'wbd-app-shell',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeProject: state.activeProject,
        isRailCollapsed: state.isRailCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.activeProject) {
          getOrCreateSettings(state.activeProject.id)
            .then((settings) => {
              useAppStore.setState({projectSettings: settings});
            })
            .catch(() => {
              // Settings load failed; project stays set, settings stays null.
            });
        }
      },
    }
  )
);
