import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import type {StateStorage} from 'zustand/middleware';
import type {Project, ProjectSettings} from '../entityTypes';
import {
  getOrCreateSettings,
  saveProjectSettings as persistProjectSettings
} from '../settingsStorage';

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined
};

const getAppStorage = () =>
  typeof window === 'undefined' ? noopStorage : window.localStorage;

interface AppState {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  projectSettingsStatus: 'idle' | 'loading' | 'ready' | 'error';
  projectSettingsError: string | null;
  isRailCollapsed: boolean;

  setActiveProject: (project: Project | null) => Promise<void>;
  setProjectSettings: (settings: ProjectSettings | null) => void;
  loadProjectSettings: (projectId: string) => Promise<ProjectSettings>;
  saveProjectSettings: (settings: ProjectSettings) => Promise<ProjectSettings>;
  setRailCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      let projectSettingsRequestId = 0;

      return {
        activeProject: null,
        projectSettings: null,
        projectSettingsStatus: 'idle',
        projectSettingsError: null,
        isRailCollapsed: false,

        setActiveProject: async (project) => {
          const requestId = ++projectSettingsRequestId;
          set({
            activeProject: project,
            projectSettings: null,
            projectSettingsStatus: project ? 'loading' : 'idle',
            projectSettingsError: null
          });
          if (project) {
            try {
              const settings = await getOrCreateSettings(project.id);
              if (
                requestId === projectSettingsRequestId &&
                get().activeProject?.id === project.id
              ) {
                set({
                  projectSettings: settings,
                  projectSettingsStatus: 'ready',
                  projectSettingsError: null
                });
              }
            } catch (error) {
              if (
                requestId === projectSettingsRequestId &&
                get().activeProject?.id === project.id
              ) {
                set({
                  projectSettingsStatus: 'error',
                  projectSettingsError:
                    error instanceof Error ? error.message : 'Unable to load project settings'
                });
              }
            }
          }
        },

        setProjectSettings: (settings) =>
          set({
            projectSettings: settings,
            projectSettingsStatus: settings ? 'ready' : 'idle',
            projectSettingsError: null
          }),

        loadProjectSettings: async (projectId) => {
          const requestId = ++projectSettingsRequestId;
          set((state) =>
            state.activeProject?.id === projectId
              ? {projectSettingsStatus: 'loading', projectSettingsError: null}
              : {}
          );
          try {
            const settings = await getOrCreateSettings(projectId);
            set((state) =>
              requestId === projectSettingsRequestId && state.activeProject?.id === projectId
                ? {
                    projectSettings: settings,
                    projectSettingsStatus: 'ready',
                    projectSettingsError: null
                  }
                : {}
            );
            return settings;
          } catch (error) {
            set((state) =>
              requestId === projectSettingsRequestId && state.activeProject?.id === projectId
                ? {
                    projectSettingsStatus: 'error',
                    projectSettingsError:
                      error instanceof Error ? error.message : 'Unable to load project settings'
                  }
                : {}
            );
            throw error;
          }
        },

        saveProjectSettings: async (settings) => {
          await persistProjectSettings(settings);
          set((state) =>
            state.activeProject?.id === settings.projectId
              ? {
                  projectSettings: settings,
                  projectSettingsStatus: 'ready',
                  projectSettingsError: null
                }
              : {}
          );
          return settings;
        },

        setRailCollapsed: (collapsed) => set({isRailCollapsed: collapsed}),
      };
    },
    {
      name: 'wbd-app-shell',
      storage: createJSONStorage(getAppStorage),
      partialize: (state) => ({
        activeProject: state.activeProject,
        isRailCollapsed: state.isRailCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.activeProject) {
          const rehydratedProjectId = state.activeProject.id;
          state.projectSettingsStatus = 'loading';
          state.projectSettingsError = null;
          getOrCreateSettings(rehydratedProjectId)
            .then((settings) => {
              if (useAppStore.getState().activeProject?.id === settings.projectId) {
                useAppStore.setState({
                  projectSettings: settings,
                  projectSettingsStatus: 'ready',
                  projectSettingsError: null
                });
              }
            })
            .catch((error) => {
              if (useAppStore.getState().activeProject?.id === rehydratedProjectId) {
                useAppStore.setState({
                  projectSettingsStatus: 'error',
                  projectSettingsError:
                    error instanceof Error ? error.message : 'Unable to load project settings'
                });
              }
            });
        }
      },
    }
  )
);
