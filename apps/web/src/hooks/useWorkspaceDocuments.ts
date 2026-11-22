import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {
  ChangeEvent,
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction
} from 'react';
import type {Project, SceneSnapshot, WritingDocument, WorkspaceImportMode} from '../entityTypes';
import {
  deleteWritingDocument,
  getNextWritingDocumentOrder,
  getStateMutationEventsByProject,
  sortWritingDocuments,
  saveWritingDocument
} from '../services/storage';
import {
  countAcceptedSceneStateChanges,
  loadStateMutationEventsInSceneOrder,
  removeDeletedSceneStateChanges
} from '../services/state/stateSceneOrder';
import {countWords} from '../utils/textHelpers';
import {
  exportScenesAsDocx,
  exportScenesAsEpub,
  exportScenesAsMarkdown
} from '../utils/sceneExport';
import {
  fileNameToTitle,
  fileToHtml,
  parsePagesToText
} from '../utils/workspaceImport';
import {parseDocxFile} from '../services/worldBible/docxImport';
import {
  useWorkspaceUiStore,
  type WorkspaceExportFormat,
  type WorkspaceImportFailureItem
} from '../store/workspaceUiStore';
import type {ConfirmRequest} from './useConfirmDialog';
import {describeError} from '../services/errors';
import {takeSnapshotBeforeSceneDeletion} from '../services/editor/sceneSnapshots';
import {useStatusAnnouncement} from './useStatusAnnouncement';
export type SaveStatus = 'idle' | 'saving' | 'saved';
type ImportMode = WorkspaceImportMode;

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface UseWorkspaceDocumentsParams {
  activeProject: Project | null;
  documentsLoaded: boolean;
  documents: WritingDocument[];
  setDocuments: Dispatch<SetStateAction<WritingDocument[]>>;
  persistDocRef: MutableRefObject<
    | ((
        doc: WritingDocument,
        options?: {
          source?: 'workspace-save' | 'workspace-autosave' | 'import';
          consistencyMode?: ImportMode;
        }
      ) => Promise<{unresolvedCount: number; consistencyRun: boolean}>)
    | null
  >;
  refreshDeferredReviewRef: MutableRefObject<((doc: WritingDocument) => Promise<void>) | null>;
  setGuardrailIssuesRef: MutableRefObject<Dispatch<SetStateAction<unknown[]>> | null>;
  setConsistencyPopoverRef: MutableRefObject<Dispatch<SetStateAction<unknown>> | null>;
  deleteDocumentSideEffectsRef: MutableRefObject<((docId: string) => Promise<void>) | null>;
  setFeedback: Dispatch<SetStateAction<FeedbackState>>;
  requestConfirm: (request: ConfirmRequest) => void;
  addSystemHistory: (input: {
    category: 'scene' | 'consistency' | 'resource' | 'quest' | 'system';
    message: string;
    insertText?: string;
    sceneId?: string;
  }) => void;
}

/** The delete confirm's message; says what happens to the scene's state changes. */
export const describeSceneDeletion = (acceptedStateChangeCount: number, hasText = true): string => {
  // Slice 4.96: the text is kept as a snapshot and can be restored from Drafts.
  const base = hasText
    ? 'This scene will be removed from the project. Its text is kept as a snapshot, ' +
      'so Drafts → Deleted scenes can bring it back.'
    : 'This empty scene will be removed from the project.';
  if (acceptedStateChangeCount === 0) return base;
  const changes =
    acceptedStateChangeCount === 1
      ? '1 accepted state change'
      : `${acceptedStateChangeCount} accepted state changes`;
  return `${base} It holds ${changes} (positions, items, or stats). ` +
    'They will be invalidated, so later scenes no longer include them, and restoring the scene ' +
    'does not bring them back.';
};

type WorkspaceDocumentInitialization =
  | {type: 'clear'}
  | {type: 'reset-empty'}
  | {type: 'initialize'; document: WritingDocument}
  | {type: 'none'};

