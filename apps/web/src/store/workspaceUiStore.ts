import type {Dispatch, SetStateAction} from 'react';
import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import type {StateStorage} from 'zustand/middleware';
import type {WorkspaceImportMode} from '../entityTypes';

export type WorkspaceContextDrawerView =
  | 'world-bible'
  | 'ruleset'
  | 'characters'
  | 'compendium'
  | 'review'
  | 'scratchpad'
  | 'ai'
  | 'system'
  | 'lore';

export type WorkspaceExportFormat = 'markdown' | 'docx' | 'epub';

export interface WorkspaceExportItem {
  id: string;
  title: string;
  included: boolean;
}

export interface WorkspaceImportFailureItem {
  fileName: string;
  reason: 'legacy-doc' | 'apple-pages' | 'parse-failed';
  detail?: string;
}

export interface WorkspaceImportSummary {
  importedCount: number;
  failedCount: number;
  unresolvedCount: number;
  mode: WorkspaceImportMode;
  suggestionsSkipped: boolean;
  openedTitle?: string;
  failures: WorkspaceImportFailureItem[];
  createdAt: number;
}

interface WorkspaceDrawerPreferences {
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;
  activeContextView: WorkspaceContextDrawerView;
}

interface WorkspaceUiState {
  currentProjectId: string | null;
  isNarrowViewport: boolean;
  isSceneDrawerOpen: boolean;
  isContextDrawerOpen: boolean;
  activeContextView: WorkspaceContextDrawerView;
  isScratchpadModalOpen: boolean;
  isCorkboardModalOpen: boolean;
  isStatBlockModalOpen: boolean;
  isExportModalOpen: boolean;
  exportFormat: WorkspaceExportFormat;
  exportSelection: WorkspaceExportItem[];
  importMode: WorkspaceImportMode;
  skipImportSuggestions: boolean;
  importSummary: WorkspaceImportSummary | null;
  retryImportFiles: File[];
  isCreatingScene: boolean;
  deletingDocumentId: string | null;
  drawerPreferencesByProjectId: Record<string, WorkspaceDrawerPreferences>;
  selectedDocumentIdByProjectId: Record<string, string | null>;

  setWorkspaceDrawerContext: (projectId: string | null, isNarrowViewport: boolean) => void;
  setSceneDrawerOpen: Dispatch<SetStateAction<boolean>>;
  setContextDrawerOpen: Dispatch<SetStateAction<boolean>>;
  setActiveContextView: (view: WorkspaceContextDrawerView) => void;
  setScratchpadModalOpen: Dispatch<SetStateAction<boolean>>;
  setCorkboardModalOpen: Dispatch<SetStateAction<boolean>>;
  setStatBlockModalOpen: Dispatch<SetStateAction<boolean>>;
  openExportModal: (
    format: WorkspaceExportFormat,
    selection: WorkspaceExportItem[]
  ) => void;
  closeExportModal: () => void;
  moveExportItem: (id: string, direction: -1 | 1) => void;
  toggleExportItem: (id: string) => void;
  toggleAllExportItems: (included: boolean) => void;
  setImportMode: (mode: WorkspaceImportMode) => void;
  setSkipImportSuggestions: (skip: boolean) => void;
  setImportSummary: Dispatch<SetStateAction<WorkspaceImportSummary | null>>;
  setRetryImportFiles: Dispatch<SetStateAction<File[]>>;
  setCreatingScene: (creating: boolean) => void;
  setDeletingDocumentId: (documentId: string | null) => void;
  setSelectedDocumentId: (
    projectId: string | null,
    update: SetStateAction<string | null>
  ) => void;
}

const DEFAULT_DRAWER_PREFERENCES: WorkspaceDrawerPreferences = {
  leftDrawerOpen: false,
  rightDrawerOpen: false,
  activeContextView: 'world-bible'
};

const resolveNextBoolean = (
  update: SetStateAction<boolean>,
  previous: boolean
): boolean => (typeof update === 'function' ? update(previous) : update);

const resolveNextNullableString = (
  update: SetStateAction<string | null>,
  previous: string | null
): string | null => (typeof update === 'function' ? update(previous) : update);

const resolveNextValue = <T>(update: SetStateAction<T>, previous: T): T =>
  typeof update === 'function'
    ? (update as (previous: T) => T)(previous)
    : update;

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined
};

const getStorage = () =>
  typeof window === 'undefined' ? noopStorage : window.localStorage;

const getProjectPreferences = (
  state: Pick<WorkspaceUiState, 'drawerPreferencesByProjectId'>,
  projectId: string | null
): WorkspaceDrawerPreferences => {
  if (!projectId) {
    return DEFAULT_DRAWER_PREFERENCES;
  }
  return state.drawerPreferencesByProjectId[projectId] ?? DEFAULT_DRAWER_PREFERENCES;
};

const buildVisibleDrawerState = (
  preferences: WorkspaceDrawerPreferences,
  isNarrowViewport: boolean
) => ({
  isSceneDrawerOpen: isNarrowViewport ? false : preferences.leftDrawerOpen,
  isContextDrawerOpen: isNarrowViewport ? false : preferences.rightDrawerOpen,
  activeContextView: preferences.activeContextView
});

