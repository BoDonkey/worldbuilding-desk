import {beforeEach, describe, expect, it} from 'vitest';
import {useWorkspaceUiStore} from './workspaceUiStore';

describe('useWorkspaceUiStore', () => {
  beforeEach(() => {
    useWorkspaceUiStore.setState(useWorkspaceUiStore.getInitialState(), true);
  });

  it('keeps drawer preferences scoped by project', () => {
    const store = useWorkspaceUiStore.getState();

    store.setWorkspaceDrawerContext('alpha', false);
    useWorkspaceUiStore.getState().setSceneDrawerOpen(true);
    useWorkspaceUiStore.getState().setActiveContextView('review');

    useWorkspaceUiStore.getState().setWorkspaceDrawerContext('beta', false);
    expect(useWorkspaceUiStore.getState().isSceneDrawerOpen).toBe(false);
    expect(useWorkspaceUiStore.getState().activeContextView).toBe('world-bible');

    useWorkspaceUiStore.getState().setWorkspaceDrawerContext('alpha', false);
    expect(useWorkspaceUiStore.getState().isSceneDrawerOpen).toBe(true);
    expect(useWorkspaceUiStore.getState().activeContextView).toBe('review');
  });

  it('does not overwrite desktop drawer preferences while in a narrow viewport', () => {
    const store = useWorkspaceUiStore.getState();

    store.setWorkspaceDrawerContext('alpha', false);
    useWorkspaceUiStore.getState().setSceneDrawerOpen(true);
    useWorkspaceUiStore.getState().setContextDrawerOpen(true);

    useWorkspaceUiStore.getState().setWorkspaceDrawerContext('alpha', true);
    expect(useWorkspaceUiStore.getState().isSceneDrawerOpen).toBe(false);
    expect(useWorkspaceUiStore.getState().isContextDrawerOpen).toBe(false);

    useWorkspaceUiStore.getState().setSceneDrawerOpen(false);
    useWorkspaceUiStore.getState().setContextDrawerOpen(false);

    useWorkspaceUiStore.getState().setWorkspaceDrawerContext('alpha', false);
    expect(useWorkspaceUiStore.getState().isSceneDrawerOpen).toBe(true);
    expect(useWorkspaceUiStore.getState().isContextDrawerOpen).toBe(true);
  });

  it('keeps selected document IDs scoped by project', () => {
    const store = useWorkspaceUiStore.getState();

    store.setSelectedDocumentId('alpha', 'scene-a');
    store.setSelectedDocumentId('beta', 'scene-b');

    expect(useWorkspaceUiStore.getState().selectedDocumentIdByProjectId.alpha).toBe(
      'scene-a'
    );
    expect(useWorkspaceUiStore.getState().selectedDocumentIdByProjectId.beta).toBe(
      'scene-b'
    );

    useWorkspaceUiStore
      .getState()
      .setSelectedDocumentId('alpha', (previous) =>
        previous === 'scene-a' ? 'scene-c' : previous
      );

    expect(useWorkspaceUiStore.getState().selectedDocumentIdByProjectId.alpha).toBe(
      'scene-c'
    );
    expect(useWorkspaceUiStore.getState().selectedDocumentIdByProjectId.beta).toBe(
      'scene-b'
    );
  });

  it('tracks workspace modal visibility without persisting it', () => {
    const store = useWorkspaceUiStore.getState();

    store.setScratchpadModalOpen(true);
    store.setCorkboardModalOpen((previous) => !previous);
    store.setStatBlockModalOpen(true);

    const state = useWorkspaceUiStore.getState();
    expect(state.isScratchpadModalOpen).toBe(true);
    expect(state.isCorkboardModalOpen).toBe(true);
    expect(state.isStatBlockModalOpen).toBe(true);
    expect(
      Object.keys(
        useWorkspaceUiStore.persist.getOptions().partialize?.(state) ?? {}
      )
    ).not.toContain('isScratchpadModalOpen');
  });

  it('keeps export modal state transient and editable', () => {
    const store = useWorkspaceUiStore.getState();

    store.openExportModal('docx', [
      {id: 'scene-a', title: 'Scene A', included: true},
      {id: 'scene-b', title: 'Scene B', included: true}
    ]);
    useWorkspaceUiStore.getState().moveExportItem('scene-b', -1);
    useWorkspaceUiStore.getState().toggleExportItem('scene-a');

    let state = useWorkspaceUiStore.getState();
    expect(state.isExportModalOpen).toBe(true);
    expect(state.exportFormat).toBe('docx');
    expect(state.exportSelection.map((item) => item.id)).toEqual([
      'scene-b',
      'scene-a'
    ]);
    expect(
      state.exportSelection.find((item) => item.id === 'scene-a')?.included
    ).toBe(false);

    useWorkspaceUiStore.getState().toggleAllExportItems(false);
    useWorkspaceUiStore.getState().closeExportModal();

    state = useWorkspaceUiStore.getState();
    expect(state.isExportModalOpen).toBe(false);
    expect(state.exportSelection.every((item) => !item.included)).toBe(true);
    expect(
      Object.keys(
        useWorkspaceUiStore.persist.getOptions().partialize?.(state) ?? {}
      )
    ).not.toContain('exportSelection');
  });

  it('keeps import UI state transient while allowing summary dismissal', () => {
    const store = useWorkspaceUiStore.getState();
    const retryFile = new File(['draft'], 'draft.pages');

    store.setImportMode('strict');
    store.setSkipImportSuggestions(true);
    store.setImportSummary({
      importedCount: 1,
      failedCount: 1,
      unresolvedCount: 2,
      mode: 'lenient',
      suggestionsSkipped: true,
      openedTitle: 'Imported Scene',
      failures: [
        {
          fileName: 'draft.pages',
          reason: 'apple-pages',
          detail: 'Unsupported Pages file.'
        }
      ],
      createdAt: 123
    });
    store.setRetryImportFiles([retryFile]);

    let state = useWorkspaceUiStore.getState();
    expect(state.importMode).toBe('strict');
    expect(state.skipImportSuggestions).toBe(true);
    expect(state.importSummary?.openedTitle).toBe('Imported Scene');
    expect(state.retryImportFiles).toEqual([retryFile]);

    useWorkspaceUiStore.getState().setImportSummary(null);
    useWorkspaceUiStore.getState().setRetryImportFiles([]);

    state = useWorkspaceUiStore.getState();
    expect(state.importSummary).toBeNull();
    expect(state.retryImportFiles).toEqual([]);
    expect(
      Object.keys(
        useWorkspaceUiStore.persist.getOptions().partialize?.(state) ?? {}
      )
    ).not.toContain('importSummary');
  });

  it('tracks scene operation state without persisting it', () => {
    const store = useWorkspaceUiStore.getState();

    store.setCreatingScene(true);
    store.setDeletingDocumentId('scene-a');

    let state = useWorkspaceUiStore.getState();
    expect(state.isCreatingScene).toBe(true);
    expect(state.deletingDocumentId).toBe('scene-a');

    store.setCreatingScene(false);
    store.setDeletingDocumentId(null);

    state = useWorkspaceUiStore.getState();
    expect(state.isCreatingScene).toBe(false);
    expect(state.deletingDocumentId).toBeNull();
    expect(
      Object.keys(
        useWorkspaceUiStore.persist.getOptions().partialize?.(state) ?? {}
      )
    ).not.toContain('deletingDocumentId');
  });
});