export const resolveWorkspaceDocumentInitialization = ({
  hasActiveProject,
  documentsLoaded,
  documents,
  selectedId,
  initializedSelectedId
}: {
  hasActiveProject: boolean;
  documentsLoaded: boolean;
  documents: WritingDocument[];
  selectedId: string | null;
  initializedSelectedId: string | null;
}): WorkspaceDocumentInitialization => {
  if (!hasActiveProject) {
    return {type: 'clear'};
  }

  if (!documentsLoaded) {
    return {type: 'none'};
  }

  if (documents.length === 0) {
    return {type: 'reset-empty'};
  }

  const selectedDocument = selectedId
    ? documents.find((doc) => doc.id === selectedId) ?? null
    : null;
  const nextDocument = selectedDocument ?? documents[0];

  if (
    selectedId === nextDocument.id &&
    initializedSelectedId === nextDocument.id
  ) {
    return {type: 'none'};
  }

  return {type: 'initialize', document: nextDocument};
};

export const buildWorkspaceEditorDocument = ({
  projectId,
  selectedId,
  selectedCreatedAt,
  title,
  content,
  existingDocument,
  now
}: {
  projectId: string;
  selectedId: string;
  selectedCreatedAt: number | null;
  title: string;
  content: string;
  existingDocument: WritingDocument | null;
  now: number;
}): WritingDocument => ({
  id: selectedId,
  projectId,
  title: title.trim() || 'Untitled scene',
  content,
  consistencyReviewMode: existingDocument?.consistencyReviewMode ?? 'default',
  order: existingDocument?.order,
  createdAt: selectedCreatedAt ?? now,
  updatedAt: now
});

export const hasWorkspaceDocumentChanges = (
  existingDocument: WritingDocument | null,
  nextDocument: WritingDocument
): boolean =>
  !existingDocument ||
  existingDocument.title !== nextDocument.title ||
  existingDocument.content !== nextDocument.content;

export const getWorkspaceManualSaveConsistencyMode = (
  doc: Pick<WritingDocument, 'consistencyReviewMode'>
): ImportMode => (doc.consistencyReviewMode === 'deferred' ? 'balanced' : 'strict');

export const getWorkspaceAutosaveConsistencyMode = (
  doc: Pick<WritingDocument, 'consistencyReviewMode'>
): ImportMode => (doc.consistencyReviewMode === 'deferred' ? 'balanced' : 'lenient');

