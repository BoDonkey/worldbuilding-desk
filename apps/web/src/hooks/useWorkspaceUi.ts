import {useShallow} from 'zustand/react/shallow';
import {useWorkspaceUiStore} from '../store/workspaceUiStore';

export const useWorkspaceModalUi = () =>
  useWorkspaceUiStore(
    useShallow((state) => ({
      isScratchpadModalOpen: state.isScratchpadModalOpen,
      setScratchpadModalOpen: state.setScratchpadModalOpen,
      isCorkboardModalOpen: state.isCorkboardModalOpen,
      setCorkboardModalOpen: state.setCorkboardModalOpen,
      isStatBlockModalOpen: state.isStatBlockModalOpen,
      setStatBlockModalOpen: state.setStatBlockModalOpen
    }))
  );

export const useWorkspaceExportUi = () =>
  useWorkspaceUiStore(
    useShallow((state) => ({
      isExportModalOpen: state.isExportModalOpen,
      exportFormat: state.exportFormat,
      exportSelection: state.exportSelection,
      closeExportModal: state.closeExportModal,
      moveExportItem: state.moveExportItem,
      toggleExportItem: state.toggleExportItem,
      toggleAllExportItems: state.toggleAllExportItems
    }))
  );

export const useWorkspaceImportUi = () =>
  useWorkspaceUiStore(
    useShallow((state) => ({
      importMode: state.importMode,
      setImportMode: state.setImportMode,
      skipImportSuggestions: state.skipImportSuggestions,
      setSkipImportSuggestions: state.setSkipImportSuggestions,
      importSummary: state.importSummary,
      setImportSummary: state.setImportSummary,
      retryImportFiles: state.retryImportFiles,
      setRetryImportFiles: state.setRetryImportFiles
    }))
  );

export const useWorkspaceSceneOperationUi = () =>
  useWorkspaceUiStore(
    useShallow((state) => ({
      isCreatingScene: state.isCreatingScene,
      deletingDocumentId: state.deletingDocumentId
    }))
  );
