import {useEffect, useState, useCallback, useRef} from 'react';
import type {ChangeEvent} from 'react';
import type {Project, ProjectSettings, WritingDocument} from '../entityTypes';
import {
  getDocumentsByProject,
  saveWritingDocument,
  deleteWritingDocument
} from '../writingStorage';
import {getEntitiesByProject} from '../entityStorage';
import {getCharactersByProject} from '../characterStorage';
import {getOrCreateSettings} from '../settingsStorage';
import {createEditorConfigWithStyles} from '../config/editorConfig';
import type {EditorConfig} from '../config/editorConfig';
import {countWords} from '../utils/textHelpers';
import {exportScenesAsDocx, exportScenesAsMarkdown} from '../utils/sceneExport';
import {EditorWithAI} from '../components/Editor/EditorWithAI';
import {ShodhMemoryPanel} from '../components/ShodhMemoryPanel';
import type {RAGProvider} from '../services/rag/RAGService';
import {getRAGService} from '../services/rag/getRAGService';
import type {
  ShodhMemoryProvider,
  MemoryEntry
} from '../services/shodh/ShodhMemoryService';
import {getShodhService} from '../services/shodh/getShodhService';
import {emitShodhMemoriesUpdated} from '../services/shodh/shodhEvents';
import {
  getSeriesBibleConfig,
  promoteMemoryToParent,
  promoteDocumentToParent,
  getCanonSyncState,
  syncChildWithParent
} from '../services/seriesBible/SeriesBibleService';

const summarizeContent = (html: string, limit = 500): string => {
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, limit);
};

interface WorkspaceRouteProps {
  activeProject: Project | null;
}

type SaveStatus = 'idle' | 'saving' | 'saved';
type FeedbackTone = 'success' | 'error';
type ExportFormat = 'markdown' | 'docx';

interface SceneExportItem {
  id: string;
  title: string;
  included: boolean;
}