export const useWorkspaceDocuments = ({
  activeProject,
  documentsLoaded,
  documents,
  setDocuments,
  persistDocRef,
  refreshDeferredReviewRef,
  setGuardrailIssuesRef,
  setConsistencyPopoverRef,
  deleteDocumentSideEffectsRef,
  setFeedback,
  requestConfirm,
  addSystemHistory
}: UseWorkspaceDocumentsParams) => {
  const selectedId = useWorkspaceUiStore((state) =>
    activeProject ? state.selectedDocumentIdByProjectId[activeProject.id] ?? null : null
  );
  const setStoreSelectedDocumentId = useWorkspaceUiStore(
    (state) => state.setSelectedDocumentId
  );
  const exportFormat = useWorkspaceUiStore((state) => state.exportFormat);
  const exportSelection = useWorkspaceUiStore((state) => state.exportSelection);
  const openStoreExportModal = useWorkspaceUiStore((state) => state.openExportModal);
  const closeStoreExportModal = useWorkspaceUiStore((state) => state.closeExportModal);
  const importMode = useWorkspaceUiStore((state) => state.importMode);
  const skipImportSuggestions = useWorkspaceUiStore(
    (state) => state.skipImportSuggestions
  );
  const retryImportFiles = useWorkspaceUiStore((state) => state.retryImportFiles);
  const setImportSummary = useWorkspaceUiStore((state) => state.setImportSummary);
  const setRetryImportFiles = useWorkspaceUiStore(
    (state) => state.setRetryImportFiles
  );
  const setCreatingScene = useWorkspaceUiStore((state) => state.setCreatingScene);
  const setDeletingDocumentId = useWorkspaceUiStore(
    (state) => state.setDeletingDocumentId
  );
  const setSelectedId = useCallback(
    (update: SetStateAction<string | null>) => {
      setStoreSelectedDocumentId(activeProject?.id ?? null, update);
    },
    [activeProject?.id, setStoreSelectedDocumentId]
  );
  const announceStatus = useStatusAnnouncement();
  const [selectedCreatedAt, setSelectedCreatedAt] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [initializedDocumentId, setInitializedDocumentId] = useState<string | null>(
    null
  );
  const [editorScrollResetToken, setEditorScrollResetToken] = useState(0);
  const [isImportingDocuments, setIsImportingDocuments] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutosaveErrorRef = useRef<string | null>(null);
  const initializedSelectedIdRef = useRef<string | null>(null);

  const clearGuardrailIssues = useCallback(() => {
    setGuardrailIssuesRef.current?.([]);
  }, [setGuardrailIssuesRef]);

  const closeConsistencyPopover = useCallback(() => {
    setConsistencyPopoverRef.current?.(null);
  }, [setConsistencyPopoverRef]);

  const selectedDocument = useMemo(
    () => (selectedId ? documents.find((doc) => doc.id === selectedId) ?? null : null),
    [documents, selectedId]
  );

  const resetEditor = useCallback((options?: {clearPersistedSelection?: boolean}) => {
    setSelectedId(null);
    setInitializedDocumentId(null);
    if (options?.clearPersistedSelection) {
      initializedSelectedIdRef.current = null;
    }
    setSelectedCreatedAt(null);
    setTitle('');
    setContent('');
    setSaveStatus('idle');
    setLastSavedAt(null);
  }, [setSelectedId]);

  const initializeEditorState = useCallback(
    (doc: WritingDocument | null) => {
      if (!doc) {
        setSelectedId(null);
        setInitializedDocumentId(null);
        initializedSelectedIdRef.current = null;
        setSelectedCreatedAt(null);
        setTitle('');
        setContent('');
        setSaveStatus('idle');
        setLastSavedAt(null);
        return;
      }
      setSelectedId(doc.id);
      setInitializedDocumentId(doc.id);
      initializedSelectedIdRef.current = doc.id;
      setSelectedCreatedAt(doc.createdAt);
      setTitle(doc.title);
      setContent(doc.content);
      setSaveStatus('idle');
      setWordCount(countWords(doc.content));
    },
    [setSelectedId]
  );

  useEffect(() => {
    const initialization = resolveWorkspaceDocumentInitialization({
      hasActiveProject: Boolean(activeProject),
      documentsLoaded,
      documents,
      selectedId,
      initializedSelectedId: initializedSelectedIdRef.current
    });

    if (initialization.type === 'clear') {
      initializeEditorState(null);
    } else if (initialization.type === 'reset-empty') {
      resetEditor({clearPersistedSelection: true});
    } else if (initialization.type === 'initialize') {
      initializeEditorState(initialization.document);
    }
  }, [
    activeProject,
    documents,
    documentsLoaded,
    initializeEditorState,
    resetEditor,
    selectedId
  ]);

  const handleNewDocument = useCallback(async (
    options?: {title?: string; select?: boolean; id?: string; content?: string}
  ): Promise<WritingDocument | null> => {
    if (!activeProject) return null;

    setCreatingScene(true);
    setFeedback(null);
    try {
      const now = Date.now();
      const doc: WritingDocument = {
        id: options?.id ?? crypto.randomUUID(),
        projectId: activeProject.id,
        title: options?.title?.trim() || 'Untitled scene',
        content: options?.content ?? '<p></p>',
        order: getNextWritingDocumentOrder(documents),
        createdAt: now,
        updatedAt: now
      };

      await saveWritingDocument(doc);

      setDocuments((prev) => sortWritingDocuments([...prev, doc]));
      if (options?.select !== false) {
        initializeEditorState(doc);
        setEditorScrollResetToken((prev) => prev + 1);
        setSaveStatus('saved');
        setLastSavedAt(Date.now());
        setWordCount(countWords(doc.content));
      }
      if (!options?.title) {
        setFeedback({tone: 'success', message: 'Created a new scene.'});
      }
      addSystemHistory({
        category: 'scene',
        message: `Created scene "${doc.title}".`,
        insertText: `System Notice: Scene "${doc.title}" was created.`
      });
      return doc;
    } catch (error) {
      const message =
        describeError(error, 'Unable to create scene.');
      setFeedback({tone: 'error', message});
      return null;
    } finally {
      setCreatingScene(false);
    }
  }, [
    activeProject,
    addSystemHistory,
    documents,
    initializeEditorState,
    setCreatingScene,
    setDocuments,
    setFeedback
  ]);

  const runImportBatch = useCallback(
    async (files: File[]) => {
      if (!activeProject || files.length === 0) return;
      setIsImportingDocuments(true);
      setFeedback(null);
      setImportSummary(null);
      let importedCount = 0;
      let failedCount = 0;
      let unresolvedCount = 0;
      let nextOrder = getNextWritingDocumentOrder(documents);
      let lastImported: WritingDocument | null = null;
      const failures: WorkspaceImportFailureItem[] = [];
      const failedFiles: File[] = [];
      const consistencyModeForBatch: ImportMode = skipImportSuggestions
        ? 'lenient'
        : importMode;

      try {
        for (const file of files) {
          const lower = file.name.toLowerCase();
          try {
            if (lower.endsWith('.doc')) {
              failedCount += 1;
              failures.push({fileName: file.name, reason: 'legacy-doc'});
              continue;
            }

            // DOCX keeps its headings, read the same way as World Bible and Source Note import.
            const content = lower.endsWith('.docx')
              ? (await parseDocxFile(file)).html
              : fileToHtml(
                  file.name,
                  lower.endsWith('.pages') ? await parsePagesToText(file) : await file.text()
                );
            const now = Date.now();
            const doc: WritingDocument = {
              id: crypto.randomUUID(),
              projectId: activeProject.id,
              title: fileNameToTitle(file.name),
              content,
              consistencyReviewMode:
                consistencyModeForBatch === 'strict' ? 'default' : 'deferred',
              order: nextOrder,
              createdAt: now,
              updatedAt: now
            };
            const result = await persistDocRef.current?.(doc, {
              source: 'import',
              consistencyMode: consistencyModeForBatch
            });
            if (!result) {
              throw new Error('Workspace consistency service unavailable.');
            }
            importedCount += 1;
            unresolvedCount += result.unresolvedCount;
            lastImported = doc;
            nextOrder += 1;
          } catch (error) {
            const detail =
              describeError(error, 'Unknown import error.');
            failedCount += 1;
            failedFiles.push(file);
            failures.push({
              fileName: file.name,
              reason: lower.endsWith('.pages') ? 'apple-pages' : 'parse-failed',
              detail
            });
          }
        }

        if (lastImported) {
          initializeEditorState(lastImported);
          setEditorScrollResetToken((prev) => prev + 1);
        }

        setImportSummary({
          importedCount,
          failedCount,
          unresolvedCount,
          mode: consistencyModeForBatch,
          suggestionsSkipped: consistencyModeForBatch === 'lenient',
          openedTitle: lastImported?.title,
          failures,
          createdAt: Date.now()
        });
        setRetryImportFiles(failedFiles);

        if (failedCount > 0) {
          const pageFailureCount = failures.filter(
            (item) => item.reason === 'apple-pages'
          ).length;
          setFeedback({
            tone: 'error',
            message:
              `Imported ${importedCount} document(s); ${failedCount} failed. ` +
              (pageFailureCount > 0
                ? 'For Apple Pages files, export as .docx or .txt from Pages, then import.'
                : failures[0]?.detail ??
                  'Legacy .doc files are not supported yet. Convert to .docx, .txt, or .md.')
          });
        } else {
          setFeedback({
            tone: 'success',
            message:
              consistencyModeForBatch === 'lenient'
                ? `Imported ${importedCount} document(s). Consistency suggestions skipped for this import.`
                : `Imported ${importedCount} document(s). Unresolved entities: ${unresolvedCount}.`
          });
        }
      } finally {
        setIsImportingDocuments(false);
      }
    },
    [
      activeProject,
      documents,
      importMode,
      initializeEditorState,
      persistDocRef,
      setFeedback,
      setImportSummary,
      setRetryImportFiles,
      skipImportSuggestions
    ]
  );

  const handleImportDocuments = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files;
      if (!fileList || fileList.length === 0) return;
      await runImportBatch(Array.from(fileList));
      event.target.value = '';
    },
    [runImportBatch]
  );

  const handleRetryFailedImports = useCallback(async () => {
    if (retryImportFiles.length === 0) return;
    await runImportBatch(retryImportFiles);
  }, [retryImportFiles, runImportBatch]);

  const handleSelectDocument = useCallback(
    (doc: WritingDocument) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wbd:capture-workspace-scroll'));
      }
      initializeEditorState(doc);
      closeConsistencyPopover();
      if (doc.consistencyReviewMode === 'deferred') {
        void refreshDeferredReviewRef.current?.(doc).catch((error) => {
          console.warn('Deferred review refresh failed', error);
        });
      } else {
        clearGuardrailIssues();
      }
    },
    [
      clearGuardrailIssues,
      closeConsistencyPopover,
      initializeEditorState,
      refreshDeferredReviewRef
    ]
  );

  const handleMoveDocument = useCallback(
    async (doc: WritingDocument, direction: -1 | 1) => {
      const orderedDocuments = sortWritingDocuments(documents);
      const currentIndex = orderedDocuments.findIndex((entry) => entry.id === doc.id);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedDocuments.length) {
        return;
      }

      const normalizedDocuments = orderedDocuments.map((entry, index) => ({
        ...entry,
        order: index
      }));
      const reorderedDocuments = [...normalizedDocuments];
      const [movedDocument] = reorderedDocuments.splice(currentIndex, 1);
      reorderedDocuments.splice(nextIndex, 0, movedDocument);
      const nextDocuments = reorderedDocuments.map((entry, index) => ({
        ...entry,
        order: index,
        updatedAt: entry.id === movedDocument.id ? Date.now() : entry.updatedAt
      }));
      const changedDocuments = nextDocuments.filter((entry) => {
        const previous = documents.find((candidate) => candidate.id === entry.id);
        return previous?.order !== entry.order || previous?.updatedAt !== entry.updatedAt;
      });

      setDocuments(nextDocuments);
      setFeedback(null);
      try {
        await Promise.all(changedDocuments.map((entry) => saveWritingDocument(entry)));
        if (activeProject) {
          // State changes carry their scene's place; renumber them to match.
          await loadStateMutationEventsInSceneOrder(activeProject.id, nextDocuments);
        }
        setFeedback({tone: 'success', message: 'Scene order updated.'});
      } catch (error) {
        setDocuments(documents);
        const message =
          describeError(error, 'Unable to reorder scenes.');
        setFeedback({tone: 'error', message});
      }
    },
    [activeProject, documents, setDocuments, setFeedback]
  );

  const openExportModal = useCallback(
    (format: WorkspaceExportFormat) => {
      const selection = documents.map((doc) => ({
        id: doc.id,
        title: doc.title || 'Untitled scene',
        included: true
      }));
      openStoreExportModal(format, selection);
    },
    [documents, openStoreExportModal]
  );

  const handleExportScenes = useCallback(() => {
    if (!activeProject) return;

    const selectedIds = exportSelection
      .filter((item) => item.included)
      .map((item) => item.id);
    const selectedScenes = selectedIds
      .map((id) => documents.find((doc) => doc.id === id))
      .filter((doc): doc is WritingDocument => Boolean(doc));

    if (selectedScenes.length === 0) {
      setFeedback({tone: 'error', message: 'Select at least one scene to export.'});
      return;
    }

    if (exportFormat === 'markdown') {
      exportScenesAsMarkdown({projectName: activeProject.name, scenes: selectedScenes});
    } else if (exportFormat === 'docx') {
      exportScenesAsDocx({projectName: activeProject.name, scenes: selectedScenes});
    } else {
      exportScenesAsEpub({projectName: activeProject.name, scenes: selectedScenes});
    }

    closeStoreExportModal();
    const exportMessage =
      exportFormat === 'markdown'
        ? `Exported ${selectedScenes.length} scene(s) to Markdown.`
        : exportFormat === 'docx'
          ? `Exported ${selectedScenes.length} scene(s) to DOCX.`
          : `Exported ${selectedScenes.length} scene(s) to EPUB.`;
    setFeedback({tone: 'success', message: exportMessage});
    addSystemHistory({
      category: 'system',
      message: exportMessage,
      insertText: `System Export: ${exportMessage}`
    });
  }, [
    activeProject,
    addSystemHistory,
    closeStoreExportModal,
    documents,
    exportFormat,
    exportSelection,
    setFeedback
  ]);

  const handleSave = useCallback(async () => {
    if (!activeProject || !selectedId) return;
    const existingDocument = documents.find((doc) => doc.id === selectedId);
    const now = Date.now();
    const doc = buildWorkspaceEditorDocument({
      projectId: activeProject.id,
      selectedId,
      selectedCreatedAt,
      title,
      content,
      existingDocument: existingDocument ?? null,
      now
    });
    if (!hasWorkspaceDocumentChanges(existingDocument ?? null, doc)) {
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
      setFeedback({tone: 'success', message: 'Scene already saved.'});
      return;
    }

    setSaveStatus('saving');
    setFeedback(null);
    try {
      const save = persistDocRef.current;
      if (!save) {
        throw new Error('Workspace consistency service unavailable.');
      }
      await save(doc, {
        source: 'workspace-save',
        consistencyMode: getWorkspaceManualSaveConsistencyMode(doc)
      });
      setFeedback({tone: 'success', message: 'Scene saved.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to save scene.');
      setSaveStatus('idle');
      setFeedback({tone: 'error', message});
    }
  }, [
    activeProject,
    content,
    documents,
    persistDocRef,
    selectedCreatedAt,
    selectedId,
    setFeedback,
    title
  ]);

  const handleDelete = useCallback(
    async (doc: WritingDocument) => {
      const stateChangeCount = activeProject
        ? countAcceptedSceneStateChanges(
            await getStateMutationEventsByProject(activeProject.id).catch(() => []),
            doc.id
          )
        : 0;
      requestConfirm({
        title: `Delete "${doc.title || 'Untitled scene'}"?`,
        message: describeSceneDeletion(
          stateChangeCount,
          countWords(doc.id === selectedId ? content : doc.content) > 0
        ),
        confirmLabel: 'Delete',
        variant: 'danger',
        onConfirm: async () => {
          setDeletingDocumentId(doc.id);
          setFeedback(null);
          try {
            if (activeProject) {
              // The open scene's text can be ahead of its last save.
              await takeSnapshotBeforeSceneDeletion({
                projectId: activeProject.id,
                sceneId: doc.id,
                sceneTitle: doc.id === selectedId ? title : doc.title,
                content: doc.id === selectedId ? content : doc.content
              });
            }
            await deleteWritingDocument(doc.id);
            await deleteDocumentSideEffectsRef.current?.(doc.id);
            if (activeProject) {
              // Its snapshots are kept (author decision 2026-11-22; reachable in 4.96).
              await removeDeletedSceneStateChanges({
                projectId: activeProject.id,
                sceneId: doc.id,
                remainingDocuments: documents.filter((entry) => entry.id !== doc.id)
              });
            }
            setDocuments((prev) => prev.filter((entry) => entry.id !== doc.id));

            if (selectedId === doc.id) {
              resetEditor({clearPersistedSelection: true});
            }
            setFeedback({tone: 'success', message: 'Scene deleted.'});
          } catch (error) {
            const message =
              describeError(error, 'Unable to delete scene.');
            setFeedback({tone: 'error', message});
          } finally {
            setDeletingDocumentId(null);
          }
        }
      });
    },
    [
      activeProject,
      content,
      deleteDocumentSideEffectsRef,
      documents,
      requestConfirm,
      resetEditor,
      selectedId,
      setDeletingDocumentId,
      setDocuments,
      setFeedback,
      title
    ]
  );

  const handleContentChange = useCallback(
    (html: string) => {
      setContent(html);
      setSaveStatus('idle');
      clearGuardrailIssues();
      closeConsistencyPopover();
      setWordCount(countWords(html));
    },
    [clearGuardrailIssues, closeConsistencyPopover]
  );

  /**
   * Slice 4.96: recreates a deleted scene under its old id (so its snapshots
   * belong to it again) at the end of the manuscript with the snapshot's
   * text, then saves it as Save now does, so it is indexed and reviewed.
   */
  const handleRestoreDeletedScene = useCallback(
    async (snapshot: SceneSnapshot): Promise<WritingDocument | null> => {
      if (documents.some((doc) => doc.id === snapshot.sceneId)) {
        setFeedback({tone: 'error', message: 'That scene has not been deleted.'});
        return null;
      }
      const title = snapshot.sceneTitle?.trim() || 'Restored scene';
      const doc = await handleNewDocument({title, id: snapshot.sceneId, content: snapshot.content});
      if (!doc) return null;
      try {
        await persistDocRef.current?.(doc, {source: 'workspace-save'});
      } catch (error) {
        console.error('Unable to index the restored scene.', error);
      }
      setFeedback({tone: 'success', message: `Restored "${title}" from its snapshot.`});
      return doc;
    },
    [documents, handleNewDocument, persistDocRef, setFeedback]
  );

  const scheduleAutosave = useCallback(
    (doc: WritingDocument) => {
      const timeoutId = window.setTimeout(() => {
        setSaveStatus('saving');
        const save = persistDocRef.current;
        if (!save) {
          return;
        }
        void save(doc, {
          source: 'workspace-autosave',
          consistencyMode: getWorkspaceAutosaveConsistencyMode(doc)
        })
          .then(() => {
            announceStatus('Scene autosaved.');
          })
          .catch((error) => {
          const message =
            describeError(error, 'Unable to save scene.');
          setSaveStatus('idle');
          if (lastAutosaveErrorRef.current !== message) {
            lastAutosaveErrorRef.current = message;
            setFeedback({tone: 'error', message});
          }
        });
      }, 800);

      return () => {
        clearTimeout(timeoutId);
      };
    },
    [announceStatus, persistDocRef, setFeedback]
  );

  useEffect(() => {
    if (!activeProject || !selectedId) return;
    const existingDocument = documents.find((doc) => doc.id === selectedId);
    const now = Date.now();
    const doc = buildWorkspaceEditorDocument({
      projectId: activeProject.id,
      selectedId,
      selectedCreatedAt,
      title,
      content,
      existingDocument: existingDocument ?? null,
      now
    });
    if (!hasWorkspaceDocumentChanges(existingDocument ?? null, doc)) {
      return;
    }

    return scheduleAutosave(doc);
  }, [
    activeProject,
    content,
    documents,
    scheduleAutosave,
    selectedCreatedAt,
    selectedId,
    title
  ]);

  return {
    selectedId,
    setSelectedId,
    selectedCreatedAt,
    setSelectedCreatedAt,
    title,
    setTitle,
    content,
    setContent,
    saveStatus,
    setSaveStatus,
    lastSavedAt,
    setLastSavedAt,
    wordCount,
    setWordCount,
    editorScrollResetToken,
    isSelectedDocumentInitialized:
      selectedId !== null && initializedDocumentId === selectedId,
    selectedDocument,
    importInputRef: importInputRef as RefObject<HTMLInputElement>,
    isImportingDocuments,
    resetEditor,
    initializeEditorState,
    handleNewDocument,
    handleImportDocuments,
    handleRetryFailedImports,
    handleSelectDocument,
    handleMoveDocument,
    openExportModal,
    handleExportScenes,
    handleSave,
    handleDelete,
    handleContentChange,
    handleRestoreDeletedScene
  };
};