const persistProjectPreferences = (
  state: WorkspaceUiState,
  patch: Partial<WorkspaceDrawerPreferences>
): Pick<WorkspaceUiState, 'drawerPreferencesByProjectId'> | Record<string, never> => {
  if (!state.currentProjectId) {
    return {};
  }
  const current =
    state.drawerPreferencesByProjectId[state.currentProjectId] ??
    DEFAULT_DRAWER_PREFERENCES;
  return {
    drawerPreferencesByProjectId: {
      ...state.drawerPreferencesByProjectId,
      [state.currentProjectId]: {
        ...current,
        ...patch
      }
    }
  };
};

export const useWorkspaceUiStore = create<WorkspaceUiState>()(
  persist(
    (set) => ({
      currentProjectId: null,
      isNarrowViewport: false,
      isSceneDrawerOpen: false,
      isContextDrawerOpen: false,
      activeContextView: 'world-bible',
      isScratchpadModalOpen: false,
      isCorkboardModalOpen: false,
      isStatBlockModalOpen: false,
      isExportModalOpen: false,
      exportFormat: 'markdown',
      exportSelection: [],
      importMode: 'balanced',
      skipImportSuggestions: false,
      importSummary: null,
      retryImportFiles: [],
      isCreatingScene: false,
      deletingDocumentId: null,
      drawerPreferencesByProjectId: {},
      selectedDocumentIdByProjectId: {},

      setWorkspaceDrawerContext: (projectId, isNarrowViewport) =>
        set((state) => ({
          currentProjectId: projectId,
          isNarrowViewport,
          ...buildVisibleDrawerState(
            getProjectPreferences(state, projectId),
            isNarrowViewport
          )
        })),

      setSceneDrawerOpen: (update) =>
        set((state) => {
          const next = resolveNextBoolean(update, state.isSceneDrawerOpen);
          return {
            isSceneDrawerOpen: next,
            ...(!state.isNarrowViewport
              ? persistProjectPreferences(state, {leftDrawerOpen: next})
              : {})
          };
        }),

      setContextDrawerOpen: (update) =>
        set((state) => {
          const next = resolveNextBoolean(update, state.isContextDrawerOpen);
          return {
            isContextDrawerOpen: next,
            ...(!state.isNarrowViewport
              ? persistProjectPreferences(state, {rightDrawerOpen: next})
              : {})
          };
        }),

      setActiveContextView: (view) =>
        set((state) => ({
          activeContextView: view,
          ...persistProjectPreferences(state, {activeContextView: view})
        })),

      setScratchpadModalOpen: (update) =>
        set((state) => ({
          isScratchpadModalOpen: resolveNextBoolean(
            update,
            state.isScratchpadModalOpen
          )
        })),

      setCorkboardModalOpen: (update) =>
        set((state) => ({
          isCorkboardModalOpen: resolveNextBoolean(
            update,
            state.isCorkboardModalOpen
          )
        })),

      setStatBlockModalOpen: (update) =>
        set((state) => ({
          isStatBlockModalOpen: resolveNextBoolean(
            update,
            state.isStatBlockModalOpen
          )
        })),

      openExportModal: (format, selection) =>
        set({
          isExportModalOpen: true,
          exportFormat: format,
          exportSelection: selection
        }),

      closeExportModal: () => set({isExportModalOpen: false}),

      moveExportItem: (id, direction) =>
        set((state) => {
          const index = state.exportSelection.findIndex((item) => item.id === id);
          if (index < 0) return {};
          const nextIndex = index + direction;
          if (nextIndex < 0 || nextIndex >= state.exportSelection.length) {
            return {};
          }
          const exportSelection = [...state.exportSelection];
          const [item] = exportSelection.splice(index, 1);
          exportSelection.splice(nextIndex, 0, item);
          return {exportSelection};
        }),

      toggleExportItem: (id) =>
        set((state) => ({
          exportSelection: state.exportSelection.map((item) =>
            item.id === id ? {...item, included: !item.included} : item
          )
        })),

      toggleAllExportItems: (included) =>
        set((state) => ({
          exportSelection: state.exportSelection.map((item) => ({
            ...item,
            included
          }))
        })),

      setImportMode: (mode) => set({importMode: mode}),

      setSkipImportSuggestions: (skip) => set({skipImportSuggestions: skip}),

      setImportSummary: (update) =>
        set((state) => ({
          importSummary: resolveNextValue(update, state.importSummary)
        })),

      setRetryImportFiles: (update) =>
        set((state) => ({
          retryImportFiles: resolveNextValue(update, state.retryImportFiles)
        })),

      setCreatingScene: (creating) => set({isCreatingScene: creating}),

      setDeletingDocumentId: (documentId) => set({deletingDocumentId: documentId}),

      setSelectedDocumentId: (projectId, update) =>
        set((state) => {
          if (!projectId) {
            return {};
          }
          const previous = state.selectedDocumentIdByProjectId[projectId] ?? null;
          return {
            selectedDocumentIdByProjectId: {
              ...state.selectedDocumentIdByProjectId,
              [projectId]: resolveNextNullableString(update, previous)
            }
          };
        })
    }),
    {
      name: 'wbd-workspace-ui',
      storage: createJSONStorage(getStorage),
      partialize: (state) => ({
        drawerPreferencesByProjectId: state.drawerPreferencesByProjectId,
        selectedDocumentIdByProjectId: state.selectedDocumentIdByProjectId
      })
    }
  )
);