function WorkspaceRoute({activeProject}: WorkspaceRouteProps) {
  const [documents, setDocuments] = useState<WritingDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCreatedAt, setSelectedCreatedAt] = useState<number | null>(
    null
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [editorConfig, setEditorConfig] = useState<EditorConfig | null>(null);
  const [toolbarButtons, setToolbarButtons] = useState<
    Array<{id: string; label: string; markName: string}>
  >([]);
  const [projectSettings, setProjectSettings] =
    useState<ProjectSettings | null>(null);
  const [ragService, setRagService] = useState<RAGProvider | null>(null);
  const [shodhService, setShodhService] =
    useState<ShodhMemoryProvider | null>(null);
  const [isMemoryModalOpen, setMemoryModalOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoryScope, setMemoryScope] = useState<'document' | 'project'>(
    'document'
  );
  const [memoryFilter, setMemoryFilter] = useState('');
  const MEMORIES_PER_PAGE = 5;
  const seriesBibleConfig = activeProject
    ? getSeriesBibleConfig(activeProject)
    : null;
  const [canonState, setCanonState] = useState<{
    parentCanonVersion?: string;
    childLastSynced?: string;
    parentName?: string;
  }>({});
  const [feedback, setFeedback] = useState<{
    tone: FeedbackTone;
    message: string;
  } | null>(null);
  const [isCreatingScene, setIsCreatingScene] = useState(false);
  const [isImportingDocuments, setIsImportingDocuments] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [isPromotingDocument, setIsPromotingDocument] = useState(false);
  const [isPromotingMemoryId, setIsPromotingMemoryId] = useState<string | null>(null);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [isSyncingCanon, setIsSyncingCanon] = useState(false);
  const [isExportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [exportSelection, setExportSelection] = useState<SceneExportItem[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const fileNameToTitle = (name: string): string => {
    const base = name.replace(/\.[^.]+$/, '').trim();
    return base || 'Imported scene';
  };

  const plainTextToHtml = (text: string): string => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const paragraphs = escaped
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
    if (paragraphs.length === 0) {
      return '<p></p>';
    }
    return paragraphs.map((chunk) => `<p>${chunk.replace(/\n/g, '<br />')}</p>`).join('');
  };

  const fileToHtml = (fileName: string, rawContent: string): string => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.html') || lower.endsWith('.htm')) {
      return rawContent.trim() || '<p></p>';
    }
    return plainTextToHtml(rawContent);
  };

  const readU16LE = (bytes: Uint8Array, offset: number): number =>
    bytes[offset] | (bytes[offset + 1] << 8);

  const readU32LE = (bytes: Uint8Array, offset: number): number =>
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>> 0;

  const findDocxDocumentEntry = (
    bytes: Uint8Array
  ): {
    compressionMethod: number;
    compressedData: Uint8Array;
  } | null => {
    const eocdSignature = 0x06054b50;
    const centralSignature = 0x02014b50;
    const localSignature = 0x04034b50;

    const minEocdSize = 22;
    const maxCommentLength = 0xffff;
    const searchStart = Math.max(0, bytes.length - (minEocdSize + maxCommentLength));
    let eocdOffset = -1;
    for (let i = bytes.length - minEocdSize; i >= searchStart; i -= 1) {
      if (readU32LE(bytes, i) === eocdSignature) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) return null;

    const centralDirectorySize = readU32LE(bytes, eocdOffset + 12);
    const centralDirectoryOffset = readU32LE(bytes, eocdOffset + 16);
    const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
    if (centralDirectoryEnd > bytes.length) return null;

    const decoder = new TextDecoder('utf-8');
    let cursor = centralDirectoryOffset;

    while (cursor + 46 <= centralDirectoryEnd) {
      if (readU32LE(bytes, cursor) !== centralSignature) {
        break;
      }
      const compressionMethod = readU16LE(bytes, cursor + 10);
      const compressedSize = readU32LE(bytes, cursor + 20);
      const fileNameLength = readU16LE(bytes, cursor + 28);
      const extraLength = readU16LE(bytes, cursor + 30);
      const commentLength = readU16LE(bytes, cursor + 32);
      const localHeaderOffset = readU32LE(bytes, cursor + 42);
      const fileNameStart = cursor + 46;
      const fileNameEnd = fileNameStart + fileNameLength;
      if (fileNameEnd > bytes.length) return null;

      const fileName = decoder.decode(bytes.slice(fileNameStart, fileNameEnd));
      cursor = fileNameEnd + extraLength + commentLength;

      if (fileName !== 'word/document.xml') continue;
      if (localHeaderOffset + 30 > bytes.length) return null;
      if (readU32LE(bytes, localHeaderOffset) !== localSignature) return null;

      const localNameLength = readU16LE(bytes, localHeaderOffset + 26);
      const localExtraLength = readU16LE(bytes, localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > bytes.length) return null;

      return {
        compressionMethod,
        compressedData: bytes.slice(dataStart, dataEnd)
      };
    }

    return null;
  };

  const inflateRaw = async (compressedData: Uint8Array): Promise<Uint8Array> => {
    const copy = new Uint8Array(compressedData.byteLength);
    copy.set(compressedData);
    const stream = new Blob([copy.buffer]).stream().pipeThrough(
      new DecompressionStream('deflate-raw')
    );
    const decompressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(decompressed);
  };

  const docxXmlToText = (xml: string): string => {
    const withBreaks = xml
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:br\b[^>]*\/>/g, '\n')
      .replace(/<w:cr\b[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n\n');
    const withoutTags = withBreaks.replace(/<[^>]+>/g, '');
    const parser = new DOMParser();
    const decoded = parser.parseFromString(
      `<!doctype html><body>${withoutTags}`,
      'text/html'
    ).body.textContent;
    return decoded?.trim() ?? '';
  };

  const parseDocxToText = async (file: File): Promise<string> => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entry = findDocxDocumentEntry(bytes);
    if (!entry) {
      throw new Error('Could not read DOCX structure.');
    }

    let xmlBytes: Uint8Array;
    if (entry.compressionMethod === 0) {
      xmlBytes = entry.compressedData;
    } else if (entry.compressionMethod === 8) {
      xmlBytes = await inflateRaw(entry.compressedData);
    } else {
      throw new Error(`Unsupported DOCX compression method (${entry.compressionMethod}).`);
    }

    const xml = new TextDecoder('utf-8').decode(xmlBytes);
    return docxXmlToText(xml);
  };
  const refreshMemories = useCallback(async () => {
    if (!shodhService) {
      setMemories([]);
      emitShodhMemoriesUpdated([]);
      return;
    }
    const list = await shodhService.listMemories();
    const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
    setMemories(sorted);
    emitShodhMemoriesUpdated(sorted);
  }, [shodhService]);

  // Load documents and settings when project changes
  useEffect(() => {
    if (!activeProject) {
      setEditorConfig(null);
      setToolbarButtons([]);
      setProjectSettings(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const [docs, settings] = await Promise.all([
        getDocumentsByProject(activeProject.id),
        getOrCreateSettings(activeProject.id)
      ]);

      if (cancelled) return;

      setDocuments(docs);
      setEditorConfig(createEditorConfigWithStyles(settings.characterStyles));
      setProjectSettings(settings);

      // Generate toolbar buttons from character styles
      const buttons = settings.characterStyles.map((style) => ({
        id: style.id,
        label: style.name,
        markName: style.markName
      }));
      setToolbarButtons(buttons);

      if (docs.length > 0) {
        const first = docs[0];
        setSelectedId(first.id);
        setSelectedCreatedAt(first.createdAt);
        setTitle(first.title);
        setContent(first.content);
        setSaveStatus('idle');
      } else {
        setSelectedId(null);
        setSelectedCreatedAt(null);
        setTitle('');
        setContent('');
        setSaveStatus('idle');
        setLastSavedAt(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    let cancelled = false;
    if (!activeProject || !seriesBibleConfig?.parentProjectId) {
      setCanonState({});
      return;
    }
    getCanonSyncState(activeProject).then((state) => {
      if (!cancelled) {
        setCanonState(state);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject, seriesBibleConfig?.parentProjectId]);

  useEffect(() => {
    if (!activeProject) {
      setRagService(null);
      setShodhService(null);
      return;
    }

    const bibleConfig = getSeriesBibleConfig(activeProject);
    const ragOptions =
      bibleConfig.parentProjectId && bibleConfig.inheritRag
        ? {
            projectId: activeProject.id,
            inheritFromParent: true,
            parentProjectId: bibleConfig.parentProjectId
          }
        : {projectId: activeProject.id};
    const shodhOptions =
      bibleConfig.parentProjectId && bibleConfig.inheritShodh
        ? {
            projectId: activeProject.id,
            inheritFromParent: true,
            parentProjectId: bibleConfig.parentProjectId
          }
        : {projectId: activeProject.id};

    let cancelled = false;

    getRAGService(ragOptions).then((service) => {
      if (!cancelled) {
        setRagService(service);
      }
    });

    getShodhService(shodhOptions).then((service) => {
      if (!cancelled) {
        setShodhService(service);
      }
    });

    return () => {
      cancelled = true;
      setRagService(null);
      setShodhService(null);
    };
  }, [activeProject]);

  useEffect(() => {
    void refreshMemories();
  }, [refreshMemories]);

  useEffect(() => {
    if (!activeProject || !ragService) {
      return;
    }

    let cancelled = false;

    Promise.all([
      getEntitiesByProject(activeProject.id),
      getCharactersByProject(activeProject.id)
    ]).then(([entities, characters]) => {
      if (cancelled) return;

      const vocabulary = [
        ...entities.map((entity) => ({
          id: entity.id,
          terms: [
            entity.name,
            ...Object.values(entity.fields)
              .filter((value): value is string => typeof value === 'string')
          ]
        })),
        ...characters.map((character) => ({
          id: character.id,
          terms: [
            character.name,
            character.fields?.role ?? '',
            character.fields?.notes ?? ''
          ].filter(Boolean) as string[]
        }))
      ];

      ragService.setEntityVocabulary(vocabulary);
    });

    return () => {
      cancelled = true;
    };
  }, [activeProject, ragService]);

  const resetEditor = () => {
    setSelectedId(null);
    setSelectedCreatedAt(null);
    setTitle('');
    setContent('');
    setSaveStatus('idle');
    setLastSavedAt(null);
  };

  const persistDoc = useCallback(async (doc: WritingDocument) => {
    await saveWritingDocument(doc);

    // Index for RAG
    if (ragService) {
      await ragService.indexDocument(
        doc.id,
        doc.title || 'Untitled scene',
        doc.content,
        'scene'
      );
    }
    if (shodhService) {
      await shodhService.captureAutoMemory({
        projectId: doc.projectId,
        documentId: doc.id,
        title: doc.title || 'Untitled scene',
        content: doc.content,
        tags: ['scene']
      });
      await refreshMemories();
    }

    setDocuments((prev) => {
      const index = prev.findIndex((d) => d.id === doc.id);
      if (index === -1) {
        return [...prev, doc];
      }
      const copy = [...prev];
      copy[index] = doc;
      return copy;
    });

    setSelectedCreatedAt(doc.createdAt);
    setSaveStatus('saved');
    setLastSavedAt(Date.now());
  }, [ragService, shodhService, refreshMemories]);

  const handleNewDocument = async () => {
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
      setSelectedId(doc.id);
      setSelectedCreatedAt(doc.createdAt);
      setTitle(doc.title);
      setContent(doc.content);
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
      setWordCount(0);
      setFeedback({tone: 'success', message: 'Created a new scene.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create scene.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsCreatingScene(false);
    }
  };

  const handleImportDocuments = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!activeProject) return;
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsImportingDocuments(true);
    setFeedback(null);
    let importedCount = 0;
    let failedCount = 0;
    let lastImported: WritingDocument | null = null;

    try {
      const files = Array.from(fileList);
      for (const file of files) {
        const lower = file.name.toLowerCase();
        try {
          if (lower.endsWith('.doc')) {
            failedCount += 1;
            continue;
          }

          const raw = lower.endsWith('.docx')
            ? await parseDocxToText(file)
            : await file.text();
          const now = Date.now();
          const doc: WritingDocument = {
            id: crypto.randomUUID(),
            projectId: activeProject.id,
            title: fileNameToTitle(file.name),
            content: fileToHtml(file.name, raw),
            createdAt: now,
            updatedAt: now
          };
          await persistDoc(doc);
          importedCount += 1;
          lastImported = doc;
        } catch {
          failedCount += 1;
        }
      }

      if (lastImported) {
        setSelectedId(lastImported.id);
        setSelectedCreatedAt(lastImported.createdAt);
        setTitle(lastImported.title);
        setContent(lastImported.content);
        setWordCount(countWords(lastImported.content));
      }

      if (failedCount > 0) {
        setFeedback({
          tone: 'error',
          message:
            `Imported ${importedCount} document(s); ${failedCount} failed. ` +
            'Legacy .doc files are not supported yet. Convert to .docx, .txt, or .md.'
        });
      } else {
        setFeedback({
          tone: 'success',
          message: `Imported ${importedCount} document(s).`
        });
      }
    } finally {
      setIsImportingDocuments(false);
      event.target.value = '';
    }
  };

  const handleSelectDocument = (doc: WritingDocument) => {
    setSelectedId(doc.id);
    setSelectedCreatedAt(doc.createdAt);
    setTitle(doc.title);
    setContent(doc.content);
    setSaveStatus('idle');
    setWordCount(countWords(doc.content));
  };

  const openExportModal = (format: ExportFormat) => {
    const selection = documents.map((doc) => ({
      id: doc.id,
      title: doc.title || 'Untitled scene',
      included: true
    }));
    setExportSelection(selection);
    setExportFormat(format);
    setExportModalOpen(true);
  };

  const closeExportModal = () => {
    setExportModalOpen(false);
  };

  const moveExportItem = (id: string, direction: -1 | 1) => {
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
  };

  const toggleExportItem = (id: string) => {
    setExportSelection((prev) =>
      prev.map((item) =>
        item.id === id ? {...item, included: !item.included} : item
      )
    );
  };

  const toggleAllExportItems = (included: boolean) => {
    setExportSelection((prev) => prev.map((item) => ({...item, included})));
  };

  const handleExportScenes = () => {
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
      exportScenesAsMarkdown({
        projectName: activeProject.name,
        scenes: selectedScenes
      });
    } else {
      exportScenesAsDocx({
        projectName: activeProject.name,
        scenes: selectedScenes
      });
    }

    setExportModalOpen(false);
    setFeedback({
      tone: 'success',
      message:
        exportFormat === 'markdown'
          ? `Exported ${selectedScenes.length} scene(s) to Markdown.`
          : `Exported ${selectedScenes.length} scene(s) to DOCX.`
    });
  };

  const handleSave = async () => {
    if (!activeProject || !selectedId) return;

    const now = Date.now();
    const createdAt = selectedCreatedAt ?? now;

    const doc: WritingDocument = {
      id: selectedId,
      projectId: activeProject.id,
      title: title.trim() || 'Untitled scene',
      content,
      createdAt,
      updatedAt: now
    };

    setSaveStatus('saving');
    setFeedback(null);
    try {
      await persistDoc(doc);
      setFeedback({tone: 'success', message: 'Scene saved.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save scene.';
      setSaveStatus('idle');
      setFeedback({tone: 'error', message});
    }
  };

  const handleDelete = async (doc: WritingDocument) => {
    const confirmed = window.confirm(`Delete "${doc.title || 'Untitled scene'}"?`);
    if (!confirmed) return;

    setDeletingDocumentId(doc.id);
    setFeedback(null);
    try {
      await deleteWritingDocument(doc.id);
      await Promise.all([
        ragService?.deleteDocument(doc.id) ?? Promise.resolve(),
        shodhService?.deleteMemoriesForDocument(doc.id) ?? Promise.resolve()
      ]);
      await refreshMemories();
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));

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
  };

  const handleContentChange = (html: string) => {
    setContent(html);
    setSaveStatus('idle');
    setWordCount(countWords(html));
  };

  const selectedDocument = selectedId
    ? documents.find((doc) => doc.id === selectedId)
    : null;
  const selectedDocumentMemories = selectedId
    ? memories.filter((memory) => memory.documentId === selectedId)
    : [];
  const memoryCandidates =
    memoryScope === 'document' ? selectedDocumentMemories : memories;
  const scopeLabel =
    memoryScope === 'document' ? 'this scene' : 'the project';
  const emptyMemoryMessage =
    memoryScope === 'document'
      ? 'No memories captured for this scene yet.'
      : 'Project memories will appear here as you capture them.';

  const openMemoryModal = () => {
    if (!selectedDocument) return;
    setMemoryDraft(summarizeContent(selectedDocument.content));
    setMemoryModalOpen(true);
  };

  const handleMemorySave = async () => {
    if (!selectedDocument || !shodhService || !memoryDraft.trim()) {
      setMemoryModalOpen(false);
      return;
    }

    setIsSavingMemory(true);
    setFeedback(null);
    try {
      await shodhService.addMemory({
        projectId: selectedDocument.projectId,
        documentId: selectedDocument.id,
        title: selectedDocument.title || 'Untitled scene',
        summary: memoryDraft.trim(),
        tags: ['scene', 'manual']
      });

      await refreshMemories();
      setMemoryModalOpen(false);
      setFeedback({tone: 'success', message: 'Memory saved.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save memory.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSavingMemory(false);
    }
  };

  const handleDeleteMemory = useCallback(
    async (memoryId: string) => {
      if (!shodhService) return;
      await shodhService.deleteMemory(memoryId);
      await refreshMemories();
    },
    [shodhService, refreshMemories]
  );

  const handlePromoteMemory = useCallback(
    async (memory: MemoryEntry) => {
      if (!seriesBibleConfig?.parentProjectId) return;
      setIsPromotingMemoryId(memory.id);
      setFeedback(null);
      try {
        await promoteMemoryToParent(memory, seriesBibleConfig.parentProjectId);
        await refreshMemories();
        setFeedback({tone: 'success', message: 'Memory promoted to parent canon.'});
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to promote memory.';
        setFeedback({tone: 'error', message});
      } finally {
        setIsPromotingMemoryId(null);
      }
    },
    [seriesBibleConfig?.parentProjectId, refreshMemories]
  );

  const handlePromoteDocument = useCallback(async () => {
    if (
      !seriesBibleConfig?.parentProjectId ||
      !selectedDocument
    ) {
      return;
    }
    setIsPromotingDocument(true);
    setFeedback(null);
    try {
      await promoteDocumentToParent({
        parentProjectId: seriesBibleConfig.parentProjectId,
        documentId: selectedDocument.id,
        title: selectedDocument.title || 'Untitled scene',
        content: selectedDocument.content,
        type: 'scene',
        tags: ['scene']
      });
      setFeedback({tone: 'success', message: 'Scene promoted to parent canon.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to promote scene.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsPromotingDocument(false);
    }
  }, [seriesBibleConfig?.parentProjectId, selectedDocument]);

  const handleCanonSync = useCallback(async () => {
    if (!activeProject) return;
    setIsSyncingCanon(true);
    setFeedback(null);
    try {
      const updated = await syncChildWithParent(activeProject.id);
      if (updated) {
        setCanonState((prev) => ({
          ...prev,
          childLastSynced: updated.lastSyncedCanon
        }));
      }
      setFeedback({tone: 'success', message: 'Canon sync state updated.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to mark canon as synced.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSyncingCanon(false);
    }
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject || !selectedId) return;

    const now = Date.now();
    const createdAt = selectedCreatedAt ?? now;

    const doc: WritingDocument = {
      id: selectedId,
      projectId: activeProject.id,
      title: title.trim() || 'Untitled scene',
      content,
      createdAt,
      updatedAt: now
    };

    const timeoutId = window.setTimeout(() => {
      setSaveStatus('saving');
      void persistDoc(doc);
    }, 800);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [title, content, selectedId, activeProject, selectedCreatedAt, persistDoc]);

  if (!activeProject) {
    return (
      <section>
        <h1>Writing Workspace</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  if (!editorConfig) {
    return (
      <section>
        <h1>Writing Workspace</h1>
        <p>Loading editor...</p>
      </section>
    );
  }

  return (
    <section>
      <h1>Writing Workspace</h1>
      {feedback && (
        <p
          role='status'
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            border: `1px solid ${
              feedback.tone === 'error' ? '#fecaca' : '#bbf7d0'
            }`,
            backgroundColor:
              feedback.tone === 'error' ? '#fef2f2' : '#f0fdf4',
            color: feedback.tone === 'error' ? '#991b1b' : '#166534'
          }}
        >
          {feedback.message}
        </p>
      )}
      {seriesBibleConfig?.parentProjectId && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            backgroundColor: '#f8fafc',
            fontSize: '0.9rem'
          }}
        >
          <strong>Parent canon:</strong>{' '}
          {canonState.parentName ?? 'Unknown'} · Version{' '}
          {canonState.parentCanonVersion ?? 'n/a'}
          {canonState.parentCanonVersion &&
            canonState.childLastSynced &&
            canonState.parentCanonVersion !== canonState.childLastSynced && (
              <span style={{color: '#dc2626', marginLeft: '0.5rem'}}>
                Out of sync
              </span>
            )}
          <div style={{marginTop: '0.5rem', display: 'flex', gap: '0.75rem'}}>
            <span>
              Last synced:{' '}
              {canonState.childLastSynced ?? 'never'}
            </span>
            <button
              type='button'
              onClick={() => void handleCanonSync()}
              disabled={isSyncingCanon}
            >
              {isSyncingCanon ? 'Marking...' : 'Mark as synced'}
            </button>
          </div>
        </div>
      )}

      <div style={{display: 'flex', gap: '1.5rem', alignItems: 'stretch'}}>
        <aside
          style={{
            width: '260px',
            borderRight: '1px solid #ccc',
            paddingRight: '1rem'
          }}
        >
          <div style={{marginBottom: '1rem'}}>
            <button
              type='button'
              onClick={handleNewDocument}
              disabled={isCreatingScene}
            >
              {isCreatingScene ? 'Creating...' : '+ New Scene'}
            </button>
            <button
              type='button'
              onClick={() => importInputRef.current?.click()}
              disabled={isImportingDocuments}
              style={{marginLeft: '0.5rem'}}
            >
              {isImportingDocuments ? 'Importing...' : 'Import'}
            </button>
            <button
              type='button'
              onClick={() => openExportModal('markdown')}
              disabled={documents.length === 0}
              style={{marginLeft: '0.5rem'}}
            >
              Export MD
            </button>
            <button
              type='button'
              onClick={() => openExportModal('docx')}
              disabled={documents.length === 0}
              style={{marginLeft: '0.5rem'}}
            >
              Export DOCX
            </button>
            <input
              ref={importInputRef}
              type='file'
              accept='.txt,.md,.markdown,.html,.htm,.docx,.doc,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
              multiple
              onChange={(e) => void handleImportDocuments(e)}
              style={{display: 'none'}}
            />
          </div>

          {documents.length === 0 && (
            <p style={{fontStyle: 'italic'}}>
              No scenes yet. Create one to start writing.
            </p>
          )}

          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {documents.map((doc) => (
              <li
                key={doc.id}
                style={{
                  marginBottom: '0.5rem',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  backgroundColor:
                    doc.id === selectedId ? '#eee' : 'transparent',
                  cursor: 'pointer'
                }}
              >
                <div
                  onClick={() => handleSelectDocument(doc)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '160px'
                    }}
                  >
                    {doc.title || 'Untitled scene'}
                  </span>
                </div>
                <button
                  type='button'
                  onClick={() => handleDelete(doc)}
                  disabled={deletingDocumentId === doc.id}
                  style={{marginTop: '0.25rem', fontSize: '0.8rem'}}
                >
                  {deletingDocumentId === doc.id ? 'Deleting...' : 'Delete'}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
          {selectedId ? (
            <>
              <div style={{marginBottom: '0.75rem'}}>
                <label>
                  Title
                  <br />
                  <input
                    type='text'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{width: '100%'}}
                  />
                </label>
              </div>

              <div
                style={{
                  marginBottom: '0.75rem',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <label
                  style={{flex: 1, display: 'flex', flexDirection: 'column'}}
                >
                  Scene Text
                </label>
                <br />
                <EditorWithAI
                  projectId={activeProject.id}
                  documentId={selectedId}
                  content={content}
                  onChange={handleContentChange}
                  config={editorConfig}
                  toolbarButtons={toolbarButtons}
                  aiSettings={projectSettings?.aiSettings}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}
              >
                <button
                  type='button'
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                >
                  Save now
                </button>
                {seriesBibleConfig?.parentProjectId && (
                  <button
                    type='button'
                    onClick={() => void handlePromoteDocument()}
                    disabled={isPromotingDocument}
                  >
                    {isPromotingDocument
                      ? 'Promoting...'
                      : 'Promote scene to parent'}
                  </button>
                )}
                <button type='button' onClick={openMemoryModal}>
                  Extract memory
                </button>
                <span style={{fontSize: '0.85rem', fontStyle: 'italic'}}>
                  {saveStatus === 'saving' && 'Saving…'}
                  {saveStatus === 'saved' && lastSavedAt && (
                    <>Saved at {new Date(lastSavedAt).toLocaleTimeString()}</>
                  )}
                  {saveStatus === 'idle' && 'No recent changes'}
                  {' · '}
                  {wordCount} words
                </span>
              </div>

              <ShodhMemoryPanel
                title='Canon memories'
                memories={memoryCandidates}
                filterValue={memoryFilter}
                onFilterChange={setMemoryFilter}
                scopeSelector={{
                  label: 'Scope',
                  value: memoryScope,
                  options: [
                    {value: 'document', label: 'This scene'},
                    {value: 'project', label: 'All project'}
                  ],
                  onChange: (value) =>
                    setMemoryScope(value as 'document' | 'project')
                }}
                scopeSummaryLabel={scopeLabel}
                highlightDocumentId={selectedId}
                onRefresh={() => void refreshMemories()}
                pageSize={MEMORIES_PER_PAGE}
                showDelete
                onDeleteMemory={(id) => {
                  void handleDeleteMemory(id);
                }}
                emptyState={emptyMemoryMessage}
                renderSourceLabel={(memory) =>
                  memory.projectId === activeProject.id ? 'Local' : 'Parent'
                }
                renderMemoryActions={(memory) => {
                  if (
                    seriesBibleConfig?.parentProjectId &&
                    memory.projectId === activeProject.id
                  ) {
                    return (
                      <button
                        type='button'
                        onClick={() => void handlePromoteMemory(memory)}
                        disabled={isPromotingMemoryId === memory.id}
                        style={{fontSize: '0.8rem'}}
                      >
                        {isPromotingMemoryId === memory.id
                          ? 'Promoting...'
                          : 'Promote'}
                      </button>
                    );
                  }
                  return null;
                }}
              />
            </>
          ) : (
            <p>Select a scene from the left, or create one with + New Scene.</p>
          )}
        </div>
      </div>

      {isExportModalOpen && (
        <div
          role='dialog'
          aria-modal='true'
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '1.25rem',
              borderRadius: '8px',
              width: 'min(680px, 94vw)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <h3 style={{margin: 0}}>
              Export scenes as {exportFormat === 'markdown' ? 'Markdown' : 'DOCX'}
            </h3>
            <p style={{margin: 0}}>
              Choose which scenes to export and adjust their order for the final file.
            </p>
            <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
              <button type='button' onClick={() => toggleAllExportItems(true)}>
                Select all
              </button>
              <button type='button' onClick={() => toggleAllExportItems(false)}>
                Clear all
              </button>
            </div>
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '0.5rem',
                overflowY: 'auto',
                maxHeight: '42vh'
              }}
            >
              {exportSelection.length === 0 ? (
                <p style={{margin: '0.25rem 0', fontStyle: 'italic'}}>
                  No scenes available to export.
                </p>
              ) : (
                <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
                  {exportSelection.map((item, index) => (
                    <li
                      key={item.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '0.5rem',
                        alignItems: 'center',
                        padding: '0.35rem 0'
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <input
                          type='checkbox'
                          checked={item.included}
                          onChange={() => toggleExportItem(item.id)}
                        />
                        <span style={{fontSize: '0.95rem'}}>
                          {index + 1}. {item.title}
                        </span>
                      </label>
                      <div style={{display: 'flex', gap: '0.25rem'}}>
                        <button
                          type='button'
                          onClick={() => moveExportItem(item.id, -1)}
                          disabled={index === 0}
                          style={{fontSize: '0.8rem'}}
                        >
                          Up
                        </button>
                        <button
                          type='button'
                          onClick={() => moveExportItem(item.id, 1)}
                          disabled={index === exportSelection.length - 1}
                          style={{fontSize: '0.8rem'}}
                        >
                          Down
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem'
              }}
            >
              <button
                type='button'
                onClick={closeExportModal}
                style={{background: 'transparent'}}
              >
                Cancel
              </button>
              <button type='button' onClick={handleExportScenes}>
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {isMemoryModalOpen && selectedDocument && (
        <div
          role='dialog'
          aria-modal='true'
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              width: 'min(520px, 90vw)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <h3 style={{margin: 0}}>Capture Shodh memory</h3>
            <p style={{margin: 0}}>
              Review or edit the summary before adding it to the project
              canon.
            </p>
            <textarea
              value={memoryDraft}
              onChange={(e) => setMemoryDraft(e.target.value)}
              rows={6}
              style={{width: '100%'}}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem'
              }}
            >
              <button
                type='button'
                onClick={() => setMemoryModalOpen(false)}
                disabled={isSavingMemory}
                style={{background: 'transparent'}}
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleMemorySave}
                disabled={isSavingMemory || !memoryDraft.trim()}
              >
                {isSavingMemory ? 'Saving...' : 'Save memory'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default WorkspaceRoute;
