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
type SaveStatus = 'idle' | 'saving' | 'saved';
type ExportFormat = 'markdown' | 'docx' | 'epub';
type ImportMode = WorkspaceImportMode;

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface SceneExportItem {
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
  mode: ImportMode;
  suggestionsSkipped: boolean;
  openedTitle?: string;
  failures: WorkspaceImportFailureItem[];
  createdAt: number;
}

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
  const selectionStorageKey = activeProject
    ? `workspaceSelection:${activeProject.id}`
    : null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCreatedAt, setSelectedCreatedAt] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [isCreatingScene, setIsCreatingScene] = useState(false);
  const [isImportingDocuments, setIsImportingDocuments] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('balanced');
  const [skipImportSuggestions, setSkipImportSuggestions] = useState(false);
  const [importSummary, setImportSummary] = useState<WorkspaceImportSummary | null>(null);
  const [retryImportFiles, setRetryImportFiles] = useState<File[]>([]);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [isExportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [exportSelection, setExportSelection] = useState<SceneExportItem[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutosaveErrorRef = useRef<string | null>(null);

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

  const resetEditor = useCallback(() => {
    setSelectedId(null);
    setSelectedCreatedAt(null);
    setTitle('');
    setContent('');
    setSaveStatus('idle');
    setLastSavedAt(null);
  }, []);

  const resolveDocumentConsistencyMode = useCallback(
    (doc: WritingDocument): ImportMode =>
      doc.consistencyReviewMode === 'deferred' ? 'balanced' : 'strict',
    []
  );

  const initializeEditorState = useCallback((doc: WritingDocument | null) => {
    if (!doc) {
      setSelectedId(null);
      setSelectedCreatedAt(null);
      setTitle('');
      setContent('');
      setSaveStatus('idle');
      setLastSavedAt(null);
      return;
    }
    setSelectedId(doc.id);
    setSelectedCreatedAt(doc.createdAt);
    setTitle(doc.title);
    setContent(doc.content);
    setSaveStatus('idle');
    setWordCount(countWords(doc.content));
  }, []);

  useEffect(() => {
    if (!selectionStorageKey) {
      return;
    }
    if (!selectedId) {
      localStorage.removeItem(selectionStorageKey);
      return;
    }
    localStorage.setItem(selectionStorageKey, selectedId);
  }, [selectionStorageKey, selectedId]);

  useEffect(() => {
    if (!activeProject) {
      return;
    }
    if (selectedId) {
      return;
    }
    if (documents.length === 0) {
      return;
    }

    const persistedSelectedId = selectionStorageKey
      ? localStorage.getItem(selectionStorageKey)
      : null;
    const persistedDocument = persistedSelectedId
      ? documents.find((doc) => doc.id === persistedSelectedId) ?? null
      : null;

    if (persistedDocument) {
      initializeEditorState(persistedDocument);
      return;
    }

    initializeEditorState(documents[0]);
  }, [activeProject, documents, initializeEditorState, selectedId, selectionStorageKey]);

  const handleNewDocument = useCallback(async () => {
    if (!activeProject) return;

    setIsCreatingScene(true);
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
      setIsCreatingScene(false);
    }
  }, [activeProject, addSystemHistory, initializeEditorState, setDocuments, setFeedback]);

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
    (format: ExportFormat) => {
      const selection = documents.map((doc) => ({
        id: doc.id,
        title: doc.title || 'Untitled scene',
        included: true
      }));
      setExportSelection(selection);
      setExportFormat(format);
      setExportModalOpen(true);
    },
    [documents]
  );

  const closeExportModal = useCallback(() => {
    setExportModalOpen(false);
  }, []);

  const moveExportItem = useCallback((id: string, direction: -1 | 1) => {
    setExportSelection((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }, []);

  const toggleExportItem = useCallback((id: string) => {
    setExportSelection((prev) =>
      prev.map((item) =>
        item.id === id ? {...item, included: !item.included} : item
      )
    );
  }, []);

  const toggleAllExportItems = useCallback((included: boolean) => {
    setExportSelection((prev) => prev.map((item) => ({...item, included})));
  }, []);

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

    setExportModalOpen(false);
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
  }, [activeProject, addSystemHistory, documents, exportFormat, exportSelection, setFeedback]);

  const handleSave = useCallback(async () => {
    if (!activeProject || !selectedId) return;
    const existingDocument = documents.find((doc) => doc.id === selectedId);
    const nextTitle = title.trim() || 'Untitled scene';
    if (
      existingDocument &&
      existingDocument.title === nextTitle &&
      existingDocument.content === content
    ) {
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
      setFeedback({tone: 'success', message: 'Scene already saved.'});
      return;
    }

    const now = Date.now();
    const createdAt = selectedCreatedAt ?? now;
    const doc: WritingDocument = {
      id: selectedId,
      projectId: activeProject.id,
      title: nextTitle,
      content,
      consistencyReviewMode: existingDocument?.consistencyReviewMode ?? 'default',
      createdAt,
      updatedAt: now
    };

    setSaveStatus('saving');
    setFeedback(null);
    try {
      const save = persistDocRef.current;
      if (!save) {
        throw new Error('Workspace consistency service unavailable.');
      }
      await save(doc, {
        source: 'workspace-save',
        consistencyMode: resolveDocumentConsistencyMode(doc)
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
    resolveDocumentConsistencyMode,
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
          resetEditor();
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

  useEffect(() => {
    if (!activeProject || !selectedId) return;
    const existingDocument = documents.find((doc) => doc.id === selectedId);
    const nextTitle = title.trim() || 'Untitled scene';
    if (
      existingDocument &&
      existingDocument.title === nextTitle &&
      existingDocument.content === content
    ) {
      return;
    }

    const now = Date.now();
    const createdAt = selectedCreatedAt ?? now;
    const doc: WritingDocument = {
      id: selectedId,
      projectId: activeProject.id,
      title: nextTitle,
      content,
      consistencyReviewMode: existingDocument?.consistencyReviewMode ?? 'default',
      createdAt,
      updatedAt: now
    };

    const timeoutId = window.setTimeout(() => {
      setSaveStatus('saving');
      const save = persistDocRef.current;
      if (!save) {
        return;
      }
      void save(doc, {
        source: 'workspace-autosave',
        consistencyMode:
          doc.consistencyReviewMode === 'deferred' ? 'balanced' : 'lenient'
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
  }, [
    activeProject,
    content,
    documents,
    persistDocRef,
    resolveDocumentConsistencyMode,
    selectedCreatedAt,
    selectedId,
    setFeedback,
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
    selectedDocument,
    importInputRef: importInputRef as RefObject<HTMLInputElement>,
    isCreatingScene,
    isImportingDocuments,
    importMode,
    setImportMode,
    skipImportSuggestions,
    setSkipImportSuggestions,
    importSummary,
    setImportSummary,
    retryImportFiles,
    setRetryImportFiles,
    deletingDocumentId,
    isExportModalOpen,
    exportFormat,
    exportSelection,
    resetEditor,
    initializeEditorState,
    handleNewDocument,
    handleImportDocuments,
    handleRetryFailedImports,
    handleSelectDocument,
    openExportModal,
    closeExportModal,
    moveExportItem,
    toggleExportItem,
    toggleAllExportItems,
    handleExportScenes,
    handleSave,
    handleDelete,
    handleContentChange
  };
};
