import {type ComponentProps, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
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
import {getEffectiveResourceValues, getEffectiveStatValue} from '../services/compendium';
import {useWorkspaceRuntimeModifiers} from '../hooks/useWorkspaceRuntimeModifiers';
import {getSeriesBibleConfig} from '../services/seriesBible/SeriesBibleService';
import {useWorkspaceResolverNotice} from '../hooks/useWorkspaceResolverNotice';
import {useWorkspaceChapterCardLinks} from '../hooks/useWorkspaceChapterCardLinks';
import {useWorkspaceCharacterStatPeek} from '../hooks/useWorkspaceCharacterStatPeek';
import {useWorkspaceSeriesCanon} from '../hooks/useWorkspaceSeriesCanon';
import {getWorldEngine} from '../services/worldEngine';
import {getWorkspaceReviewCopy, summarizeReviewSurfaces} from '../services/workspace/workspaceReviewCopy';
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
import {WorkspaceHeader} from '../components/Workspace/WorkspaceHeader';
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
import {WorkspaceEditorFooter} from '../components/Workspace/WorkspaceEditorFooter';
import {WorkspaceEmptyState} from '../components/Workspace/WorkspaceEmptyState';
import {
  countReviewItemsByScene,
  countStaleStateEventsByScene
} from '../services/workspace/sceneDrawerBadges';
import {useWorkspaceSceneCursor} from '../hooks/useWorkspaceSceneCursor';
import {useWorkspaceRenderDiagnostics} from '../hooks/useWorkspaceRenderDiagnostics';
import {useConnectDocumentReviewBridge, useDocumentReviewBridge} from '../hooks/useWorkspaceDocumentReviewBridge';
import {useWorkspaceManualWorldCapture} from '../hooks/useWorkspaceManualWorldCapture';
import {useWorkspaceProjectData} from '../hooks/useWorkspaceProjectData';
import {useWorkspaceLoreSnippets} from '../hooks/useWorkspaceLoreSnippets';
import {useWorkspaceScratchpad} from '../hooks/useWorkspaceScratchpad';
import {useWorkspaceCorkboard} from '../hooks/useWorkspaceCorkboard';
import {useSceneRosterPreferences} from '../hooks/useSceneRosterPreferences';
import {buildKnownLoreHighlights} from '../services/consistency/knownLoreHighlights';
import {RouteFeedback} from '../components/common';
import {useNotificationStore} from '../store/notificationStore';
import {GettingStartedGuide} from '../components/Onboarding/GettingStartedGuide';
import {useWorkspaceSceneRoster} from '../hooks/useWorkspaceSceneRoster';
import {getSceneOrder} from '../services/state/characterSnapshot';
import {WorkspaceCharacterLabDialogs} from '../components/Workspace/WorkspaceCharacterLabDialogs';
import {WorkspaceSceneDraftEntry} from '../components/Workspace/WorkspaceSceneDraftEntry';

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
  const manualWorldCapture = useWorkspaceManualWorldCapture();
  const resetManualWorldCapture = manualWorldCapture.reset;
  const [rejectedAliasSuggestions, setRejectedAliasSuggestions] = useState<
    Record<string, string[]>
  >({});
  const [isReviewBannerDismissed, setReviewBannerDismissed] = useState(false);
  const [labEntityId, setLabEntityId] = useState<string | null>(null);
  const [sceneLabEntityId, setSceneLabEntityId] = useState<string | null>(null);
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

  useWorkspaceRenderDiagnostics();
  const openScratchpadModal = useCallback(() => {
    setScratchpadModalOpen(true);
  }, [setScratchpadModalOpen]);
  const closeScratchpadModal = useCallback(() => {
    setScratchpadModalOpen(false);
  }, [setScratchpadModalOpen]);
  const lastAutosaveErrorRef = useRef<string | null>(null);
  const documentReviewBridge = useDocumentReviewBridge();
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
    ...documentReviewBridge,
    setFeedback,
    requestConfirm,
    addSystemHistory
  });
  const sceneCursor = useWorkspaceSceneCursor(selectedId);
  const {
    sceneCursorPosition,
    sceneRosterStateMoment,
    setSceneRosterStateMoment,
    setPendingInventoryCapture
  } = sceneCursor;
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
    isMemoryDialogOpen,
    closeMemoryModal,
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
    resetManualWorldCapture();
    setPendingInventoryCapture(null);
    setReviewBannerDismissed(false);
  }, [resetManualWorldCapture, setPendingInventoryCapture]);

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

  const staleStateEventCountBySceneId = useMemo(
    () => countStaleStateEventsByScene(stateMutationEvents, documents),
    [documents, stateMutationEvents]
  );
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
  const reviewItemCountBySceneId = useMemo(
    () => countReviewItemsByScene(consistencyReviewItems),
    [consistencyReviewItems]
  );
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
  useConnectDocumentReviewBridge(documentReviewBridge, {
    persistDoc,
    refreshDeferredReview,
    setGuardrailIssues,
    setConsistencyPopover,
    ragService,
    shodhService,
    refreshMemories
  });

  const openWorldRecord = (target: {id: string; type: 'character' | 'entity'}) => {
    if (target.type === 'entity') {
      navigate('/world-bible', {state: {focusEntityId: target.id}});
      return;
    }
    navigate('/world-bible', {state: {focusCategorySlug: 'characters'}});
  };

  const {activePartySynergies, runtimeModifiers} = useWorkspaceRuntimeModifiers({
    activeProject,
    characters,
    settlementState,
    settlementModules,
    addSystemHistory,
    refreshSystemHistory
  });
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
    // Cursor position, roster moment, and the pending state-change dialogs.
    ...sceneCursor,
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
  const capabilities = getProjectCapabilities(projectSettings);
  const showGameSystems = capabilities.canUseGameSystems;
  const showRuleAuthoring = capabilities.canUseRuleAuthoring;
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
  const reviewCopy = getWorkspaceReviewCopy({
    usesPlainReviewLanguage: capabilities.usesPlainReviewLanguage,
    hasBlockingIssues: hasBlockingUnknownGuardrailIssues
  });
  const {visible: visibleReviewSurfaces, hiddenCount: hiddenReviewSurfaceCount} =
    summarizeReviewSurfaces(unknownGuardrailIssues);
  const showReviewBanner =
    hasBlockingUnknownGuardrailIssues && !isReviewBannerDismissed;
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
      createLabel: reviewCopy.createLabel,
      linkLabel: reviewCopy.linkLabel,
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
      <WorkspaceHeader
        projectName={activeProject.name}
        selectedDocument={selectedDocument}
        chapterCardLinks={chapterCardLinks}
        reviewReadiness={reviewReadiness}
        onOpenReview={() => openContextDrawer('review')}
        onOpenScratchpad={openScratchpadModal}
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
          reviewBannerBody={reviewCopy.bannerBody}
          reviewBannerTitle={reviewCopy.bannerTitle}
          reviewCreateAllLabel={reviewCopy.createAllLabel}
          reviewDismissAllLabel={reviewCopy.dismissAllLabel}
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
                  onCursorContextChange={sceneCursor.handleCursorContextChange}
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
                  onOpenWorldCapture={manualWorldCapture.open}
                  onAddSelectionToInventory={capabilities.canCaptureSelectionAsInventory
                    ? openSelectionInventoryCapture
                    : undefined}
                  suppressSelectionBubble={Boolean(manualWorldCapture.capture)}
                  aiContextPassage={activeAIContext?.id === selectedId ? activeAIContext : null}
                />
                {consistencyPopover && activeConsistencyPopoverIssue && (
                  <WorkspaceReviewSurfacePopover
                    surface={activeConsistencyPopoverIssue.surface}
                    left={consistencyPopover.left} top={consistencyPopover.top}
                    message={reviewCopy.popoverMessage} createLabel={reviewCopy.createLabel} linkLabel={reviewCopy.linkLabel}
                    categories={categories} selectedSceneId={selectedId}
                    worldCaptureDrafts={worldCaptureDrafts} setWorldCaptureDrafts={setWorldCaptureDrafts}
                    rejectedAliasSuggestions={rejectedAliasSuggestions}
                    setRejectedAliasSuggestions={setRejectedAliasSuggestions}
                    consistency={consistency} onClose={() => setConsistencyPopover(null)}
                  />
                )}
                {manualWorldCapture.capture && (
                  <WorkspaceManualWorldCapturePopover
                    capture={manualWorldCapture.capture} setCapture={manualWorldCapture.setCapture}
                    createLabel={reviewCopy.createLabel} categories={categories} characters={characters}
                    entities={entities} entitySnippets={selectionQuickSnippets.entities}
                    existingTargetId={manualWorldCapture.existingTargetId}
                    setExistingTargetId={manualWorldCapture.setExistingTargetId}
                    rejectedAliasSuggestions={rejectedAliasSuggestions}
                    setRejectedAliasSuggestions={setRejectedAliasSuggestions}
                    consistency={consistency}
                    onMatchedExisting={(message) => setFeedback({tone: 'success', message})}
                  />
                )}
              </div>

              <WorkspaceEditorFooter
                saveStatus={saveStatus}
                lastSavedAt={lastSavedAt}
                wordCount={wordCount}
                onSave={handleSave}
                canPromoteToParent={Boolean(seriesBibleConfig?.parentProjectId)}
                isPromotingDocument={isPromotingDocument}
                onPromoteDocument={handlePromoteDocument}
                onExtractMemory={openMemoryModal}
                onOpenScratchpad={openScratchpadModal}
                onOpenCorkboard={openCorkboardModal}
                onToggleSceneDrawer={toggleSceneDrawer}
                onToggleContextDrawer={toggleContextDrawer}
              />
            </>
          ) : (
            <WorkspaceEmptyState
              onNewScene={handleNewDocument}
              isCreatingScene={isCreatingScene}
              onImportDraft={openImportPicker}
              isImportingDocuments={isImportingDocuments}
              onOpenScratchpad={openScratchpadModal}
              onOpenCorkboard={openCorkboardModal}
              onToggleSceneDrawer={toggleSceneDrawer}
            />
          )}
        </div>

      </WorkspaceDrawerLayout>

      <WorkspaceSceneStateDialogs
        sceneRoster={sceneRoster}
        sceneCursor={sceneCursor}
        sceneTitle={selectedDocument?.title || 'Current scene'}
        ruleset={ruleset}
        categories={categories}
        entities={entities}
        compendiumEntries={compendiumEntries}
      />

      <WorkspaceStatBlockModal
        isOpen={isStatBlockModalOpen} statBlocks={statBlocks}
        characterSheets={characterSheets} entities={entities} navigate={navigate}
      />

      <WorkspaceScratchpadModal
        isOpen={isScratchpadModalOpen}
        content={scratchpadContent} status={scratchpadStatus} lastSavedAt={scratchpadLastSavedAt}
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
        onClose={closeMemoryModal} onSave={handleMemorySave}
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
