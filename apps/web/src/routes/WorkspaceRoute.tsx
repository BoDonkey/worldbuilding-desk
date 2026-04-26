import {useEffect, useState, useCallback, useMemo, useRef} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import type {
  StatBlockInsertMode,
  StatBlockScopePreset,
  StatBlockSourceType,
  StatBlockStyle,
  SystemHistoryEntry,
  WritingDocument
} from '../entityTypes';
import {EditorWithAI} from '../components/Editor/EditorWithAI';
import {ContextPopover} from '../components/Editor/ContextPopover';
import type {LoreInspectorRecord} from '../components/Editor/LoreInspectorPanel';
import {useWorkspaceMemories} from '../hooks/useWorkspaceMemories';
import {useWorkspaceConsistency} from '../hooks/useWorkspaceConsistency';
import {useWorkspaceDocuments} from '../hooks/useWorkspaceDocuments';
import {useWorkspaceStatBlocks} from '../hooks/useWorkspaceStatBlocks';
import {
  DEFAULT_PARTY_SYNERGY_RULES,
  deriveCharacterRuntimeModifiers,
  getEffectiveResourceValues,
  getEffectiveStatValue,
  getPartySynergySuggestions
} from '../services/compendium';
import {
  getSeriesBibleConfig,
  promoteDocumentToParent,
  syncChildWithParent
} from '../services/seriesBible/SeriesBibleService';
import {getWorldEngine} from '../services/worldEngine';
import {
  appendSystemHistoryEntry,
  getSystemHistoryEntries
} from '../services/system';
import {
  getInspectorConsultationUsage,
  incrementInspectorConsultationUsage
} from '../services/editor';
import {
  WORKSPACE_COMMAND_EVENT,
  type WorkspaceCommandId
} from '../commands/workspaceCommands';
import {
  useWorkspaceDrawers,
  type WorkspaceContextDrawerView
} from '../hooks/useWorkspaceDrawers';
import styles from '../styles/WorkspaceRoute.module.css';
import {useAppStore} from '../store/appStore';
import {WorkspaceContextDrawer} from '../components/Workspace/WorkspaceContextDrawer';
import {WorkspaceSceneDrawer} from '../components/Workspace/WorkspaceSceneDrawer';
import {useWorkspaceProjectData} from '../hooks/useWorkspaceProjectData';
import {useWorkspaceLoreSnippets} from '../hooks/useWorkspaceLoreSnippets';
import {useWorkspaceScratchpad} from '../hooks/useWorkspaceScratchpad';
import {useWorkspaceCorkboard} from '../hooks/useWorkspaceCorkboard';

declare global {
  interface Window {
    __wbdWorkspaceMountedAt?: number;
    __wbdWorkspaceRenderCount?: number;
    __wbdWorkspaceUnmountedAt?: number;
  }
}

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

type FeedbackTone = 'success' | 'error';
type ContextDrawerView = WorkspaceContextDrawerView;
type WorkspaceAIContext = {
  type: 'document';
  id: string;
  selectedText?: string;
  from: number;
  to: number;
};

