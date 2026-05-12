import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import type {Project, ProjectSettings} from '../entityTypes';
import {
  getOrCreateSettings,
  saveProjectSettings as persistProjectSettings
} from '../settingsStorage';

interface AppState {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  isRailCollapsed: boolean;

  setActiveProject: (project: Project | null) => Promise<void>;
  setProjectSettings: (settings: ProjectSettings | null) => void;
  loadProjectSettings: (projectId: string) => Promise<ProjectSettings>;
  saveProjectSettings: (settings: ProjectSettings) => Promise<ProjectSettings>;
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

      loadProjectSettings: async (projectId) => {
        const settings = await getOrCreateSettings(projectId);
        set((state) =>
          state.activeProject?.id === projectId ? {projectSettings: settings} : {}
        );
        return settings;
      },

      saveProjectSettings: async (settings) => {
        await persistProjectSettings(settings);
        set((state) =>
          state.activeProject?.id === settings.projectId
            ? {projectSettings: settings}
            : {}
        );
        return settings;
      },

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
