import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {
  ChangeEvent,
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction
} from 'react';
import type {Project, WritingDocument, WorkspaceImportMode} from '../entityTypes';
import {
  deleteWritingDocument,
  saveWritingDocument
} from '../writingStorage';
import {countWords} from '../utils/textHelpers';
import {
  exportScenesAsDocx,
  exportScenesAsEpub,
  exportScenesAsMarkdown
} from '../utils/sceneExport';
import {
  fileNameToTitle,
  fileToHtml,
  parseDocxToText,
  parsePagesToText
} from '../utils/workspaceImport';
import {
  useWorkspaceUiStore,
  type WorkspaceExportFormat,
  type WorkspaceImportFailureItem
} from '../store/workspaceUiStore';
type SaveStatus = 'idle' | 'saving' | 'saved';
type ImportMode = WorkspaceImportMode;

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface UseWorkspaceDocumentsParams {
  activeProject: Project | null;
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
  addSystemHistory: (input: {
    category: 'scene' | 'consistency' | 'resource' | 'quest' | 'system';
    message: string;
    insertText?: string;
    sceneId?: string;
  }) => void;
}

type WorkspaceDocumentInitialization =
  | {type: 'clear'}
  | {type: 'reset-empty'}
  | {type: 'initialize'; document: WritingDocument}
  | {type: 'none'};

export const resolveWorkspaceDocumentInitialization = ({
  hasActiveProject,
  documents,
  selectedId,
  initializedSelectedId
}: {
  hasActiveProject: boolean;
  documents: WritingDocument[];
  selectedId: string | null;
  initializedSelectedId: string | null;
}): WorkspaceDocumentInitialization => {
  if (!hasActiveProject) {
    return {type: 'clear'};
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
  documents,
  setDocuments,
  persistDocRef,
  refreshDeferredReviewRef,
  setGuardrailIssuesRef,
  setConsistencyPopoverRef,
  deleteDocumentSideEffectsRef,
  setFeedback,
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
  const [selectedCreatedAt, setSelectedCreatedAt] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [wordCount, setWordCount] = useState(0);
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
        initializedSelectedIdRef.current = null;
        setSelectedCreatedAt(null);
        setTitle('');
        setContent('');
        setSaveStatus('idle');
        setLastSavedAt(null);
        return;
      }
      setSelectedId(doc.id);
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
  }, [activeProject, documents, initializeEditorState, resetEditor, selectedId]);

  const handleNewDocument = useCallback(async () => {
    if (!activeProject) return;

    setCreatingScene(true);
    setFeedback(null);
    try {
      const now = Date.now();
      const doc: WritingDocument = {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        title: 'Untitled scene',
        content: '<p></p>',
        createdAt: now,
        updatedAt: now
      };

      await saveWritingDocument(doc);

      setDocuments((prev) => [...prev, doc]);
      initializeEditorState(doc);
      setEditorScrollResetToken((prev) => prev + 1);
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
      setWordCount(0);
      setFeedback({tone: 'success', message: 'Created a new scene.'});
      addSystemHistory({
        category: 'scene',
        message: `Created scene "${doc.title}".`,
        insertText: `System Notice: Scene "${doc.title}" was created.`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create scene.';
      setFeedback({tone: 'error', message});
    } finally {
      setCreatingScene(false);
    }
  }, [
    activeProject,
    addSystemHistory,
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

            const raw = lower.endsWith('.docx')
              ? await parseDocxToText(file)
              : lower.endsWith('.pages')
                ? await parsePagesToText(file)
                : await file.text();
            const now = Date.now();
            const doc: WritingDocument = {
              id: crypto.randomUUID(),
              projectId: activeProject.id,
              title: fileNameToTitle(file.name),
              content: fileToHtml(file.name, raw),
              consistencyReviewMode:
                consistencyModeForBatch === 'strict' ? 'default' : 'deferred',
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
          } catch (error) {
            const detail =
              error instanceof Error ? error.message : 'Unknown import error.';
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
        error instanceof Error ? error.message : 'Unable to save scene.';
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
      const confirmed = window.confirm(`Delete "${doc.title || 'Untitled scene'}"?`);
      if (!confirmed) return;

      setDeletingDocumentId(doc.id);
      setFeedback(null);
      try {
        await deleteWritingDocument(doc.id);
        await deleteDocumentSideEffectsRef.current?.(doc.id);
        setDocuments((prev) => prev.filter((entry) => entry.id !== doc.id));

        if (selectedId === doc.id) {
          resetEditor({clearPersistedSelection: true});
        }
        setFeedback({tone: 'success', message: 'Scene deleted.'});
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to delete scene.';
        setFeedback({tone: 'error', message});
      } finally {
        setDeletingDocumentId(null);
      }
    },
    [
      deleteDocumentSideEffectsRef,
      resetEditor,
      selectedId,
      setDeletingDocumentId,
      setDocuments,
      setFeedback
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
        }).catch((error) => {
          const message =
            error instanceof Error ? error.message : 'Unable to save scene.';
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
    [persistDocRef, setFeedback]
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
    selectedDocument,
    importInputRef: importInputRef as RefObject<HTMLInputElement>,
    isImportingDocuments,
    resetEditor,
    initializeEditorState,
    handleNewDocument,
    handleImportDocuments,
    handleRetryFailedImports,
    handleSelectDocument,
    openExportModal,
    handleExportScenes,
    handleSave,
    handleDelete,
    handleContentChange
  };
};