function WorkspaceRoute() {
  const activeProject = useAppStore((s) => s.activeProject);
  const navigate = useNavigate();
  const location = useLocation();
  const [documents, setDocuments] = useState<WritingDocument[]>([]);
  const seriesBibleConfig = activeProject
    ? getSeriesBibleConfig(activeProject)
    : null;
  const [feedback, setFeedback] = useState<{
    tone: FeedbackTone;
    message: string;
  } | null>(null);
  const [isPromotingDocument, setIsPromotingDocument] = useState(false);
  const [isSyncingCanon, setIsSyncingCanon] = useState(false);
  const [isStatBlockModalOpen, setStatBlockModalOpen] = useState(false);
  const [systemHistoryEntries, setSystemHistoryEntries] = useState<SystemHistoryEntry[]>([]);
  const [activeAIContext, setActiveAIContext] = useState<WorkspaceAIContext | null>(null);
  const [queuedAssistantPrompt, setQueuedAssistantPrompt] = useState<string | null>(null);
  const [activeLoreRecord, setActiveLoreRecord] = useState<LoreInspectorRecord | null>(null);
  const [aiBudgetUsed, setAIBudgetUsed] = useState(0);
  const [pendingAIInsert, setPendingAIInsert] = useState<{
    text: string;
    context: {from: number; to: number} | null;
  } | null>(null);
  const [worldCaptureDrafts, setWorldCaptureDrafts] = useState<Record<string, string>>({});
  const [manualWorldCapture, setManualWorldCapture] = useState<{
    draftText: string;
    left: number;
    top: number;
  } | null>(null);
  const [manualExistingTargetId, setManualExistingTargetId] = useState('');
  const [isReviewBannerDismissed, setReviewBannerDismissed] = useState(false);
  const [isScratchpadModalOpen, setScratchpadModalOpen] = useState(false);
  const [isCorkboardModalOpen, setCorkboardModalOpen] = useState(false);
  const {
    scratchpadContent,
    setScratchpadContent,
    scratchpadStatus,
    scratchpadLastSavedAt
  } = useWorkspaceScratchpad(activeProject?.id ?? null);
  const {
    corkboardCards,
    corkboardStatus,
    corkboardLastSavedAt,
    corkboardPlotPointCount,
    createCorkboardCard,
    updateCorkboardCard,
    deleteCorkboardCard,
    moveCorkboardCard,
    addCorkboardPlotPoint,
    updateCorkboardPlotPoint,
    deleteCorkboardPlotPoint,
    moveCorkboardPlotPoint
  } = useWorkspaceCorkboard(activeProject?.id ?? null);
  const [isNarrowViewport, setNarrowViewport] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 1200px)').matches
      : false
  );
  const {
    isSceneDrawerOpen,
    setSceneDrawerOpen,
    isContextDrawerOpen,
    setContextDrawerOpen,
    activeContextView,
    setActiveContextView
  } = useWorkspaceDrawers({
    activeProjectId: activeProject?.id ?? null,
    isNarrowViewport
  });

  useEffect(() => {
    window.__wbdWorkspaceMountedAt = Date.now();
    window.__wbdWorkspaceRenderCount = 0;
    return () => {
      window.__wbdWorkspaceUnmountedAt = Date.now();
    };
  }, []);

  // Lightweight diagnostics only, no state updates.
  window.__wbdWorkspaceRenderCount = (window.__wbdWorkspaceRenderCount ?? 0) + 1;
  const toggleSceneDrawer = useCallback(() => {
    setSceneDrawerOpen((prev) => {
      const next = !prev;
      if (isNarrowViewport && next) {
        setContextDrawerOpen(false);
      }
      return next;
    });
  }, [isNarrowViewport, setContextDrawerOpen, setSceneDrawerOpen]);
  const toggleContextDrawer = useCallback(() => {
    setContextDrawerOpen((prev) => {
      const next = !prev;
      if (isNarrowViewport && next) {
        setSceneDrawerOpen(false);
      }
      return next;
    });
  }, [isNarrowViewport, setContextDrawerOpen, setSceneDrawerOpen]);
  const openContextDrawer = useCallback(
    (view: ContextDrawerView) => {
      setActiveContextView(view);
      setContextDrawerOpen(true);
      if (isNarrowViewport) {
        setSceneDrawerOpen(false);
      }
    },
    [isNarrowViewport, setActiveContextView, setContextDrawerOpen, setSceneDrawerOpen]
  );
  const openScratchpadModal = useCallback(() => {
    setScratchpadModalOpen(true);
  }, []);
  const closeScratchpadModal = useCallback(() => {
    setScratchpadModalOpen(false);
  }, []);
  const openCorkboardModal = useCallback(() => {
    setCorkboardModalOpen(true);
  }, []);
  const closeCorkboardModal = useCallback(() => {
    setCorkboardModalOpen(false);
  }, []);
  const refreshSystemHistory = useCallback(() => {
    if (!activeProject) {
      setSystemHistoryEntries([]);
      return;
    }
    setSystemHistoryEntries(getSystemHistoryEntries(activeProject.id));
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      setAIBudgetUsed(0);
      return;
    }
    setAIBudgetUsed(getInspectorConsultationUsage(activeProject.id));
  }, [activeProject]);

  const addSystemHistory = useCallback(
    (input: {
      category: SystemHistoryEntry['category'];
      message: string;
      insertText?: string;
      sceneId?: string;
    }) => {
      if (!activeProject) return;
      appendSystemHistoryEntry(activeProject.id, input);
      refreshSystemHistory();
    },
    [activeProject, refreshSystemHistory]
  );
  const lastAutosaveErrorRef = useRef<string | null>(null);
  const persistDocRef = useRef<Parameters<typeof useWorkspaceDocuments>[0]['persistDocRef']['current']>(null);
  const refreshDeferredReviewRef =
    useRef<Parameters<typeof useWorkspaceDocuments>[0]['refreshDeferredReviewRef']['current']>(
      null
    );
  const setGuardrailIssuesRef =
    useRef<Parameters<typeof useWorkspaceDocuments>[0]['setGuardrailIssuesRef']['current']>(
      null
    );
  const setConsistencyPopoverRef =
    useRef<Parameters<typeof useWorkspaceDocuments>[0]['setConsistencyPopoverRef']['current']>(
      null
    );
  const deleteDocumentSideEffectsRef =
    useRef<
      Parameters<typeof useWorkspaceDocuments>[0]['deleteDocumentSideEffectsRef']['current']
    >(null);
  const {
    selectedId,
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
    importInputRef,
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
  } = useWorkspaceDocuments({
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
  });
  const openImportPicker = useCallback(() => {
    importInputRef.current?.click();
  }, [importInputRef]);
  const openExportModalWithDrawerHandling = useCallback(
    (format: 'markdown' | 'docx' | 'epub') => {
      if (isNarrowViewport) {
        setSceneDrawerOpen(false);
      }
      openExportModal(format);
    },
    [isNarrowViewport, openExportModal, setSceneDrawerOpen]
  );
  const {
    shodhService,
    refreshMemories,
    isMemoryModalOpen,
    setMemoryModalOpen,
    memoryDraft,
    setMemoryDraft,
    memoryScope,
    setMemoryScope,
    memoryFilter,
    setMemoryFilter,
    isPromotingMemoryId,
    isSavingMemory,
    memoryCandidates,
    scopeLabel,
    emptyMemoryMessage,
    openMemoryModal,
    handleMemorySave,
    handleDeleteMemory,
    handlePromoteMemory
  } = useWorkspaceMemories({
    activeProject,
    seriesBibleConfig: seriesBibleConfig ?? {
      inheritRag: true,
      inheritShodh: true
    },
    selectedDocument,
    summarizeContent,
    setFeedback
  });

  const handleProjectReset = useCallback(() => {
    setActiveAIContext(null);
    setQueuedAssistantPrompt(null);
    setActiveLoreRecord(null);
    setPendingAIInsert(null);
    setWorldCaptureDrafts({});
    setManualWorldCapture(null);
    setManualExistingTargetId('');
    setReviewBannerDismissed(false);
  }, []);

  const {
    editorConfig,
    toolbarButtons,
    projectSettings,
    setProjectSettings,
    entities,
    setEntities,
    categories,
    setCategories,
    aliases,
    setAliases,
    resolvedActionCues,
    characters,
    characterSheets,
    ruleset,
    settlementState,
    settlementModules,
    ragService,
    canonState,
    setCanonState,
    statBlockSourceType,
    setStatBlockSourceType,
    statBlockStyle,
    setStatBlockStyle,
    statBlockInsertMode,
    setStatBlockInsertMode,
    statBlockScopePreset,
    setStatBlockScopePreset,
    selectedStatGroupId,
    setSelectedStatGroupId,
    selectedStatIds,
    setSelectedStatIds,
    selectedResourceIds,
    setSelectedResourceIds,
    statBlockGroups,
    setStatBlockGroups,
    newStatGroupName,
    setNewStatGroupName,
    selectedStatCharacterId,
    setSelectedStatCharacterId,
    selectedStatEntityId,
    setSelectedStatEntityId,
    statBlockInsertContent,
    setStatBlockInsertContent,
    pendingStatBlockRebindToken,
    setPendingStatBlockRebindToken,
    isStatPreferencesHydrated
  } = useWorkspaceProjectData({
    activeProject,
    initializeEditorState,
    setDocuments,
    setImportMode,
    setSkipImportSuggestions,
    refreshSystemHistory,
    onProjectReset: handleProjectReset
  });
  const worldEngine = useMemo(
    () =>
      getWorldEngine(
        projectSettings?.aiSettings?.inspectorSettings?.reviewEngineMode ??
          'deterministic',
        projectSettings?.aiSettings
      ),
    [projectSettings?.aiSettings]
  );

  const {
    setGuardrailIssues,
    resolvingUnknown,
    linkingUnknown,
    resolverNotice,
    setResolverNotice,
    unknownLinkSelection,
    setUnknownLinkSelection,
    unknownCategorySelection,
    setUnknownCategorySelection,
    isRunningConsistencyReview,
    consistencyReviewItems,
    lastConsistencyReviewAt,
    consistencyPopover,
    setConsistencyPopover,
    persistDoc,
    refreshDeferredReview,
    handleRunConsistencyReview,
    unknownGuardrailIssues,
    hasBlockingUnknownGuardrailIssues,
    highlightableUnknownIssues,
    isReviewPrefsHydrated,
    unknownLinkOptions,
    closeUnknownLinkOptions,
    resolveUnknownEntity,
    resolveAllUnknownEntities,
    dismissAllUnknownEntities,
    dismissUnknownEntity,
    ignoreUnknownSurfaceProjectWide,
    linkUnknownEntity,
    clearUnknownSurface,
    activeConsistencyPopoverIssue,
    reviewReadiness,
    openConsistencyPopover
  } = useWorkspaceConsistency({
    activeProject,
    documents,
    setDocuments,
    entities,
    setEntities,
    categories,
    setCategories,
    aliases,
    setAliases,
    characters,
    selectedDocumentId: selectedId,
    projectSettings,
    setProjectSettings,
    resolvedActionCues,
    worldEngine,
    ragService,
    shodhService,
    refreshMemories,
    setSelectedCreatedAt,
    setSaveStatus,
    setLastSavedAt,
    lastAutosaveErrorRef,
    setFeedback,
    addSystemHistory
  });
  const runConsistencyReviewFromUi = useCallback(async () => {
    setReviewBannerDismissed(false);
    await handleRunConsistencyReview();
  }, [handleRunConsistencyReview]);
  persistDocRef.current = persistDoc;
  refreshDeferredReviewRef.current = refreshDeferredReview;
  setGuardrailIssuesRef.current = setGuardrailIssues as typeof setGuardrailIssuesRef.current;
  setConsistencyPopoverRef.current = setConsistencyPopover as typeof setConsistencyPopoverRef.current;
  deleteDocumentSideEffectsRef.current = async (docId: string) => {
    await Promise.all([
      ragService?.deleteDocument(docId) ?? Promise.resolve(),
      shodhService?.deleteMemoriesForDocument(docId) ?? Promise.resolve()
    ]);
    await refreshMemories();
  };

  const openWorldRecord = (target: {id: string; type: 'character' | 'entity'}) => {
    if (target.type === 'entity') {
      navigate('/world-bible', {state: {focusEntityId: target.id}});
      return;
    }
    navigate('/characters');
  };

  const activePartySynergies = useMemo(
    () =>
      getPartySynergySuggestions({
        characters,
        rules: DEFAULT_PARTY_SYNERGY_RULES
      }),
    [characters]
  );
  const runtimeModifiers = useMemo(
    () =>
      deriveCharacterRuntimeModifiers({
        settlementState,
        settlementModules,
        activePartySynergies
      }),
    [settlementState, settlementModules, activePartySynergies]
  );
  const {
    statDefinitionNameById,
    resourceDefinitionNameById,
    selectedSheet,
    activeProjectMode,
    canInsertStatBlock,
    selectedStatGroup,
    activeSelectedStatSet,
    activeSelectedResourceSet,
    statBlockScopeValue,
    resolveCharacterBlock,
    resolveItemBlock,
    getStatBlockTokenPresentation,
    getStatBlockPreviewData,
    handleRefreshStatTemplates,
    handleInsertStatBlock,
    openStatBlockRebind,
    handleToggleStatSelection,
    handleToggleResourceSelection,
    handleSaveStatGroup,
    handleDeleteStatGroup,
    closeStatBlockModal
  } = useWorkspaceStatBlocks({
    activeProject,
    projectSettings,
    setProjectSettings,
    isStatPreferencesHydrated,
    statBlockSourceType,
    setStatBlockSourceType,
    statBlockStyle,
    setStatBlockStyle,
    statBlockInsertMode,
    setStatBlockInsertMode,
    statBlockScopePreset,
    setStatBlockScopePreset,
    selectedStatGroupId,
    setSelectedStatGroupId,
    selectedStatIds,
    setSelectedStatIds,
    selectedResourceIds,
    setSelectedResourceIds,
    statBlockGroups,
    setStatBlockGroups,
    newStatGroupName,
    setNewStatGroupName,
    selectedStatCharacterId,
    setSelectedStatCharacterId,
    selectedStatEntityId,
    setSelectedStatEntityId,
    statBlockInsertContent,
    setStatBlockInsertContent,
    isStatBlockModalOpen,
    setStatBlockModalOpen,
    pendingStatBlockRebindToken,
    setPendingStatBlockRebindToken,
    characterSheets,
    entities,
    ruleset,
    runtimeModifiers,
    content,
    setContent,
    setSaveStatus,
    setWordCount,
    setFeedback,
    addSystemHistory,
    getEffectiveStatValue,
    getEffectiveResourceValues
  });

  useEffect(() => {
    if (!activeProject) return;
    const activeRules = activePartySynergies
      .filter((item) => item.missingRoles.length === 0)
      .map((item) => item.ruleId)
      .sort();
    if (activeRules.length === 0) return;

    const message =
      activeRules.length === 1
        ? 'Quest hook available from an active party synergy combo.'
        : `Quest hooks available from ${activeRules.length} active party synergy combos.`;

    appendSystemHistoryEntry(activeProject.id, {
      category: 'quest',
      message,
      insertText: `Quest Update: ${message}`,
      sourceKey: `party-synergy:${activeRules.join('|')}`,
      createdAt: Date.now()
    });
    refreshSystemHistory();
  }, [activeProject, activePartySynergies, refreshSystemHistory]);
  const showGameSystems =
    projectSettings?.featureToggles.enableGameSystems !== false;
  const isGeneralFictionProject = projectSettings?.projectMode === 'general';
  const reviewBannerTitle = hasBlockingUnknownGuardrailIssues
    ? isGeneralFictionProject
      ? 'This scene has names or places to review before strict save.'
      : 'This scene has detected references to review before strict save.'
    : isGeneralFictionProject
      ? 'Project review found names or places in this scene.'
      : 'Project review found detected references in this scene.';
  const reviewBannerBody = isGeneralFictionProject
    ? 'Click an underline in the editor to add it to your world, connect it to something existing, or ignore it for now.'
    : 'Click an underline in the editor to add it to the world, connect it to an existing record, or ignore it for now.';
  const reviewCreateLabel = isGeneralFictionProject ? 'Add to World' : 'Create record';
  const reviewCreateAllLabel = isGeneralFictionProject
    ? 'Add all to World'
    : 'Create all as new records';
  const reviewDismissAllLabel = isGeneralFictionProject
    ? 'Ignore all for now'
    : hasBlockingUnknownGuardrailIssues
      ? 'Dismiss all for now'
      : 'Hide all warnings for now';
  const reviewLinkLabel = isGeneralFictionProject ? 'Connect to existing' : 'Link alias';
  const reviewPopoverMessage = isGeneralFictionProject
    ? 'Add this to your world, connect it to something you already track, or ignore it for now.'
    : 'Choose how to handle this detected reference.';
  const visibleReviewSurfaces = unknownGuardrailIssues
    .map((issue) => issue.surface?.trim())
    .filter((surface): surface is string => Boolean(surface))
    .slice(0, 6);
  const hiddenReviewSurfaceCount = Math.max(
    0,
    unknownGuardrailIssues.length - visibleReviewSurfaces.length
  );
  const showReviewBanner =
    unknownGuardrailIssues.length > 0 && !isReviewBannerDismissed;
  const scratchpadStatusLabel =
    scratchpadStatus === 'loading'
      ? 'Loading scratchpad...'
      : scratchpadStatus === 'saving'
        ? 'Saving scratchpad...'
        : scratchpadStatus === 'error'
          ? 'Scratchpad could not be saved.'
          : scratchpadLastSavedAt
            ? `Scratchpad saved at ${new Date(scratchpadLastSavedAt).toLocaleTimeString()}`
            : 'Scratchpad ready.';
  const corkboardStatusLabel =
    corkboardStatus === 'loading'
      ? 'Loading corkboard...'
      : corkboardStatus === 'saving'
        ? 'Saving corkboard...'
        : corkboardStatus === 'error'
          ? 'Corkboard could not be saved.'
          : corkboardLastSavedAt
            ? `Corkboard saved at ${new Date(corkboardLastSavedAt).toLocaleTimeString()}`
            : 'Corkboard ready.';
  const activeWorldCaptureDraft =
    (activeConsistencyPopoverIssue &&
      worldCaptureDrafts[activeConsistencyPopoverIssue.surface]) ||
    activeConsistencyPopoverIssue?.surface ||
    '';
  const selectionQuickSnippets = useWorkspaceLoreSnippets({
    activeProject,
    categories,
    characters,
    characterSheets,
    entities,
    aliases,
    systemHistoryEntries,
    resolveCharacterBlock,
    resolveItemBlock
  });
  const normalizeCaptureSelection = useCallback((input: string) =>
    input
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(), []);
  const manualCaptureExistingEntity = manualWorldCapture
    ? selectionQuickSnippets.entities[
        normalizeCaptureSelection(manualWorldCapture.draftText)
      ] ?? null
    : null;
  const manualCaptureLinkOptions = useMemo(() => {
    if (!manualWorldCapture) return [];

    const normalizedSelection = normalizeCaptureSelection(manualWorldCapture.draftText);
    const candidates = [
      ...entities.map((entity) => ({
        id: `entity:${entity.id}`,
        name: entity.name,
        type: 'Entity'
      })),
      ...characters.map((character) => ({
        id: `character:${character.id}`,
        name: character.name,
        type: 'Character'
      }))
    ];

    return candidates
      .map((candidate) => {
        const normalizedName = normalizeCaptureSelection(candidate.name);
        const exactScore = normalizedName === normalizedSelection ? 0 : 1;
        const overlapScore =
          normalizedName.includes(normalizedSelection) ||
          normalizedSelection.includes(normalizedName)
            ? 0
            : 1;
        return {
          ...candidate,
          score: exactScore + overlapScore
        };
      })
      .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
      .slice(0, 30);
  }, [characters, entities, manualWorldCapture, normalizeCaptureSelection]);
  const toolbarActions = useMemo(
    () => [
      {
        id: 'insert-status-block',
        label: 'Insert Status Block',
        onClick: () => setStatBlockModalOpen(true)
      },
      {
        id: 'refresh-placeholders',
        label: 'Refresh Placeholders',
        onClick: handleRefreshStatTemplates
      }
    ],
    [handleRefreshStatTemplates]
  );

  const [focusQuery, setFocusQuery] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as {focusDocumentId?: string; focusQuery?: string} | null;
    const focusDocumentId = state?.focusDocumentId;
    if (!focusDocumentId) return;
    const target = documents.find((doc) => doc.id === focusDocumentId);
    if (!target) return;
    setFocusQuery(state?.focusQuery?.trim() || null);
    if (selectedId !== target.id) {
    handleSelectDocument(target);
    }
    navigate(location.pathname, {replace: true, state: {}});
  }, [documents, handleSelectDocument, location.pathname, location.state, navigate, selectedId]);

  const selectedDocumentRef = useRef(selectedDocument);
  selectedDocumentRef.current = selectedDocument;
  const reviewRefreshSignature = useMemo(
    () =>
      [
        ...entities.map((entity) =>
          `entity:${entity.id}:${entity.name}:${entity.updatedAt}:${entity.needsCompletion ?? false}`
        ),
        ...aliases.map((alias) =>
          `alias:${alias.id}:${alias.targetId}:${alias.targetType}:${alias.alias}:${alias.updatedAt}`
        ),
        ...characters.map((character) =>
          `character:${character.id}:${character.name}:${character.updatedAt}`
        )
      ]
        .sort()
        .join('|'),
    [aliases, characters, entities]
  );

  useEffect(() => {
    if (!isReviewPrefsHydrated || !selectedId) {
      return;
    }
    const doc = selectedDocumentRef.current;
    if (!doc || doc.id !== selectedId) {
      return;
    }
    void refreshDeferredReview(doc).catch((error) => {
      console.warn('Active scene review refresh failed', error);
    });
  }, [isReviewPrefsHydrated, refreshDeferredReview, reviewRefreshSignature, selectedId]);

  useEffect(() => {
    if (!showGameSystems && activeContextView === 'compendium') {
      setActiveContextView('world-bible');
    }
  }, [showGameSystems, activeContextView, setActiveContextView]);

  useEffect(() => {
    if (!isScratchpadModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setScratchpadModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isScratchpadModalOpen]);

  useEffect(() => {
    if (!isCorkboardModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCorkboardModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCorkboardModalOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1200px)');
    const update = () => setNarrowViewport(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isNarrowViewport) return;
    setSceneDrawerOpen(false);
    setContextDrawerOpen(false);
  }, [isNarrowViewport, setContextDrawerOpen, setSceneDrawerOpen]);

  useEffect(() => {
    if (!isNarrowViewport || (!isContextDrawerOpen && !isSceneDrawerOpen)) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isContextDrawerOpen) {
          setContextDrawerOpen(false);
          return;
        }
        if (isSceneDrawerOpen) {
          setSceneDrawerOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isNarrowViewport,
    isContextDrawerOpen,
    isSceneDrawerOpen,
    setContextDrawerOpen,
    setSceneDrawerOpen
  ]);

  useEffect(() => {
    const onWorkspaceCommand = (event: Event) => {
      const detail = (event as CustomEvent<{id?: WorkspaceCommandId}>).detail;
      const commandId = detail?.id;
      if (!commandId) return;

      switch (commandId) {
        case 'new-scene':
          void handleNewDocument();
          break;
        case 'save-scene':
          void handleSave();
          break;
        case 'open-scratchpad':
          openScratchpadModal();
          break;
        case 'open-corkboard':
          openCorkboardModal();
          break;
        case 'toggle-left-drawer':
          toggleSceneDrawer();
          break;
        case 'toggle-right-drawer':
          toggleContextDrawer();
          break;
        case 'open-context-world-bible':
          openContextDrawer('world-bible');
          break;
        case 'open-context-ruleset':
          openContextDrawer('ruleset');
          break;
        case 'open-context-characters':
          openContextDrawer('characters');
          break;
        case 'open-context-compendium':
          if (showGameSystems) {
            openContextDrawer('compendium');
          }
          break;
        case 'run-consistency-review':
          void runConsistencyReviewFromUi();
          break;
        case 'export-markdown':
          openExportModalWithDrawerHandling('markdown');
          break;
        case 'export-docx':
          openExportModalWithDrawerHandling('docx');
          break;
        case 'export-epub':
          openExportModalWithDrawerHandling('epub');
          break;
        case 'extract-memory':
          openMemoryModal();
          break;
        case 'toggle-ai-panel':
          openContextDrawer('ai');
          break;
        case 'toggle-system-history-panel':
          openContextDrawer('system');
          break;
        default:
          break;
      }
    };

    window.addEventListener(WORKSPACE_COMMAND_EVENT, onWorkspaceCommand);
    return () => {
      window.removeEventListener(WORKSPACE_COMMAND_EVENT, onWorkspaceCommand);
    };
  }, [
    handleNewDocument,
    openCorkboardModal,
    openContextDrawer,
    openScratchpadModal,
    runConsistencyReviewFromUi,
    handleSave,
    openMemoryModal,
    openExportModalWithDrawerHandling,
    showGameSystems,
    toggleContextDrawer,
    toggleSceneDrawer
  ]);

  const handleOpenAIContext = useCallback(
    (context: WorkspaceAIContext, prompt?: string | null) => {
      setActiveAIContext(context);
      if (prompt !== undefined) {
        setQueuedAssistantPrompt(prompt);
      }
      openContextDrawer('ai');
    },
    [openContextDrawer]
  );

  const handleOpenLoreInspector = useCallback(
    (record: LoreInspectorRecord) => {
      setActiveLoreRecord(record);
      openContextDrawer('lore');
    },
    [openContextDrawer]
  );
  const handleOpenManualWorldCapture = useCallback(
    (draftText: string, anchorRect: {left: number; top: number; bottom: number}) => {
      setManualExistingTargetId('');
      setManualWorldCapture({
        draftText,
        left: anchorRect.left,
        top: anchorRect.bottom + 8
      });
    },
    []
  );

  const handleConsultationFromLore = useCallback(
    (
      mode:
        | 'consistency'
        | 'reaction'
        | 'outcome'
        | 'worldbuilding'
        | 'plotting'
    ) => {
      if (!activeProject || !activeLoreRecord) return;
      const inspector = projectSettings?.aiSettings?.inspectorSettings;
      if (inspector?.enableAIConsultation === false) {
        return;
      }
      const maxConsultations = inspector?.maxConsultationsPerDay ?? 20;
      const used = getInspectorConsultationUsage(activeProject.id);
      if (used >= maxConsultations) {
        return;
      }

      const nextUsed = incrementInspectorConsultationUsage(activeProject.id);
      setAIBudgetUsed(nextUsed);

      const maxContextChars = inspector?.maxContextChars ?? 1800;
      const compactContext = summarizeContent(content).slice(0, maxContextChars);
      const header =
        mode === 'consistency'
          ? 'Check consistency for this subject against the current scene context.'
          : mode === 'reaction'
            ? 'Suggest an in-character reaction aligned with this subject profile.'
            : mode === 'outcome'
              ? 'Calculate a plausible outcome grounded in current stats/resources.'
              : mode === 'worldbuilding'
                ? 'Expand the surrounding worldbuilding around this subject without inventing canon-breaking facts.'
                : 'Generate plot hooks and scene pressure that naturally involve this subject.';
      const outputGuide =
        mode === 'worldbuilding'
          ? 'Return 3 grounded expansions with headings: Social/Cultural, Environmental/Material, and Tension/Complication. Keep each brief and explicitly tie it to existing context.'
          : mode === 'plotting'
            ? 'Return 4 plot hooks. For each hook include: Hook, Why it matters now, Risk/complication, and Best-fit scene type. Do not write the scene itself.'
            : mode === 'consistency'
              ? 'Return a concise review with confirmed facts, possible conflicts, and one safe next-step suggestion.'
              : mode === 'reaction'
                ? 'Return 3 plausible reactions ranked from most likely to least likely, with a short reason for each.'
                : 'Return one likely outcome, 2 alternate outcomes, and the key stat/resource pressures driving them.';
      const prompt =
        `${header}\n\n` +
        `Subject: ${activeLoreRecord.name} (${activeLoreRecord.type})\n` +
        `Vital Signs: ${activeLoreRecord.vitalSigns.join(' | ')}\n` +
        `Goal: ${activeLoreRecord.synopsis.goal}\n` +
        `Recent Event: ${activeLoreRecord.synopsis.recentEvent}\n` +
        `Motivation: ${activeLoreRecord.synopsis.motivation}\n` +
        `Scene Context: ${compactContext}\n\n` +
        `Constraints:\n` +
        `- Treat established details as canon unless explicitly marked uncertain.\n` +
        `- Prefer extensions, implications, and tensions over replacement.\n` +
        `- Do not write finished prose for the novel unless the request explicitly asks for insertable text.\n` +
        `- Flag any assumption that is not directly grounded in the provided context.\n\n` +
        `Output format:\n${outputGuide}`;

      handleOpenAIContext(
        {
          type: 'document',
          id: selectedId || activeProject.id,
          selectedText: compactContext,
          from: 0,
          to: 0
        },
        prompt
      );
    },
    [activeLoreRecord, activeProject, content, handleOpenAIContext, projectSettings?.aiSettings?.inspectorSettings, selectedId]
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
      addSystemHistory({
        category: 'consistency',
        message: 'Canon sync state marked as updated.'
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to mark canon as synced.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSyncingCanon(false);
    }
  }, [activeProject, addSystemHistory, setCanonState]);

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
    <section data-workspace-root='true' className={styles.workspaceRoot}>
      <input
        ref={importInputRef}
        type='file'
        accept='.txt,.md,.markdown,.html,.htm,.docx,.doc,.pages,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
        multiple
        onChange={(e) => void handleImportDocuments(e)}
        style={{display: 'none'}}
      />
      <div className={styles.workspaceHeader}>
        <div>
          <h1 className={styles.workspaceTitle}>Writing Workspace</h1>
          <p className={styles.workspaceSubtitle}>
            {activeProject.name}
            {selectedDocument ? ` · ${selectedDocument.title || 'Untitled scene'}` : ''}
          </p>
        </div>
        <div className={styles.workspaceHeaderActions}>
          <button
            type='button'
            onClick={() => void handleNewDocument()}
            disabled={isCreatingScene}
          >
            {isCreatingScene ? 'Creating...' : 'New Scene'}
          </button>
          <button
            type='button'
            onClick={openImportPicker}
            disabled={isImportingDocuments}
          >
            {isImportingDocuments ? 'Importing...' : 'Import'}
          </button>
          <button
            type='button'
            className={`${styles.reviewIndicator} ${styles[`reviewIndicator_${reviewReadiness.state}`]}`}
            onClick={() => openContextDrawer('review')}
            title={reviewReadiness.detail}
            aria-label={`Open review drawer: ${reviewReadiness.detail}`}
          >
            <span className={styles.reviewIndicatorDot} />
            <span>{reviewReadiness.label}</span>
          </button>
          <button
            type='button'
            className={styles.drawerTopButton}
            onClick={openScratchpadModal}
          >
            Scratchpad
          </button>
          <button
            type='button'
            className={styles.drawerTopButton}
            onClick={openCorkboardModal}
          >
            Corkboard
          </button>
          <button
            type='button'
            className={styles.drawerTopButton}
            onClick={toggleSceneDrawer}
          >
            Scenes
          </button>
          <button
            type='button'
            className={styles.drawerTopButton}
            onClick={toggleContextDrawer}
          >
            Context
          </button>
        </div>
      </div>
      {feedback && (
        <div
          role='status'
          className={`${styles.feedbackBanner} ${
            feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type='button'
            onClick={() => setFeedback(null)}
            className={styles.feedbackDismissButton}
            aria-label='Dismiss notification'
          >
            Dismiss
          </button>
        </div>
      )}
      {resolverNotice && (
        <div role='status' className={styles.resolverNotice}>
          <span>{resolverNotice.message}</span>
          <button
            type='button'
            onClick={() => navigate('/world-bible')}
            className={styles.resolverButtonPrimary}
          >
            View in World Bible
          </button>
          <button
            type='button'
            onClick={() => setResolverNotice(null)}
            className={styles.resolverButtonSecondary}
          >
            Dismiss
          </button>
        </div>
      )}
      {showReviewBanner && (
        <div className={styles.unknownPanel}>
          <div className={styles.unknownPanelHeader}>
            <strong>{reviewBannerTitle}</strong>
            <button
              type='button'
              onClick={() => setReviewBannerDismissed(true)}
              className={styles.unknownPanelDismissButton}
              aria-label='Dismiss review notice'
            >
              Dismiss
            </button>
          </div>
          <div className={styles.unknownSummary}>
            {unknownGuardrailIssues.length} item
            {unknownGuardrailIssues.length === 1 ? '' : 's'} highlighted. {reviewBannerBody}
          </div>
          {visibleReviewSurfaces.length > 0 && (
            <div className={styles.unknownSurfaceList}>
              {visibleReviewSurfaces.map((surface) => (
                <span key={surface} className={styles.unknownSurfaceChip}>
                  {surface}
                </span>
              ))}
              {hiddenReviewSurfaceCount > 0 && (
                <span className={styles.unknownSurfaceChipMuted}>
                  +{hiddenReviewSurfaceCount} more
                </span>
              )}
            </div>
          )}
          <div className={styles.unknownBulkActions}>
            <button
              type='button'
              onClick={() => void resolveAllUnknownEntities()}
              className={styles.unknownActionButton}
            >
              {reviewCreateAllLabel}
            </button>
            <button
              type='button'
              onClick={() => dismissAllUnknownEntities(selectedId ?? undefined)}
              className={styles.unknownActionButtonSpaced}
            >
              {reviewDismissAllLabel}
            </button>
          </div>
        </div>
      )}
      {seriesBibleConfig?.parentProjectId && (
        <div className={styles.canonPanel}>
          <div>
            <strong>Parent canon:</strong>{' '}
            {canonState.parentName ?? 'Unknown'} · Version{' '}
            {canonState.parentCanonVersion ?? 'n/a'}
            {canonState.parentCanonVersion &&
              canonState.childLastSynced &&
              canonState.parentCanonVersion !== canonState.childLastSynced && (
                <span className={styles.canonOutOfSync}>
                  Out of sync
                </span>
              )}
          </div>
          <div className={styles.canonMetaRow}>
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

      <div className={styles.workspaceFrame}>
        <div className={styles.workspaceLayout}>
        {isSceneDrawerOpen && !isNarrowViewport && (
          <aside className={styles.sceneDrawerDesktop}>
            <WorkspaceSceneDrawer
              handleNewDocument={handleNewDocument}
              isCreatingScene={isCreatingScene}
              isImportingDocuments={isImportingDocuments}
              openImportPicker={openImportPicker}
              importMode={importMode}
              setImportMode={setImportMode}
              skipImportSuggestions={skipImportSuggestions}
              setSkipImportSuggestions={setSkipImportSuggestions}
              openExportModalWithDrawerHandling={openExportModalWithDrawerHandling}
              documents={documents}
              importSummary={importSummary}
              setImportSummary={setImportSummary}
              retryImportFiles={retryImportFiles}
              setRetryImportFiles={setRetryImportFiles}
              handleRetryFailedImports={handleRetryFailedImports}
              selectedId={selectedId}
              handleSelectDocument={handleSelectDocument}
              handleDelete={handleDelete}
              deletingDocumentId={deletingDocumentId}
            />
          </aside>
        )}

        <div className={styles.editorColumn}>
          {selectedId ? (
            <>
              <div className={styles.editorTitleRow}>
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

              <div className={styles.editorPane}>
                <EditorWithAI
                  documentId={selectedId}
                  content={content}
                  focusQuery={focusQuery}
                  onChange={handleContentChange}
                  onWordCountChange={setWordCount}
                  consistencyHighlights={highlightableUnknownIssues}
                  onConsistencyHighlightClick={(issueId, anchorRect) => {
                    const issue = highlightableUnknownIssues.find(
                      (entry) => entry.id === issueId
                    );
                    if (!issue) return;
                    openConsistencyPopover(issueId, anchorRect, issue.surface);
                  }}
                  config={editorConfig}
                  toolbarButtons={toolbarButtons}
                  toolbarActions={toolbarActions}
                  textToInsert={pendingAIInsert?.text ?? statBlockInsertContent}
                  insertContext={pendingAIInsert?.context ?? null}
                  onTextInserted={() => {
                    if (pendingAIInsert) {
                      setPendingAIInsert(null);
                      return;
                    }
                    setStatBlockInsertContent(null);
                  }}
                  selectionQuickSnippets={selectionQuickSnippets}
                  presentStatBlockToken={getStatBlockTokenPresentation}
                  getStatBlockPreviewData={getStatBlockPreviewData}
                  onRebindStatBlockToken={openStatBlockRebind}
                  onOpenAIContext={handleOpenAIContext}
                  onOpenLoreInspector={handleOpenLoreInspector}
                  onOpenWorldCapture={handleOpenManualWorldCapture}
                />
                {consistencyPopover && activeConsistencyPopoverIssue && (
                  <ContextPopover
                    title={activeConsistencyPopoverIssue.surface}
                    message={reviewPopoverMessage}
                    left={consistencyPopover.left}
                    top={consistencyPopover.top}
                    onClose={() => setConsistencyPopover(null)}
                  >
                    <div className={styles.consistencyPopoverActions}>
                      {categories.length > 0 && (
                        <select
                          value={unknownCategorySelection[activeConsistencyPopoverIssue.surface] ?? ''}
                          onChange={(e) =>
                            setUnknownCategorySelection((prev) => ({
                              ...prev,
                              [activeConsistencyPopoverIssue.surface]: e.target.value
                            }))
                          }
                          aria-label='World category'
                        >
                          <option value=''>Choose a type</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <input
                        type='text'
                        value={activeWorldCaptureDraft}
                        onChange={(event) =>
                          setWorldCaptureDrafts((prev) => ({
                            ...prev,
                            [activeConsistencyPopoverIssue.surface]: event.target.value
                          }))
                        }
                        placeholder='Name or place'
                        className={styles.captureNameInput}
                      />
                      <button
                        type='button'
                        onClick={() => void resolveUnknownEntity(
                          activeConsistencyPopoverIssue.surface,
                          unknownCategorySelection[activeConsistencyPopoverIssue.surface] || undefined,
                          activeWorldCaptureDraft
                        )}
                        disabled={resolvingUnknown === activeConsistencyPopoverIssue.surface}
                      >
                        {resolvingUnknown === activeConsistencyPopoverIssue.surface
                          ? 'Adding...'
                          : reviewCreateLabel}
                      </button>
                      <button
                        type='button'
                        onClick={() =>
                          dismissUnknownEntity(
                            activeConsistencyPopoverIssue.surface,
                            selectedId ?? undefined
                          )
                        }
                      >
                        Ignore
                      </button>
                      <button
                        type='button'
                        onClick={() =>
                          ignoreUnknownSurfaceProjectWide(
                            activeConsistencyPopoverIssue.surface,
                            selectedId ?? undefined
                          )
                        }
                      >
                        Always ignore
                      </button>
                    </div>
                    {unknownLinkOptions[activeConsistencyPopoverIssue.surface]?.length ? (
                      <div className={styles.consistencyPopoverLinkRow}>
                        <select
                          value={
                            unknownLinkSelection[activeConsistencyPopoverIssue.surface] ?? ''
                          }
                          onChange={(event) =>
                            setUnknownLinkSelection((prev) => ({
                              ...prev,
                              [activeConsistencyPopoverIssue.surface]:
                                event.target.value
                            }))
                          }
                        >
                          <option value=''>Select existing record...</option>
                          {unknownLinkOptions[activeConsistencyPopoverIssue.surface].map(
                            (entity) => (
                              <option
                                key={`${entity.type}-${entity.id}`}
                                value={`${entity.type}:${entity.id}`}
                              >
                                {entity.name} {entity.type === 'character' ? '· Character' : '· World'}
                              </option>
                            )
                          )}
                        </select>
                        <button
                          type='button'
                          onClick={() =>
                            void linkUnknownEntity(
                              activeConsistencyPopoverIssue.surface,
                              unknownLinkSelection[activeConsistencyPopoverIssue.surface],
                              activeWorldCaptureDraft
                            )
                          }
                          disabled={
                            linkingUnknown === activeConsistencyPopoverIssue.surface ||
                            !unknownLinkSelection[activeConsistencyPopoverIssue.surface]
                          }
                        >
                          {linkingUnknown === activeConsistencyPopoverIssue.surface
                            ? 'Connecting...'
                            : reviewLinkLabel}
                        </button>
                        {closeUnknownLinkOptions[activeConsistencyPopoverIssue.surface]?.length ? null : (
                          <span className={styles.consistencyPopoverNote}>
                            No close match found. Showing recent records.
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className={styles.consistencyPopoverNote}>
                        No existing records available yet.
                      </div>
                    )}
                  </ContextPopover>
                )}
                {manualWorldCapture && (
                  <ContextPopover
                    title='Add to World'
                    message='Use the selected text as a starting point, then edit it before creating a world record.'
                    left={manualWorldCapture.left}
                    top={manualWorldCapture.top}
                    onClose={() => setManualWorldCapture(null)}
                  >
                    <div className={styles.consistencyPopoverActions}>
                      {categories.length > 0 && (
                        <select
                          value={unknownCategorySelection.__manual__ ?? ''}
                          onChange={(e) =>
                            setUnknownCategorySelection((prev) => ({
                              ...prev,
                              __manual__: e.target.value
                            }))
                          }
                          aria-label='World category'
                        >
                          <option value=''>Choose a type</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <input
                        type='text'
                        value={manualWorldCapture.draftText}
                        onChange={(event) => {
                          setManualExistingTargetId('');
                          setManualWorldCapture((prev) =>
                            prev ? {...prev, draftText: event.target.value} : prev
                          );
                        }}
                        placeholder='Name or place'
                        className={styles.captureNameInput}
                      />
                      <button
                        type='button'
                        onClick={() =>
                          void resolveUnknownEntity(
                            manualWorldCapture.draftText,
                            unknownCategorySelection.__manual__ || undefined,
                            manualWorldCapture.draftText
                          ).then(() => setManualWorldCapture(null))
                        }
                        disabled={resolvingUnknown === manualWorldCapture.draftText}
                      >
                        {resolvingUnknown === manualWorldCapture.draftText
                          ? 'Adding...'
                          : reviewCreateLabel}
                      </button>
                      {manualCaptureExistingEntity && (
                        <button
                          type='button'
                          onClick={() => {
                            clearUnknownSurface(manualWorldCapture.draftText);
                            setManualWorldCapture(null);
                            setFeedback({
                              tone: 'success',
                              message: `"${manualWorldCapture.draftText}" matched ${manualCaptureExistingEntity.name}.`
                            });
                          }}
                        >
                          Use existing
                        </button>
                      )}
                      {manualCaptureLinkOptions.length > 0 && (
                        <div className={styles.manualExistingLinkControls}>
                          <select
                            value={manualExistingTargetId}
                            onChange={(event) =>
                              setManualExistingTargetId(event.target.value)
                            }
                            aria-label='Existing world record'
                          >
                            <option value=''>Link to existing...</option>
                            {manualCaptureLinkOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name} ({option.type})
                              </option>
                            ))}
                          </select>
                          <button
                            type='button'
                            onClick={() => {
                              const selectedTargetId = manualExistingTargetId;
                              const selectedSurface = manualWorldCapture.draftText;
                              void linkUnknownEntity(
                                selectedSurface,
                                selectedTargetId,
                                selectedSurface
                              ).then((linked) => {
                                if (!linked) return;
                                clearUnknownSurface(selectedSurface);
                                setManualExistingTargetId('');
                                setManualWorldCapture(null);
                              });
                            }}
                            disabled={
                              !manualExistingTargetId ||
                              linkingUnknown === manualWorldCapture.draftText
                            }
                          >
                            {linkingUnknown === manualWorldCapture.draftText
                              ? 'Linking...'
                              : 'Link selected'}
                          </button>
                        </div>
                      )}
                    </div>
                  </ContextPopover>
                )}
              </div>

              <div className={styles.editorFooterBar}>
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
                <span className={styles.editorFooterStatus}>
                  {saveStatus === 'saving' && 'Saving…'}
                  {saveStatus === 'saved' && lastSavedAt && (
                    <>Saved at {new Date(lastSavedAt).toLocaleTimeString()}</>
                  )}
                  {saveStatus === 'idle' && 'No recent changes'}
                  {' · '}
                  {wordCount} words
                </span>
                <div className={styles.editorFooterUtilities}>
                  <button
                    type='button'
                    className={styles.drawerTopButton}
                    onClick={openScratchpadModal}
                  >
                    Scratchpad
                  </button>
                  <button
                    type='button'
                    className={styles.drawerTopButton}
                    onClick={openCorkboardModal}
                  >
                    Corkboard
                  </button>
                  <button
                    type='button'
                    className={styles.drawerTopButton}
                    onClick={toggleSceneDrawer}
                  >
                    Scenes
                  </button>
                  <button
                    type='button'
                    className={styles.drawerTopButton}
                    onClick={toggleContextDrawer}
                  >
                    Context
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyWorkspaceState}>
              <h2 className={styles.emptyWorkspaceTitle}>Start writing immediately</h2>
              <p className={styles.emptyWorkspaceCopy}>
                Create a blank scene or import existing pages. World context and review
                tools can stay in the background until you need them.
              </p>
              <div className={styles.emptyWorkspaceActions}>
                <button
                  type='button'
                  onClick={() => void handleNewDocument()}
                  disabled={isCreatingScene}
                >
                  {isCreatingScene ? 'Creating...' : 'New Scene'}
                </button>
                <button
                  type='button'
                  onClick={openImportPicker}
                  disabled={isImportingDocuments}
                >
                  {isImportingDocuments ? 'Importing...' : 'Import Draft'}
                </button>
                <button
                  type='button'
                  className={styles.drawerTopButton}
                  onClick={openScratchpadModal}
                >
                  Open Scratchpad
                </button>
                <button
                  type='button'
                  className={styles.drawerTopButton}
                  onClick={openCorkboardModal}
                >
                  Open Corkboard
                </button>
                <button
                  type='button'
                  className={styles.drawerTopButton}
                  onClick={toggleSceneDrawer}
                >
                  Browse Scenes
                </button>
              </div>
            </div>
          )}
        </div>

        {isContextDrawerOpen && !isNarrowViewport && (
          <aside className={styles.contextDrawerDesktop}>
            <WorkspaceContextDrawer
              activeContextView={activeContextView}
              setActiveContextView={setActiveContextView}
              showGameSystems={showGameSystems}
              entities={entities}
              categories={categories}
              ruleset={ruleset}
              characters={characters}
              characterSheets={characterSheets}
              handleRunConsistencyReview={runConsistencyReviewFromUi}
              isRunningConsistencyReview={isRunningConsistencyReview}
              lastConsistencyReviewAt={lastConsistencyReviewAt}
              consistencyReviewItems={consistencyReviewItems}
              reviewReadiness={reviewReadiness}
              documents={documents}
              handleSelectDocument={handleSelectDocument}
              openWorldRecord={openWorldRecord}
              scratchpadContent={scratchpadContent}
              setScratchpadContent={setScratchpadContent}
              scratchpadStatus={scratchpadStatus}
              scratchpadLastSavedAt={scratchpadLastSavedAt}
              activeProject={activeProject}
              projectSettings={projectSettings}
              activeAIContext={activeAIContext}
              setPendingAIInsert={setPendingAIInsert}
              queuedAssistantPrompt={queuedAssistantPrompt}
              setQueuedAssistantPrompt={setQueuedAssistantPrompt}
              systemHistoryEntries={systemHistoryEntries}
              setFeedback={setFeedback}
              refreshSystemHistory={refreshSystemHistory}
              activeLoreRecord={activeLoreRecord}
              aiBudgetUsed={aiBudgetUsed}
              handleConsultationFromLore={handleConsultationFromLore}
              settlementModuleCount={settlementModules.length}
              activePartySynergyCount={activePartySynergies.length}
              selectedId={selectedId}
              memoryCandidates={memoryCandidates}
              memoryFilter={memoryFilter}
              setMemoryFilter={setMemoryFilter}
              memoryScope={memoryScope}
              setMemoryScope={setMemoryScope}
              scopeLabel={scopeLabel}
              refreshMemories={refreshMemories}
              handleDeleteMemory={handleDeleteMemory}
              emptyMemoryMessage={emptyMemoryMessage}
              seriesBibleConfig={seriesBibleConfig}
              handlePromoteMemory={handlePromoteMemory}
              isPromotingMemoryId={isPromotingMemoryId}
            />
          </aside>
        )}
        </div>
      </div>

      {isSceneDrawerOpen && isNarrowViewport && (
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Workspace scene drawer'
          onClick={() => setSceneDrawerOpen(false)}
          className={`${styles.drawerOverlay} ${styles.sceneOverlay}`}
        >
          <aside
            onClick={(event) => event.stopPropagation()}
            className={styles.drawerPanelLeft}
          >
            <div className={styles.drawerPanelHeader}>
              <strong>Scenes</strong>
              <button type='button' onClick={() => setSceneDrawerOpen(false)}>
                Close
              </button>
            </div>
            <WorkspaceSceneDrawer
              handleNewDocument={handleNewDocument}
              isCreatingScene={isCreatingScene}
              isImportingDocuments={isImportingDocuments}
              openImportPicker={openImportPicker}
              importMode={importMode}
              setImportMode={setImportMode}
              skipImportSuggestions={skipImportSuggestions}
              setSkipImportSuggestions={setSkipImportSuggestions}
              openExportModalWithDrawerHandling={openExportModalWithDrawerHandling}
              documents={documents}
              importSummary={importSummary}
              setImportSummary={setImportSummary}
              retryImportFiles={retryImportFiles}
              setRetryImportFiles={setRetryImportFiles}
              handleRetryFailedImports={handleRetryFailedImports}
              selectedId={selectedId}
              handleSelectDocument={handleSelectDocument}
              handleDelete={handleDelete}
              deletingDocumentId={deletingDocumentId}
            />
          </aside>
        </div>
      )}

      {isContextDrawerOpen && isNarrowViewport && (
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Workspace context drawer'
          onClick={() => setContextDrawerOpen(false)}
          className={`${styles.drawerOverlay} ${styles.contextOverlay}`}
        >
          <aside
            onClick={(event) => event.stopPropagation()}
            className={styles.drawerPanelRight}
          >
            <div className={styles.drawerPanelHeader}>
              <strong>Context Drawer</strong>
              <button type='button' onClick={() => setContextDrawerOpen(false)}>
                Close
              </button>
            </div>
            <WorkspaceContextDrawer
              activeContextView={activeContextView}
              setActiveContextView={setActiveContextView}
              showGameSystems={showGameSystems}
              entities={entities}
              categories={categories}
              ruleset={ruleset}
              characters={characters}
              characterSheets={characterSheets}
              handleRunConsistencyReview={runConsistencyReviewFromUi}
              isRunningConsistencyReview={isRunningConsistencyReview}
              lastConsistencyReviewAt={lastConsistencyReviewAt}
              consistencyReviewItems={consistencyReviewItems}
              reviewReadiness={reviewReadiness}
              documents={documents}
              handleSelectDocument={handleSelectDocument}
              openWorldRecord={openWorldRecord}
              scratchpadContent={scratchpadContent}
              setScratchpadContent={setScratchpadContent}
              scratchpadStatus={scratchpadStatus}
              scratchpadLastSavedAt={scratchpadLastSavedAt}
              activeProject={activeProject}
              projectSettings={projectSettings}
              activeAIContext={activeAIContext}
              setPendingAIInsert={setPendingAIInsert}
              queuedAssistantPrompt={queuedAssistantPrompt}
              setQueuedAssistantPrompt={setQueuedAssistantPrompt}
              systemHistoryEntries={systemHistoryEntries}
              setFeedback={setFeedback}
              refreshSystemHistory={refreshSystemHistory}
              activeLoreRecord={activeLoreRecord}
              aiBudgetUsed={aiBudgetUsed}
              handleConsultationFromLore={handleConsultationFromLore}
              settlementModuleCount={settlementModules.length}
              activePartySynergyCount={activePartySynergies.length}
              selectedId={selectedId}
              memoryCandidates={memoryCandidates}
              memoryFilter={memoryFilter}
              setMemoryFilter={setMemoryFilter}
              memoryScope={memoryScope}
              setMemoryScope={setMemoryScope}
              scopeLabel={scopeLabel}
              refreshMemories={refreshMemories}
              handleDeleteMemory={handleDeleteMemory}
              emptyMemoryMessage={emptyMemoryMessage}
              seriesBibleConfig={seriesBibleConfig}
              handlePromoteMemory={handlePromoteMemory}
              isPromotingMemoryId={isPromotingMemoryId}
            />
          </aside>
        </div>
      )}

      {isStatBlockModalOpen && (
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Status Block Builder'
          onClick={closeStatBlockModal}
          className={styles.modalOverlay}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className={`${styles.modalCard} ${styles.statModalCard}`}
          >
            <h3 className={styles.modalTitle}>
              {pendingStatBlockRebindToken ? 'Rebind Status Block' : 'Insert Status Block'}
            </h3>
            <p className={styles.modalDescription}>
              {pendingStatBlockRebindToken ? (
                <>
                  Choose the correct source and save it back into this placeholder token.
                </>
              ) : (
                <>
                  Choose what to insert. Use <strong>Reusable placeholder</strong> if you
                  want to refresh it later.
                </>
              )}
            </p>
            {pendingStatBlockRebindToken && (
              <div className={styles.statRebindNotice}>
                Rebinding keeps this token as a reusable placeholder and updates only the
                selected chip in the scene.
              </div>
            )}

            <div className={styles.statFormGrid}>
              <label>
                Source type
                <br />
                <select
                  id='stat-block-source-type'
                  value={statBlockSourceType}
                  onChange={(event) =>
                    setStatBlockSourceType(event.target.value as StatBlockSourceType)
                  }
                  className={styles.fullWidthField}
                >
                  <option value='character'>Character</option>
                  <option value='item'>Item/Entity</option>
                </select>
              </label>

              {statBlockSourceType === 'character' ? (
                <>
                  <label>
                    Character
                    <br />
                    <select
                      id='stat-block-character'
                      value={selectedStatCharacterId}
                      onChange={(event) => setSelectedStatCharacterId(event.target.value)}
                      disabled={characterSheets.length === 0}
                      className={styles.fullWidthField}
                    >
                      {characterSheets.length === 0 ? (
                        <option value=''>No character sheets</option>
                      ) : (
                        characterSheets.map((sheet) => (
                          <option key={sheet.id} value={sheet.id}>
                            {sheet.name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>

                  <label>
                    Block contents
                    <br />
                    <select
                      id='stat-block-contents'
                      value={statBlockScopeValue}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value.startsWith('group:')) {
                          setSelectedStatGroupId(value.slice('group:'.length));
                          setStatBlockScopePreset('custom');
                          return;
                        }
                        setSelectedStatGroupId('');
                        setStatBlockScopePreset(value as StatBlockScopePreset);
                      }}
                      className={styles.fullWidthField}
                    >
                      <option value='all'>All stats + resources</option>
                      <option value='stats'>Stats only</option>
                      <option value='resources'>Resources only</option>
                      <option value='custom'>Custom selection</option>
                      {statBlockGroups.map((group) => (
                        <option key={group.id} value={`group:${group.id}`}>
                          Group: {group.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {statBlockScopePreset === 'custom' && !selectedStatGroup && (
                    <div className={styles.statCustomCard}>
                      <strong className={styles.statCustomTitle}>Custom pick</strong>
                      <div className={styles.statCustomGrid}>
                        <div>
                          <div className={styles.statSectionLabel}>Stats</div>
                          {selectedSheet?.stats.length ? (
                            selectedSheet.stats.map((stat) => {
                              const label =
                                statDefinitionNameById.get(stat.definitionId) ??
                                stat.definitionId;
                              return (
                                <label key={stat.definitionId} className={styles.statOptionLabel}>
                                  <input
                                    type='checkbox'
                                    checked={activeSelectedStatSet.has(stat.definitionId)}
                                    onChange={() =>
                                      handleToggleStatSelection(stat.definitionId)
                                    }
                                  />{' '}
                                  {label}
                                </label>
                              );
                            })
                          ) : (
                            <span className={styles.statMutedText}>
                              No stats on this character.
                            </span>
                          )}
                        </div>
                        <div>
                          <div className={styles.statSectionLabel}>Resources</div>
                          {selectedSheet?.resources.length ? (
                            selectedSheet.resources.map((resource) => {
                              const label =
                                resourceDefinitionNameById.get(resource.definitionId) ??
                                resource.definitionId;
                              return (
                                <label
                                  key={resource.definitionId}
                                  className={styles.statOptionLabel}
                                >
                                  <input
                                    type='checkbox'
                                    checked={activeSelectedResourceSet.has(
                                      resource.definitionId
                                    )}
                                    onChange={() =>
                                      handleToggleResourceSelection(resource.definitionId)
                                    }
                                  />{' '}
                                  {label}
                                </label>
                              );
                            })
                          ) : (
                            <span className={styles.statMutedText}>
                              No resources on this character.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedStatGroup && (
                    <div className={styles.statGroupSummary}>
                      <span>
                        Group <strong>{selectedStatGroup.name}</strong> includes{' '}
                        {activeSelectedStatSet.size} stat(s) and{' '}
                        {activeSelectedResourceSet.size} resource(s).
                      </span>
                      <button
                        type='button'
                        onClick={() => handleDeleteStatGroup(selectedStatGroup.id)}
                        className={styles.statGroupDeleteButton}
                      >
                        Delete group
                      </button>
                    </div>
                  )}

                  <div className={styles.statCustomCard}>
                    <strong className={styles.statSaveGroupTitle}>Save current selection</strong>
                    <div className={styles.statSaveGroupRow}>
                      <input
                        type='text'
                        placeholder='Group name (e.g. Qi only)'
                        value={newStatGroupName}
                        onChange={(event) => setNewStatGroupName(event.target.value)}
                        className={styles.statSaveGroupInput}
                      />
                      <button type='button' onClick={handleSaveStatGroup}>
                        Save group
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <label>
                  Item/Entity
                  <br />
                  <select
                    id='stat-block-entity'
                    value={selectedStatEntityId}
                    onChange={(event) => setSelectedStatEntityId(event.target.value)}
                    disabled={entities.length === 0}
                    className={styles.fullWidthField}
                  >
                    {entities.length === 0 ? (
                      <option value=''>No entities</option>
                    ) : (
                      entities.map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              )}

              <label>
                Detail level
                <br />
                <select
                  id='stat-block-detail'
                  value={statBlockStyle}
                  onChange={(event) =>
                    setStatBlockStyle(event.target.value as StatBlockStyle)
                  }
                  className={styles.fullWidthField}
                >
                  <option value='full'>All stats</option>
                  <option value='buffs'>Current buffs only</option>
                  <option value='compact'>Compact</option>
                </select>
              </label>

              <label>
                Insert as
                <br />
                <select
                  id='stat-block-insert-as'
                  value={statBlockInsertMode}
                  onChange={(event) =>
                    setStatBlockInsertMode(event.target.value as StatBlockInsertMode)
                  }
                  disabled={activeProjectMode === 'litrpg'}
                  className={styles.fullWidthField}
                >
                  <option value='block'>Live block now</option>
                  <option value='template'>Reusable placeholder</option>
                </select>
                {activeProjectMode === 'litrpg' && (
                  <span className={styles.modeHint}>
                    LitRPG mode always inserts live text for readability.
                  </span>
                )}
              </label>
            </div>
            {!canInsertStatBlock && (
              <div className={styles.statInsertHintCard}>
                <p className={styles.statInsertHintText}>
                  Add at least one {statBlockSourceType === 'character' ? 'character sheet' : 'entity'} before inserting a status block.
                </p>
                <div className={styles.statInsertHintActions}>
                  <button
                    type='button'
                    onClick={() => {
                      closeStatBlockModal();
                      navigate(
                        statBlockSourceType === 'character'
                          ? '/characters?view=sheets'
                          : '/world-bible'
                      );
                    }}
                    className={styles.statInsertHintButton}
                  >
                    {statBlockSourceType === 'character'
                      ? 'Go to Characters'
                      : 'Go to World Bible'}
                  </button>
                </div>
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type='button'
                onClick={closeStatBlockModal}
                className={styles.modalSecondaryAction}
              >
                Cancel
              </button>
              <button type='button' onClick={handleInsertStatBlock} disabled={!canInsertStatBlock}>
                {pendingStatBlockRebindToken ? 'Rebind token' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isScratchpadModalOpen && (
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Project scratchpad'
          onClick={closeScratchpadModal}
          className={styles.modalOverlay}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className={`${styles.modalCard} ${styles.scratchpadModalCard}`}
          >
            <div className={styles.scratchpadModalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Scratchpad</h3>
                <p className={styles.modalDescription}>
                  Loose project notes that stay outside scenes and canon.
                </p>
              </div>
              <button
                type='button'
                className={styles.modalSecondaryAction}
                onClick={closeScratchpadModal}
              >
                Close
              </button>
            </div>
            <textarea
              className={`${styles.scratchpadTextarea} ${styles.scratchpadModalTextarea}`}
              value={scratchpadContent}
              onChange={(event) => setScratchpadContent(event.target.value)}
              placeholder='Loose notes, fragments, reminders, questions...'
              aria-label='Project scratchpad'
            />
            <div className={styles.scratchpadModalFooter}>
              <div className={styles.scratchpadStatus} role='status'>
                {scratchpadStatusLabel}
              </div>
              <div className={styles.scratchpadModalActions}>
                <button
                  type='button'
                  className={styles.modalSecondaryAction}
                  onClick={() => {
                    setActiveContextView('scratchpad');
                    setContextDrawerOpen(true);
                    if (isNarrowViewport) {
                      setSceneDrawerOpen(false);
                    }
                    closeScratchpadModal();
                  }}
                >
                  Open in Context Drawer
                </button>
                <button type='button' onClick={closeScratchpadModal}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCorkboardModalOpen && (
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Project corkboard'
          onClick={closeCorkboardModal}
          className={styles.modalOverlay}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className={`${styles.modalCard} ${styles.corkboardModalCard}`}
          >
            <div className={styles.corkboardModalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Corkboard</h3>
                <p className={styles.modalDescription}>
                  Lightweight chapter planning with cards, summaries, status, and plot points.
                </p>
              </div>
              <div className={styles.corkboardHeaderActions}>
                <button
                  type='button'
                  className={styles.modalSecondaryAction}
                  onClick={createCorkboardCard}
                >
                  New Card
                </button>
                <button
                  type='button'
                  className={styles.modalSecondaryAction}
                  onClick={closeCorkboardModal}
                >
                  Close
                </button>
              </div>
            </div>

            <div className={styles.corkboardMetaRow}>
              <span>
                {corkboardCards.length} card{corkboardCards.length === 1 ? '' : 's'}
              </span>
              <span>
                {corkboardPlotPointCount} plot point{corkboardPlotPointCount === 1 ? '' : 's'}
              </span>
              <span>{corkboardStatusLabel}</span>
            </div>

            {corkboardCards.length === 0 ? (
              <div className={styles.corkboardEmptyState}>
                <p className={styles.corkboardEmptyTitle}>Start with a chapter card.</p>
                <p className={styles.corkboardEmptyCopy}>
                  Sketch scenes, chapter beats, or loose sequence ideas without leaving the writing workspace.
                </p>
                <button type='button' onClick={createCorkboardCard}>
                  Create first card
                </button>
              </div>
            ) : (
              <div className={styles.corkboardCardList}>
                {corkboardCards.map((card, index) => (
                  <section key={card.id} className={styles.corkboardCard}>
                    <div className={styles.corkboardCardHeader}>
                      <div className={styles.corkboardCardTitleRow}>
                        <span className={styles.corkboardCardIndex}>Card {index + 1}</span>
                        <input
                          type='text'
                          value={card.title}
                          onChange={(event) =>
                            updateCorkboardCard(card.id, {title: event.target.value})
                          }
                          placeholder='Chapter or sequence title'
                          className={styles.corkboardTitleInput}
                        />
                      </div>
                      <div className={styles.corkboardCardActions}>
                        <button
                          type='button'
                          className={styles.modalSecondaryAction}
                          onClick={() => moveCorkboardCard(card.id, -1)}
                          disabled={index === 0}
                        >
                          Up
                        </button>
                        <button
                          type='button'
                          className={styles.modalSecondaryAction}
                          onClick={() => moveCorkboardCard(card.id, 1)}
                          disabled={index === corkboardCards.length - 1}
                        >
                          Down
                        </button>
                        <button
                          type='button'
                          className={styles.modalSecondaryAction}
                          onClick={() => deleteCorkboardCard(card.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className={styles.corkboardCardFields}>
                      <label className={styles.corkboardField}>
                        <span>Status</span>
                        <select
                          value={card.status}
                          onChange={(event) =>
                            updateCorkboardCard(card.id, {
                              status: event.target.value as 'planned' | 'draft' | 'written'
                            })
                          }
                        >
                          <option value='planned'>Planned</option>
                          <option value='draft'>Draft</option>
                          <option value='written'>Written</option>
                        </select>
                      </label>
                      <label className={styles.corkboardField}>
                        <span>Summary</span>
                        <textarea
                          value={card.summary}
                          onChange={(event) =>
                            updateCorkboardCard(card.id, {summary: event.target.value})
                          }
                          placeholder='What happens in this chapter or scene sequence?'
                          className={styles.corkboardSummaryTextarea}
                        />
                      </label>
                    </div>

                    <div className={styles.corkboardPlotSection}>
                      <div className={styles.corkboardPlotHeader}>
                        <strong>Plot points</strong>
                        <button
                          type='button'
                          className={styles.modalSecondaryAction}
                          onClick={() => addCorkboardPlotPoint(card.id)}
                        >
                          Add plot point
                        </button>
                      </div>
                      {card.plotPoints.length === 0 ? (
                        <p className={styles.corkboardPlotEmpty}>
                          No plot points yet.
                        </p>
                      ) : (
                        <div className={styles.corkboardPlotList}>
                          {card.plotPoints.map((plotPoint, plotIndex) => (
                            <div key={plotPoint.id} className={styles.corkboardPlotPoint}>
                              <div className={styles.corkboardPlotPointHeader}>
                                <span className={styles.corkboardPlotIndex}>
                                  {plotIndex + 1}
                                </span>
                                <input
                                  type='text'
                                  value={plotPoint.title}
                                  onChange={(event) =>
                                    updateCorkboardPlotPoint(card.id, plotPoint.id, {
                                      title: event.target.value
                                    })
                                  }
                                  placeholder='Beat or turning point'
                                  className={styles.corkboardPlotTitleInput}
                                />
                                <div className={styles.corkboardPlotActions}>
                                  <button
                                    type='button'
                                    className={styles.modalSecondaryAction}
                                    onClick={() =>
                                      moveCorkboardPlotPoint(card.id, plotPoint.id, -1)
                                    }
                                    disabled={plotIndex === 0}
                                  >
                                    Up
                                  </button>
                                  <button
                                    type='button'
                                    className={styles.modalSecondaryAction}
                                    onClick={() =>
                                      moveCorkboardPlotPoint(card.id, plotPoint.id, 1)
                                    }
                                    disabled={plotIndex === card.plotPoints.length - 1}
                                  >
                                    Down
                                  </button>
                                  <button
                                    type='button'
                                    className={styles.modalSecondaryAction}
                                    onClick={() =>
                                      deleteCorkboardPlotPoint(card.id, plotPoint.id)
                                    }
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              <textarea
                                value={plotPoint.notes ?? ''}
                                onChange={(event) =>
                                  updateCorkboardPlotPoint(card.id, plotPoint.id, {
                                    notes: event.target.value
                                  })
                                }
                                placeholder='Optional note or reminder'
                                className={styles.corkboardPlotNotes}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            )}

            <div className={styles.corkboardFooterActions}>
              <button
                type='button'
                className={styles.modalSecondaryAction}
                onClick={openScratchpadModal}
              >
                Open Scratchpad
              </button>
              <button type='button' onClick={closeCorkboardModal}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {isExportModalOpen && (
        <div
          role='dialog'
          aria-modal='true'
          className={styles.modalOverlay}
        >
          <div className={`${styles.modalCard} ${styles.exportModalCard}`}>
            <h3 className={styles.modalTitle}>
              Export scenes as{' '}
              {exportFormat === 'markdown'
                ? 'Markdown'
                : exportFormat === 'docx'
                  ? 'DOCX'
                  : 'EPUB'}
            </h3>
            <p className={styles.modalDescription}>
              Choose which scenes to export and adjust their order for the final file.
            </p>
            <div className={styles.exportControlRow}>
              <button type='button' onClick={() => toggleAllExportItems(true)}>
                Select all
              </button>
              <button type='button' onClick={() => toggleAllExportItems(false)}>
                Clear all
              </button>
            </div>
            <div className={styles.exportListContainer}>
              {exportSelection.length === 0 ? (
                <p className={styles.exportEmpty}>
                  No scenes available to export.
                </p>
              ) : (
                <ul className={styles.exportList}>
                  {exportSelection.map((item, index) => (
                    <li key={item.id} className={styles.exportListItem}>
                      <label className={styles.exportItemLabel}>
                        <input
                          type='checkbox'
                          checked={item.included}
                          onChange={() => toggleExportItem(item.id)}
                        />
                        <span className={styles.exportItemTitle}>
                          {index + 1}. {item.title}
                        </span>
                      </label>
                      <div className={styles.exportMoveActions}>
                        <button
                          type='button'
                          onClick={() => moveExportItem(item.id, -1)}
                          disabled={index === 0}
                          className={styles.exportMoveButton}
                        >
                          Up
                        </button>
                        <button
                          type='button'
                          onClick={() => moveExportItem(item.id, 1)}
                          disabled={index === exportSelection.length - 1}
                          className={styles.exportMoveButton}
                        >
                          Down
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={styles.modalActions}>
              <button
                type='button'
                onClick={closeExportModal}
                className={styles.modalSecondaryAction}
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
          className={styles.modalOverlay}
        >
          <div className={`${styles.modalCard} ${styles.memoryModalCard}`}>
            <h3 className={styles.modalTitle}>Capture Shodh memory</h3>
            <p className={styles.modalDescription}>
              Review or edit the summary before adding it to the project
              canon.
            </p>
            <textarea
              value={memoryDraft}
              onChange={(e) => setMemoryDraft(e.target.value)}
              rows={6}
              className={styles.memoryTextarea}
            />
            <div className={styles.modalActions}>
              <button
                type='button'
                onClick={() => setMemoryModalOpen(false)}
                disabled={isSavingMemory}
                className={styles.modalSecondaryAction}
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
