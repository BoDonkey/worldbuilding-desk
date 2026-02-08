import {useEffect, useState, useCallback} from 'react';
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
import {EditorWithAI} from '../components/Editor/EditorWithAI';
import {ShodhMemoryPanel} from '../components/ShodhMemoryPanel';
import type {RAGService} from '../services/rag/RAGService';
import {getRAGService} from '../services/rag/getRAGService';
import type {
  ShodhMemoryService,
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
  const [ragService, setRagService] = useState<RAGService | null>(null);
  const [shodhService, setShodhService] =
    useState<ShodhMemoryService | null>(null);
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
  };

  const handleSelectDocument = (doc: WritingDocument) => {
    setSelectedId(doc.id);
    setSelectedCreatedAt(doc.createdAt);
    setTitle(doc.title);
    setContent(doc.content);
    setSaveStatus('idle');
    setWordCount(countWords(doc.content));
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

    await persistDoc(doc);
  };

  const handleDelete = async (doc: WritingDocument) => {
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

    await shodhService.addMemory({
      projectId: selectedDocument.projectId,
      documentId: selectedDocument.id,
      title: selectedDocument.title || 'Untitled scene',
      summary: memoryDraft.trim(),
      tags: ['scene', 'manual']
    });

    await refreshMemories();
    setMemoryModalOpen(false);
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
      await promoteMemoryToParent(memory, seriesBibleConfig.parentProjectId);
      await refreshMemories();
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
    await promoteDocumentToParent({
      parentProjectId: seriesBibleConfig.parentProjectId,
      documentId: selectedDocument.id,
      title: selectedDocument.title || 'Untitled scene',
      content: selectedDocument.content,
      type: 'scene',
      tags: ['scene']
    });
  }, [seriesBibleConfig?.parentProjectId, selectedDocument]);

  const handleCanonSync = useCallback(async () => {
    if (!activeProject) return;
    const updated = await syncChildWithParent(activeProject.id);
    if (updated) {
      setCanonState((prev) => ({
        ...prev,
        childLastSynced: updated.lastSyncedCanon
      }));
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
            <button type='button' onClick={() => void handleCanonSync()}>
              Mark as synced
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
            <button type='button' onClick={handleNewDocument}>
              + New Scene
            </button>
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
                  style={{marginTop: '0.25rem', fontSize: '0.8rem'}}
                >
                  Delete
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
                <button type='button' onClick={handleSave}>
                  Save now
                </button>
                {seriesBibleConfig?.parentProjectId && (
                  <button type='button' onClick={() => void handlePromoteDocument()}>
                    Promote scene to parent
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
                        style={{fontSize: '0.8rem'}}
                      >
                        Promote
                      </button>
                    );
                  }
                  return null;
                }}
              />
            </>
                )}
              </div>
            </>
          ) : (
            <p>Select a scene from the left, or create a new one.</p>
          )}
        </div>
      </div>

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
                style={{background: 'transparent'}}
              >
                Cancel
              </button>
              <button type='button' onClick={handleMemorySave}>
                Save memory
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default WorkspaceRoute;
