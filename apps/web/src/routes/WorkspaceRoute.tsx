import {
  type ComponentProps,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useMemo,
  useRef
} from 'react';
import {useLocation, useNavigate} from 'react-router';
import type {WritingDocument} from '../entityTypes';
import {EditorWithAI} from '../components/Editor/EditorWithAI';
import {useWorkspaceMemories} from '../hooks/useWorkspaceMemories';
import {
  useWorkspaceConsistency,
  type StateMutationReviewItem
} from '../hooks/useWorkspaceConsistency';
import {useWorkspaceDocuments} from '../hooks/useWorkspaceDocuments';
import {useWorkspaceStatBlocks} from '../hooks/useWorkspaceStatBlocks';
import {useConfirmDialog} from '../hooks/useConfirmDialog';
import {
  DEFAULT_PARTY_SYNERGY_RULES,
  deriveCharacterRuntimeModifiers,
  getEffectiveResourceValues,
  getEffectiveStatValue,
  getPartySynergySuggestions
} from '../services/compendium';
import {getSeriesBibleConfig} from '../services/seriesBible/SeriesBibleService';
import {useWorkspaceResolverNotice} from '../hooks/useWorkspaceResolverNotice';
import {useWorkspaceChapterCardLinks} from '../hooks/useWorkspaceChapterCardLinks';
import {useWorkspaceCharacterStatPeek} from '../hooks/useWorkspaceCharacterStatPeek';
import {useWorkspaceSeriesCanon} from '../hooks/useWorkspaceSeriesCanon';
import {getWorldEngine} from '../services/worldEngine';
import {useWorkspaceDrawers} from '../hooks/useWorkspaceDrawers';
import {useWorkspaceCommands} from '../hooks/useWorkspaceCommands';
import {useWorkspaceDrawerFocus} from '../hooks/useWorkspaceDrawerFocus';
import {
  summarizeContent,
  useWorkspaceContextActions
} from '../hooks/useWorkspaceContextActions';
import {useSelectionActionRun} from '../hooks/useSelectionActionRun';
import {WorkspaceSelectionActionPanel} from '../components/Workspace/WorkspaceSelectionActionPanel';
import {useWorkspaceSystemHistory} from '../hooks/useWorkspaceSystemHistory';
import {useWorkspaceReviewRefresh} from '../hooks/useWorkspaceReviewRefresh';
import {
  useWorkspaceExportUi,
  useWorkspaceImportUi,
  useWorkspaceModalUi,
  useWorkspaceSceneOperationUi
} from '../hooks/useWorkspaceUi';
import {getProjectCapabilities} from '../projectMode';
import styles from '../styles/WorkspaceRoute.module.css';
import {useAppStore} from '../store/appStore';
import {WorkspaceContextDrawer} from '../components/Workspace/WorkspaceContextDrawer';
import {WorkspaceDrawerLayout} from '../components/Workspace/WorkspaceDrawerLayout';
import {WorkspaceCorkboardModal} from '../components/Workspace/WorkspaceCorkboardModal';
import {WorkspaceChapterCardContext} from '../components/Workspace/WorkspaceChapterCardContext';
import {WorkspaceScratchpadModal} from '../components/Workspace/WorkspaceScratchpadModal';
import {WorkspaceExportModal} from '../components/Workspace/WorkspaceExportModal';
import {WorkspaceAITextReportModal} from '../components/Workspace/WorkspaceAITextReportModal';
import {WorkspaceMemoryModal} from '../components/Workspace/WorkspaceMemoryModal';
import {WorkspaceStatBlockModal} from '../components/Workspace/WorkspaceStatBlockModal';
import {WorkspaceSceneDrawer} from '../components/Workspace/WorkspaceSceneDrawer';
import {CanonPanel} from '../components/Workspace/CanonPanel';
import {UnknownEntityPanel} from '../components/Workspace/UnknownEntityPanel';
import {WorkspaceReviewSurfacePopover} from '../components/Workspace/WorkspaceReviewSurfacePopover';
import {WorkspaceManualWorldCapturePopover} from '../components/Workspace/WorkspaceManualWorldCapturePopover';
import {WorkspaceSceneStateDialogs} from '../components/Workspace/WorkspaceSceneStateDialogs';
import {
  getStateMutationEventStaleness
} from '../services/state/stateMutationStaleness';
import {
  type EditorTextSnapshot,
  type StateMutationTextAnchor
} from '../services/state/stateMutationAnchor';
import {useWorkspaceProjectData} from '../hooks/useWorkspaceProjectData';
import {useWorkspaceLoreSnippets} from '../hooks/useWorkspaceLoreSnippets';
import {useWorkspaceScratchpad} from '../hooks/useWorkspaceScratchpad';
import {useWorkspaceCorkboard} from '../hooks/useWorkspaceCorkboard';
import {useSceneRosterPreferences} from '../hooks/useSceneRosterPreferences';
import {buildKnownLoreHighlights} from '../services/consistency/knownLoreHighlights';
import {PageHeader} from '../components/PageHeader';
import {RouteFeedback} from '../components/common';
import {useNotificationStore} from '../store/notificationStore';
import {GettingStartedGuide} from '../components/Onboarding/GettingStartedGuide';
import {
  useWorkspaceSceneRoster,
  type PendingInventoryCapture,
  type PendingPositionedChange
} from '../hooks/useWorkspaceSceneRoster';
import {getSceneOrder} from '../services/state/characterSnapshot';
import {WorkspaceCharacterLabDialogs} from '../components/Workspace/WorkspaceCharacterLabDialogs';
import {WorkspaceSceneDraftEntry} from '../components/Workspace/WorkspaceSceneDraftEntry';

declare global {
  interface Window {
    __wbdWorkspaceMountedAt?: number;
    __wbdWorkspaceRenderCount?: number;
    __wbdWorkspaceUnmountedAt?: number;
  }
}

type FeedbackTone = 'success' | 'error';

function WorkspaceRoute() {
  const activeProject = useAppStore((s) => s.activeProject);
  const navigate = useNavigate();
  const location = useLocation();
  const sceneTitleInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<WritingDocument[]>([]);
  const [loadedDocumentsProjectId, setLoadedDocumentsProjectId] = useState<
    string | null
  >(null);
  const seriesBibleConfig = activeProject
    ? getSeriesBibleConfig(activeProject)
    : null;
  const documentsLoaded =
    Boolean(activeProject) && loadedDocumentsProjectId === activeProject?.id;
  const [feedback, setFeedback] = useState<{
    tone: FeedbackTone;
    message: string;
  } | null>(null);
  const corkboard = useWorkspaceCorkboard(activeProject?.id ?? null);
  const {
    isScratchpadModalOpen,
    setScratchpadModalOpen,
    isCorkboardModalOpen,
    setCorkboardModalOpen,
    isStatBlockModalOpen,
    setStatBlockModalOpen
  } = useWorkspaceModalUi();
  const {systemHistoryEntries, refreshSystemHistory, addSystemHistory} =
    useWorkspaceSystemHistory(activeProject?.id ?? null);
  const [worldCaptureDrafts, setWorldCaptureDrafts] = useState<Record<string, string>>({});
  const [manualWorldCapture, setManualWorldCapture] = useState<{
    sourceText: string;
    draftText: string;
    left: number;
    top: number;
  } | null>(null);
  const [manualExistingTargetId, setManualExistingTargetId] = useState('');
  const [rejectedAliasSuggestions, setRejectedAliasSuggestions] = useState<
    Record<string, string[]>
  >({});
  const [isReviewBannerDismissed, setReviewBannerDismissed] = useState(false);
  const [sceneRosterStateMoment, setSceneRosterStateMoment] = useState<
    'opening' | 'cursor' | 'ending'
  >('opening');
  const [sceneCursorPosition, setSceneCursorPosition] = useState(1);
  const [labEntityId, setLabEntityId] = useState<string | null>(null);
  const [sceneLabEntityId, setSceneLabEntityId] = useState<string | null>(null);
  const [sceneCursorSnapshot, setSceneCursorSnapshot] = useState<EditorTextSnapshot>({
    text: '',
    spans: []
  });
  const [sceneCursorAnchor, setSceneCursorAnchor] = useState<StateMutationTextAnchor>({
    before: '',
    after: ''
  });
  const [pendingPositionedChange, setPendingPositionedChange] =
    useState<PendingPositionedChange | null>(null);
  const [isSavingPositionedChange, setSavingPositionedChange] = useState(false);
  const [pendingInventoryCapture, setPendingInventoryCapture] =
    useState<PendingInventoryCapture | null>(null);
  const [isSavingInventoryCapture, setSavingInventoryCapture] = useState(false);
  const {
    scratchpadContent,
    setScratchpadContent,
    scratchpadStatus,
    scratchpadLastSavedAt
  } = useWorkspaceScratchpad(activeProject?.id ?? null);
  const {
    sceneDrawerDialogRef,
    contextDrawerDialogRef,
    isNarrowViewport,
    isSceneDrawerOpen,
    setSceneDrawerOpen,
    isContextDrawerOpen,
    setContextDrawerOpen,
    activeContextView,
    setActiveContextView,
    closeSceneDrawer,
    closeContextDrawer,
    toggleSceneDrawer,
    toggleContextDrawer,
    openContextDrawer
  } = useWorkspaceDrawers({
    activeProjectId: activeProject?.id ?? null
  });

  useEffect(() => {
    window.__wbdWorkspaceMountedAt = Date.now();
    window.__wbdWorkspaceRenderCount = 0;
    return () => {
      window.__wbdWorkspaceUnmountedAt = Date.now();
    };
  }, []);

  // Lightweight diagnostics only, no state updates.
  useEffect(() => {
    window.__wbdWorkspaceRenderCount = (window.__wbdWorkspaceRenderCount ?? 0) + 1;
  });
  const openScratchpadModal = useCallback(() => {
    setScratchpadModalOpen(true);
  }, [setScratchpadModalOpen]);
  const closeScratchpadModal = useCallback(() => {
    setScratchpadModalOpen(false);
  }, [setScratchpadModalOpen]);
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
  const {requestConfirm, confirmDialog} = useConfirmDialog();
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
    editorScrollResetToken,
    isSelectedDocumentInitialized,
    selectedDocument,
    importInputRef,
    isImportingDocuments,
    handleNewDocument,
    handleImportDocuments,
    handleRetryFailedImports,
    handleSelectDocument,
    handleMoveDocument,
    openExportModal,
    handleExportScenes,
    handleSave,
    handleDelete,
    handleContentChange
  } = useWorkspaceDocuments({
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
  });
  useEffect(() => {
    setSceneCursorPosition(1);
    setSceneRosterStateMoment('opening');
    setPendingPositionedChange(null);
  }, [selectedId]);
  const {
    isExportModalOpen,
    exportFormat,
    exportSelection,
    closeExportModal,
    moveExportItem,
    toggleExportItem,
    toggleAllExportItems
  } = useWorkspaceExportUi();
  const {
    importMode,
    setImportMode,
    skipImportSuggestions,
    setSkipImportSuggestions,
    importSummary,
    setImportSummary,
    retryImportFiles,
    setRetryImportFiles
  } = useWorkspaceImportUi();
  const {isCreatingScene, deletingDocumentId} = useWorkspaceSceneOperationUi();
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

  const resetContextActionsRef = useRef<() => void>(() => undefined);
  const handleProjectReset = useCallback(() => {
    resetContextActionsRef.current();
    setWorldCaptureDrafts({});
    setManualWorldCapture(null);
    setPendingInventoryCapture(null);
    setManualExistingTargetId('');
    setReviewBannerDismissed(false);
  }, []);

  const projectData = useWorkspaceProjectData({
    activeProject,
    setDocuments,
    onDocumentsLoaded: setLoadedDocumentsProjectId,
    setImportMode,
    setSkipImportSuggestions,
    refreshSystemHistory,
    onProjectReset: handleProjectReset
  });
  const {
    editorConfig,
    toolbarButtons,
    projectSettings,
    saveProjectSettings,
    entities,
    setEntities,
    categories,
    setCategories,
    aliases,
    setAliases,
    resolvedActionCues,
    characters,
    characterSheets,
    actorResolutions,
    compendiumEntries,
    ruleset,
    settlementState,
    settlementModules,
    ragService,
    canonState,
    setCanonState,
    stateMutationEvents,
    canonicalFacts,
    statBlockInsertContent,
    setStatBlockInsertContent,
  } = projectData;
  const {
    activeAIContext,
    clearAIContext,
    consumePendingAIInsert,
    pendingAIInsert,
    previewSceneRevision,
    setPendingAIInsert,
    insertAIProse,
    queuedAssistantPrompt,
    setQueuedAssistantPrompt,
    activeLoreRecord,
    consultationBudget,
    resetContextActions,
    handleOpenAIContext,
    handleOpenLoreInspector,
    handleConsultationFromLore
  } = useWorkspaceContextActions({
    activeProjectId: activeProject?.id ?? null,
    projectSettings,
    content,
    selectedId,
    openContextDrawer,
    onSceneRevisionPreview: () => { if (isNarrowViewport) closeContextDrawer(); }
  });
  const selectionActionRun = useSelectionActionRun({
    projectId: activeProject?.id ?? null, aiSettings: projectSettings?.aiSettings, documentId: selectedId,
    sceneTitle: title, content, documents, setPendingAIInsert,
    onSceneRevisionPreview: () => { if (isNarrowViewport) closeContextDrawer(); }
  });
  useLayoutEffect(() => {
    resetContextActionsRef.current = resetContextActions;
  }, [resetContextActions]);
  const {getOverrides: getSceneRosterOverrides, updateOverride: updateSceneRosterOverride} =
    useSceneRosterPreferences(activeProject?.id ?? null);
  const worldEngine = useMemo(
    () =>
      getWorldEngine(
        projectSettings?.aiSettings?.inspectorSettings?.reviewEngineMode ??
          'deterministic',
        projectSettings?.aiSettings
      ),
    [projectSettings?.aiSettings]
  );

  const staleStateEventCountBySceneId = useMemo(() => {
    const counts: Record<string, number> = {};
    stateMutationEvents.forEach((event) => {
      if (event.status !== 'accepted') {
        return;
      }
      const staleness = getStateMutationEventStaleness({
        event,
        documents
      });
      if (!staleness.isStale) {
        return;
      }
      counts[event.sceneId] = (counts[event.sceneId] ?? 0) + 1;
    });
    return counts;
  }, [documents, stateMutationEvents]);
  const consistency = useWorkspaceConsistency({
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
    canonicalFacts,
    characterSheets,
    actorResolutions,
    ruleset,
    stateMutationEvents,
    selectedDocumentId: selectedId,
    projectSettings,
    saveProjectSettings,
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
  const {
    setGuardrailIssues,
    resolverNotice,
    setResolverNotice,
    consistencyReviewItems,
    consistencyPopover,
    setConsistencyPopover,
    persistDoc,
    refreshDeferredReview,
    refreshActiveDraftReview,
    handleRunConsistencyReview,
    unknownGuardrailIssues,
    hasBlockingUnknownGuardrailIssues,
    highlightableReviewIssues,
    isReviewPrefsHydrated,
    resolveAllUnknownEntities,
    dismissAllUnknownEntities,
    activeConsistencyPopoverIssue,
    reviewReadiness,
    openConsistencyPopover
  } = consistency;
  const reviewItemCountBySceneId = useMemo(() => {
    const counts: Record<string, number> = {};
    consistencyReviewItems.forEach((item) => {
      counts[item.sceneId] = (counts[item.sceneId] ?? 0) + 1;
    });
    return counts;
  }, [consistencyReviewItems]);
  const runConsistencyReviewFromUi = useCallback(async () => {
    setReviewBannerDismissed(false);
    await handleRunConsistencyReview();
  }, [handleRunConsistencyReview]);
  const clearFeedback = useCallback(() => setFeedback(null), []);
  const pushToast = useNotificationStore((state) => state.pushToast);
  useWorkspaceResolverNotice({resolverNotice, setResolverNotice, navigate});
  const chapterCardLinks = useWorkspaceChapterCardLinks({
    corkboard,
    setCorkboardModalOpen,
    createDocument: handleNewDocument,
    selectedDocument,
    sceneTitleInputRef,
    navigate,
    location
  });
  const {openCorkboardModal, closeCorkboardModal} = chapterCardLinks;
  useLayoutEffect(() => {
    persistDocRef.current = persistDoc;
    refreshDeferredReviewRef.current = refreshDeferredReview;
    setGuardrailIssuesRef.current =
      setGuardrailIssues as typeof setGuardrailIssuesRef.current;
    setConsistencyPopoverRef.current =
      setConsistencyPopover as typeof setConsistencyPopoverRef.current;
    deleteDocumentSideEffectsRef.current = async (docId: string) => {
      await Promise.all([
        ragService?.deleteDocument(docId) ?? Promise.resolve(),
        shodhService?.deleteMemoriesForDocument(docId) ?? Promise.resolve()
      ]);
      await refreshMemories();
    };
  }, [
    persistDoc,
    ragService,
    refreshDeferredReview,
    refreshMemories,
    setConsistencyPopover,
    setGuardrailIssues,
    shodhService
  ]);

  const openWorldRecord = (target: {id: string; type: 'character' | 'entity'}) => {
    if (target.type === 'entity') {
      navigate('/world-bible', {state: {focusEntityId: target.id}});
      return;
    }
    navigate('/world-bible', {state: {focusCategorySlug: 'characters'}});
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
  const selectedSceneOrder = selectedDocument
    ? getSceneOrder(documents, selectedDocument.id)
    : 0;
  const statBlocks = useWorkspaceStatBlocks({
    activeProject,
    projectSettings,
    saveProjectSettings,
    choices: projectData,
    isStatBlockModalOpen,
    setStatBlockModalOpen,
    characterSheets,
    stateMutationEvents,
    actorResolutions,
    sceneOrder: selectedSceneOrder,
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
  const {
    statDefinitionNameById,
    resourceDefinitionNameById,
    resolveCharacterBlock,
    resolveItemBlock,
    getStatBlockTokenPresentation,
    getStatBlockPreviewData,
    handleRefreshStatTemplates,
    openStatBlockRebind
  } = statBlocks;
  const sceneRoster = useWorkspaceSceneRoster({
    activeProject,
    selectedDocument,
    documents,
    content,
    categories,
    characters,
    entities,
    characterSheets,
    actorResolutions,
    aliases,
    ruleset,
    stateMutationEvents,
    runtimeModifiers,
    statDefinitionNameById,
    resourceDefinitionNameById,
    compendiumEntries,
    getSceneRosterOverrides,
    updateSceneRosterOverride,
    sceneRosterStateMoment,
    setSceneRosterStateMoment,
    sceneCursorPosition,
    setSceneCursorPosition,
    sceneCursorSnapshot,
    setSceneCursorAnchor,
    sceneCursorAnchor,
    pendingPositionedChange,
    setPendingPositionedChange,
    setSavingPositionedChange,
    pendingInventoryCapture,
    setPendingInventoryCapture,
    setSavingInventoryCapture,
    setFeedback,
    requestConfirm
  });
  const {
    sceneRosterModel,
    addSceneRosterEntry,
    openSelectionInventoryCapture,
    openDetectedItemStateProposal,
    sceneRosterTimeline,
    hideSceneRosterEntry,
    recordSceneRosterChangeHere,
    consumeSceneRosterItemHere,
    expireSceneRosterTimelineEvent,
    editSceneRosterTimelineEvent,
    invalidateSceneRosterTimelineEvent,
    reanchorSceneRosterTimelineEvent,
    selectedSceneTimeline,
    getCharacterStatSnapshot,
    getCharacterStatSnapshotAt
  } = sceneRoster;
  const editStateMutationReviewItem = useCallback(
    (item: StateMutationReviewItem) => {
      const document = documents.find((entry) => entry.id === item.sceneId);
      if (document) handleSelectDocument(document);
      openDetectedItemStateProposal(item.id);
    },
    [documents, handleSelectDocument, openDetectedItemStateProposal]
  );
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

    addSystemHistory({
      category: 'quest',
      message,
      insertText: `Quest Update: ${message}`,
      sourceKey: `party-synergy:${activeRules.join('|')}`,
      createdAt: Date.now()
    });
    refreshSystemHistory();
  }, [activeProject, activePartySynergies, addSystemHistory, refreshSystemHistory]);
  const capabilities = getProjectCapabilities(projectSettings);
  const showGameSystems = capabilities.canUseGameSystems;
  const showRuleAuthoring = capabilities.canUseRuleAuthoring;
  const isGeneralFictionProject = capabilities.isGeneralFiction;
  const {characterStatPeek, statPeekRequest} = useWorkspaceCharacterStatPeek({
    activeProject,
    showGameSystems,
    selectedDocument,
    selectedSceneOrder,
    sceneCursorPosition,
    characterSheets,
    entities,
    aliases,
    statBlockPreferences: projectSettings?.statBlockPreferences,
    getCharacterStatSnapshot,
    getCharacterStatSnapshotAt
  });
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
    hasBlockingUnknownGuardrailIssues && !isReviewBannerDismissed;
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
  const selectionQuickSnippets = useWorkspaceLoreSnippets({
    activeProject,
    categories,
    characters,
    characterSheets,
    entities,
    canonicalFacts,
    aliases,
    systemHistoryEntries,
    projectSettings,
    resolveCharacterBlock,
    resolveItemBlock
  });
  const knownWorldBibleLoreHighlights = useMemo(
    () => buildKnownLoreHighlights({entities, aliases, categories}),
    [aliases, categories, entities]
  );
  const toolbarActions = useMemo(
    () => showGameSystems ? [
      {
        id: 'insert-status-block', label: 'Insert Status Block',
        onClick: () => setStatBlockModalOpen(true)
      },
      {
        id: 'refresh-placeholders', label: 'Refresh Placeholders',
        onClick: handleRefreshStatTemplates
      }
    ] : [],
    [handleRefreshStatTemplates, setStatBlockModalOpen, showGameSystems]
  );

  const {
    workspaceRootRef,
    focusRequest,
    focusQuery,
    activeReviewItemId,
    focusReviewItemInScene
  } = useWorkspaceDrawerFocus({
    activeProjectId: activeProject?.id ?? null,
    selectedId,
    documents,
    content,
    editorScrollResetToken,
    isContextDrawerOpen,
    handleSelectDocument,
    setActiveContextView,
    setContextDrawerOpen
  });

  useWorkspaceReviewRefresh({
    selectedId, selectedDocument, isSelectedDocumentInitialized,
    title, content, entities, aliases, characters,
    isReviewPrefsHydrated, refreshDeferredReview, refreshActiveDraftReview
  });

  useEffect(() => {
    if (!showGameSystems && activeContextView === 'compendium') {
      setActiveContextView('world-bible');
    }
  }, [showGameSystems, activeContextView, setActiveContextView]);


  const isMemoryDialogOpen = Boolean(isMemoryModalOpen && selectedDocument);
  const closeMemoryDialog = useCallback(() => {
    setMemoryModalOpen(false);
  }, [setMemoryModalOpen]);




  const {isPromotingDocument, handlePromoteDocument, isSyncingCanon, handleCanonSync} =
    useWorkspaceSeriesCanon({
      activeProject,
      seriesBibleConfig,
      selectedDocument,
      setCanonState,
      addSystemHistory,
      setFeedback
    });

  useWorkspaceCommands({
    handleNewDocument,
    handleSave,
    openScratchpadModal,
    openCorkboardModal,
    toggleSceneDrawer,
    toggleContextDrawer,
    openContextDrawer,
    showRuleAuthoring,
    showGameSystems,
    runConsistencyReviewFromUi,
    openExportModalWithDrawerHandling,
    openMemoryModal
  });

  const handleOpenManualWorldCapture = useCallback(
    (draftText: string, anchorRect: {left: number; top: number; bottom: number}) => {
      setManualExistingTargetId('');
      setManualWorldCapture({
        sourceText: draftText,
        draftText,
        left: anchorRect.left,
        top: anchorRect.bottom + 8
      });
    },
    []
  );


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

  const sceneDrawerProps: ComponentProps<typeof WorkspaceSceneDrawer> = {
    handleNewDocument, isCreatingScene, isImportingDocuments, openImportPicker,
    importMode, setImportMode, skipImportSuggestions, setSkipImportSuggestions,
    openExportModalWithDrawerHandling, documents,
    importSummary, setImportSummary, retryImportFiles, setRetryImportFiles,
    handleRetryFailedImports, selectedId, handleSelectDocument, handleMoveDocument,
    handleDelete, deletingDocumentId, reviewItemCountBySceneId,
    staleStateEventCountBySceneId,
    selectedSceneTimeline
  };
  const contextDrawerProps: ComponentProps<typeof WorkspaceContextDrawer> = {
    activeContextView, setActiveContextView, showGameSystems, showRuleAuthoring,
    entities, categories, ruleset, characters, characterSheets,
    onOpenCharacterLab: setLabEntityId,
    onOpenCharacterScene: setSceneLabEntityId,
    sceneRosterTitle: sceneRosterModel.sceneTitle,
    sceneRosterCharacters: sceneRosterModel.characters,
    sceneRosterItems: sceneRosterModel.items,
    sceneRosterAddOptions: sceneRosterModel.addOptions,
    sceneRosterAmbiguousSurfaces: sceneRosterModel.ambiguousSurfaces,
    addSceneRosterEntry, hideSceneRosterEntry, sceneRosterStateMoment,
    sceneRosterCursorPosition: sceneCursorPosition,
    setSceneRosterStateMoment, recordSceneRosterChangeHere, consumeSceneRosterItemHere,
    sceneRosterTimeline, editSceneRosterTimelineEvent,
    invalidateSceneRosterTimelineEvent, reanchorSceneRosterTimelineEvent,
    expireSceneRosterTimelineEvent,
    review: {
      consistency,
      onRunReview: runConsistencyReviewFromUi,
      editStateMutationReviewItem,
      onFocusReviewItem: focusReviewItemInScene,
      activeReviewItemId,
      createLabel: reviewCreateLabel,
      linkLabel: reviewLinkLabel,
      worldCaptureDrafts,
      setWorldCaptureDrafts
    },
    documents, handleSelectDocument, openWorldRecord,
    scratchpadContent, setScratchpadContent, scratchpadStatus, scratchpadLastSavedAt,
    activeProject, projectSettings, activeAIContext, clearAIContext, setPendingAIInsert, previewSceneRevision,
    queuedAssistantPrompt, setQueuedAssistantPrompt, ragService, systemHistoryEntries,
    setFeedback, refreshSystemHistory, activeLoreRecord, consultationBudget,
    handleConsultationFromLore,
    settlementModuleCount: settlementModules.length,
    activePartySynergyCount: activePartySynergies.length,
    selectedId, sceneContent: content, memoryCandidates, memoryFilter, setMemoryFilter,
    memoryScope, setMemoryScope, scopeLabel, refreshMemories,
    handleDeleteMemory, emptyMemoryMessage, seriesBibleConfig,
    handlePromoteMemory, isPromotingMemoryId
  };

  return (
    <section
      data-workspace-root='true'
      data-wbd-scroll-key='workspace-root'
      className={styles.workspaceRoot}
      ref={workspaceRootRef}
    >
      <input
        ref={importInputRef}
        type='file'
        accept='.txt,.md,.markdown,.html,.htm,.docx,.doc,.pages,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
        multiple
        onChange={(e) => void handleImportDocuments(e)}
        style={{display: 'none'}}
      />
      <PageHeader
        eyebrow='Current manuscript'
        title='Writing Workspace'
        meta={
          <span className={styles.workspaceHeaderMeta}>
            {activeProject.name}
            {selectedDocument ? ` · ${selectedDocument.title || 'Untitled scene'}` : ''}
            <WorkspaceChapterCardContext
              cards={chapterCardLinks.linkedChapterCards}
              onOpenCard={chapterCardLinks.handleOpenChapterCard}
              onOpenCorkboard={chapterCardLinks.handleOpenChapterCardRoute}
            />
          </span>
        }
        actions={
          <>
            <button
              type='button'
              className={`${styles.reviewIndicator} ${styles[`reviewIndicator_${reviewReadiness.state}`]}`}
              onClick={() => openContextDrawer('review')}
              title={reviewReadiness.detail}
              aria-label={`Open review drawer, ${reviewReadiness.label}: ${reviewReadiness.detail}`}
            >
              <span className={styles.reviewIndicatorDot} />
              <span>{reviewReadiness.label}</span>
            </button>
            <button
              type='button'
              className={styles.scratchpadHeaderButton}
              onClick={openScratchpadModal}
            >
              Scratchpad
            </button>
          </>
        }
      />
      <GettingStartedGuide projectId={activeProject.id} />
      <RouteFeedback feedback={feedback} onClear={clearFeedback} errorsAsToast />
      {showReviewBanner && (
        <UnknownEntityPanel
          hiddenReviewSurfaceCount={hiddenReviewSurfaceCount}
          issueCount={unknownGuardrailIssues.length}
          onDismissAll={() => dismissAllUnknownEntities(selectedId ?? undefined)}
          onDismissNotice={() => setReviewBannerDismissed(true)}
          onResolveAll={resolveAllUnknownEntities}
          reviewBannerBody={reviewBannerBody}
          reviewBannerTitle={reviewBannerTitle}
          reviewCreateAllLabel={reviewCreateAllLabel}
          reviewDismissAllLabel={reviewDismissAllLabel}
          visibleReviewSurfaces={visibleReviewSurfaces}
        />
      )}
      {seriesBibleConfig?.parentProjectId && (
        <CanonPanel
          childLastSynced={canonState.childLastSynced}
          isSyncingCanon={isSyncingCanon}
          onSync={handleCanonSync}
          parentCanonVersion={canonState.parentCanonVersion}
          parentName={canonState.parentName}
        />
      )}

      <WorkspaceDrawerLayout
        isNarrowViewport={isNarrowViewport}
        isSceneDrawerOpen={isSceneDrawerOpen}
        isContextDrawerOpen={isContextDrawerOpen}
        sceneDrawerDialogRef={sceneDrawerDialogRef}
        contextDrawerDialogRef={contextDrawerDialogRef}
        closeSceneDrawer={closeSceneDrawer}
        closeContextDrawer={closeContextDrawer}
        sceneDrawerProps={sceneDrawerProps}
        contextDrawerProps={contextDrawerProps}
      >
        <div className={styles.editorColumn} data-wbd-scroll-key='workspace-editor-column'>
          {!documentsLoaded || (selectedId && !isSelectedDocumentInitialized) ? (
            <div className={styles.emptyWorkspaceState} role='status'>
              Loading scenes…
            </div>
          ) : selectedId ? (
            <>
              <div className={styles.editorTitleRow}>
                <label>
                  Title
                  <br />
                  <input
                    ref={sceneTitleInputRef}
                    type='text'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{width: '100%'}}
                  />
                </label>
                <WorkspaceSceneDraftEntry
                  key={selectedId} projectId={activeProject.id} sceneId={selectedId} sceneTitle={title}
                  content={content} aiSettings={projectSettings?.aiSettings} onInsert={insertAIProse}
                />
              </div>

              <div className={styles.editorPane} data-wbd-scroll-key='workspace-editor-pane'>
                <WorkspaceSelectionActionPanel controller={selectionActionRun} />
                <EditorWithAI
                  projectId={activeProject.id}
                  documentId={selectedId}
                  content={content}
                  focusQuery={focusQuery}
                  focusToken={focusRequest?.token ?? 0}
                  resetScrollToken={editorScrollResetToken}
                  onChange={handleContentChange}
                  onWordCountChange={setWordCount}
                  onCursorContextChange={({position, snapshot, anchor}) => {
                    setSceneCursorPosition(position);
                    setSceneCursorSnapshot(snapshot);
                    setSceneCursorAnchor(anchor);
                  }}
                  inlineHighlightsMode={
                    projectSettings?.editorFeedback?.inlineHighlightsMode ?? 'visible'
                  }
                  consistencyHighlights={highlightableReviewIssues}
                  onConsistencyHighlightClick={(issueId, anchorRect) => {
                    const issue = highlightableReviewIssues.find(
                      (entry) => entry.id === issueId
                    );
                    if (!issue) return;
                    if (issue.issueCode === 'STATE_CONFLICT') {
                      const reviewItem = consistencyReviewItems.find(
                        (item) => item.id === issueId
                      );
                      if (reviewItem) {
                        focusReviewItemInScene(reviewItem);
                      }
                      return;
                    }
                    openConsistencyPopover(issueId, anchorRect, issue.surface);
                  }}
                  config={editorConfig}
                  toolbarButtons={toolbarButtons}
                  toolbarActions={toolbarActions}
                  textToInsert={pendingAIInsert?.text ?? statBlockInsertContent}
                  insertContext={pendingAIInsert?.context ?? null}
                  insertProvenance={pendingAIInsert?.provenance}
                  sceneRevision={pendingAIInsert?.revision}
                  onTextInserted={() => { if (!consumePendingAIInsert()) setStatBlockInsertContent(null); }}
                  selectionQuickSnippets={selectionQuickSnippets}
                  knownLoreHighlights={knownWorldBibleLoreHighlights}
                  characterStatPeek={characterStatPeek}
                  statPeekRequest={statPeekRequest}
                  presentStatBlockToken={getStatBlockTokenPresentation}
                  getStatBlockPreviewData={getStatBlockPreviewData}
                  onRebindStatBlockToken={openStatBlockRebind}
                  onOpenAIContext={handleOpenAIContext}
                  selectionActions={selectionActionRun.menu}
                  onOpenLoreInspector={handleOpenLoreInspector}
                  onOpenWorldCapture={handleOpenManualWorldCapture}
                  onAddSelectionToInventory={isGeneralFictionProject
                    ? undefined
                    : openSelectionInventoryCapture}
                  suppressSelectionBubble={Boolean(manualWorldCapture)}
                  aiContextPassage={activeAIContext?.id === selectedId ? activeAIContext : null}
                />
                {consistencyPopover && activeConsistencyPopoverIssue && (
                  <WorkspaceReviewSurfacePopover
                    surface={activeConsistencyPopoverIssue.surface}
                    left={consistencyPopover.left} top={consistencyPopover.top}
                    message={reviewPopoverMessage} createLabel={reviewCreateLabel} linkLabel={reviewLinkLabel}
                    categories={categories} selectedSceneId={selectedId}
                    worldCaptureDrafts={worldCaptureDrafts} setWorldCaptureDrafts={setWorldCaptureDrafts}
                    rejectedAliasSuggestions={rejectedAliasSuggestions}
                    setRejectedAliasSuggestions={setRejectedAliasSuggestions}
                    consistency={consistency} onClose={() => setConsistencyPopover(null)}
                  />
                )}
                {manualWorldCapture && (
                  <WorkspaceManualWorldCapturePopover
                    capture={manualWorldCapture} setCapture={setManualWorldCapture}
                    createLabel={reviewCreateLabel} categories={categories} characters={characters}
                    entities={entities} entitySnippets={selectionQuickSnippets.entities}
                    existingTargetId={manualExistingTargetId} setExistingTargetId={setManualExistingTargetId}
                    rejectedAliasSuggestions={rejectedAliasSuggestions}
                    setRejectedAliasSuggestions={setRejectedAliasSuggestions}
                    consistency={consistency}
                    onMatchedExisting={(message) => setFeedback({tone: 'success', message})}
                  />
                )}
              </div>

              <div className={styles.editorFooterBar} data-stat-panel-avoid=''>
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
                    aria-label='Open quick Corkboard'
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

      </WorkspaceDrawerLayout>

      <WorkspaceSceneStateDialogs
        sceneRoster={sceneRoster}
        sceneTitle={selectedDocument?.title || 'Current scene'}
        sceneCursorPosition={sceneCursorPosition}
        ruleset={ruleset}
        categories={categories}
        entities={entities}
        compendiumEntries={compendiumEntries}
        pendingPositionedChange={pendingPositionedChange}
        setPendingPositionedChange={setPendingPositionedChange}
        isSavingPositionedChange={isSavingPositionedChange}
        pendingInventoryCapture={pendingInventoryCapture}
        setPendingInventoryCapture={setPendingInventoryCapture}
        isSavingInventoryCapture={isSavingInventoryCapture}
      />

      <WorkspaceStatBlockModal
        isOpen={isStatBlockModalOpen} statBlocks={statBlocks}
        characterSheets={characterSheets} entities={entities} navigate={navigate}
      />

      <WorkspaceScratchpadModal
        isOpen={isScratchpadModalOpen}
        content={scratchpadContent} statusLabel={scratchpadStatusLabel}
        isNarrowViewport={isNarrowViewport} setContent={setScratchpadContent}
        setActiveContextView={setActiveContextView}
        setContextDrawerOpen={setContextDrawerOpen}
        setSceneDrawerOpen={setSceneDrawerOpen} onClose={closeScratchpadModal}
      />

      <WorkspaceCorkboardModal
        isOpen={isCorkboardModalOpen}
        corkboard={corkboard}
        documents={documents}
        currentDocumentId={selectedDocument?.id}
        focusCardId={chapterCardLinks.focusCorkboardCardId}
        onFocusCardHandled={chapterCardLinks.clearFocusCorkboardCard}
        onClose={closeCorkboardModal}
        onOpenScratchpad={openScratchpadModal}
        onCurrentSceneAction={(message) => pushToast({tone: 'success', message})}
        onCreateLinkedScene={(card) => void chapterCardLinks.handleCreateLinkedScene(card)}
        creatingLinkedSceneCardId={chapterCardLinks.creatingLinkedSceneCardId}
      />

      <WorkspaceExportModal
        isOpen={isExportModalOpen}
        format={exportFormat} selection={exportSelection}
        onClose={closeExportModal} onMove={moveExportItem}
        onToggle={toggleExportItem} onToggleAll={toggleAllExportItems}
        onExport={handleExportScenes}
      />
      <WorkspaceAITextReportModal
        documents={documents} selectedId={isSelectedDocumentInitialized ? selectedId : null}
        selectedTitle={title} selectedContent={content} onOpenScene={handleSelectDocument}
      />


      <WorkspaceMemoryModal
        isOpen={isMemoryDialogOpen}
        draft={memoryDraft} isSaving={isSavingMemory} setDraft={setMemoryDraft}
        onClose={closeMemoryDialog} onSave={handleMemorySave}
      />

      <WorkspaceCharacterLabDialogs
        projectId={activeProject.id} selectedSceneId={selectedId} cursorPosition={sceneCursorPosition}
        labEntityId={labEntityId} sceneLabEntityId={sceneLabEntityId}
        onCloseLab={() => setLabEntityId(null)} onCloseSceneLab={() => setSceneLabEntityId(null)}
        onInsertAtCursor={insertAIProse}
      />

      {confirmDialog}
    </section>
  );
}

export default WorkspaceRoute;
