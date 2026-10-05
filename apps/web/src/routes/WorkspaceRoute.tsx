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
import type {ChapterCard, WritingDocument} from '../entityTypes';
import {EditorWithAI} from '../components/Editor/EditorWithAI';
import {useWorkspaceMemories} from '../hooks/useWorkspaceMemories';
import {useWorkspaceConsistency} from '../hooks/useWorkspaceConsistency';
import {useWorkspaceDocuments} from '../hooks/useWorkspaceDocuments';
import {useWorkspaceStatBlocks} from '../hooks/useWorkspaceStatBlocks';
import {useEscapeToClose} from '../hooks/useEscapeToClose';
import {useFocusTrap} from '../hooks/useFocusTrap';
import {useConfirmDialog} from '../hooks/useConfirmDialog';
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
import {useWorkspaceDrawers} from '../hooks/useWorkspaceDrawers';
import {useWorkspaceCommands} from '../hooks/useWorkspaceCommands';
import {useWorkspaceDrawerFocus} from '../hooks/useWorkspaceDrawerFocus';
import {
  summarizeContent,
  useWorkspaceContextActions
} from '../hooks/useWorkspaceContextActions';
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
import {PositionedStateChangeComposer} from '../components/Workspace/PositionedStateChangeComposer';
import {SceneInventoryCapture} from '../components/Workspace/SceneInventoryCapture';
import {SceneConsumptionCapture} from '../components/Workspace/SceneConsumptionCapture';
import {
  getStateMutationEventStaleness
} from '../services/state/stateMutationStaleness';
import {
  type EditorTextSnapshot,
  type StateMutationTextAnchor
} from '../services/state/stateMutationAnchor';
import {resolveReusableItem} from '../services/state/itemStateAuthoringService';
import {useWorkspaceProjectData} from '../hooks/useWorkspaceProjectData';
import {useWorkspaceLoreSnippets} from '../hooks/useWorkspaceLoreSnippets';
import {useWorkspaceScratchpad} from '../hooks/useWorkspaceScratchpad';
import {useWorkspaceCorkboard} from '../hooks/useWorkspaceCorkboard';
import {useChapterCardSceneActions} from '../hooks/useChapterCardSceneActions';
import {useSceneRosterPreferences} from '../hooks/useSceneRosterPreferences';
import {isItemCategory} from '../services/worldBible/worldBibleSummary';
import {PageHeader} from '../components/PageHeader';
import {RouteFeedback} from '../components/common';
import {useNotificationStore} from '../store/notificationStore';
import {GettingStartedGuide} from '../components/Onboarding/GettingStartedGuide';
import {
  useWorkspaceSceneRoster,
  type PendingInventoryCapture,
  type PendingPositionedChange
} from '../hooks/useWorkspaceSceneRoster';
import {describeError} from '../services/errors';
import {findCardsForScene} from '../services/workspace/chapterCardSceneLinks';
import {
  buildCharacterPeekTargets,
  resolveCharacterStatCardTemplate
} from '../services/state/characterPeek';
import {getSceneOrder} from '../services/state/characterSnapshot';
import {WorkspaceCharacterLabDialogs} from '../components/Workspace/WorkspaceCharacterLabDialogs';
import {WorkspaceSceneDraftEntry} from '../components/Workspace/WorkspaceSceneDraftEntry';
import {useWorkspaceUiStore} from '../store/workspaceUiStore';
import {
  CHARACTER_STAT_PEEK_EVENT,
  type CharacterStatPeekRequestDetail
} from '../commands/characterStatPeek';

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
  const positionedChangeDialogRef = useRef<HTMLDivElement | null>(null);
  const inventoryCaptureDialogRef = useRef<HTMLDivElement | null>(null);
  const statBlockDialogRef = useRef<HTMLDivElement | null>(null);
  const scratchpadDialogRef = useRef<HTMLDivElement | null>(null);
  const corkboardDialogRef = useRef<HTMLDivElement | null>(null);
  const sceneTitleInputRef = useRef<HTMLInputElement | null>(null);
  const exportDialogRef = useRef<HTMLDivElement | null>(null);
  const memoryDialogRef = useRef<HTMLDivElement | null>(null);
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
  const [isPromotingDocument, setIsPromotingDocument] = useState(false);
  const [isSyncingCanon, setIsSyncingCanon] = useState(false);
  const [creatingLinkedSceneCardId, setCreatingLinkedSceneCardId] = useState<string | null>(null);
  const [focusCorkboardCardId, setFocusCorkboardCardId] = useState<string | null>(null);
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
  const openCorkboardModal = useCallback(() => {
    setCorkboardModalOpen(true);
  }, [setCorkboardModalOpen]);
  const closeCorkboardModal = useCallback(() => {
    setCorkboardModalOpen(false);
    setFocusCorkboardCardId(null);
  }, [setCorkboardModalOpen]);
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
    setDocuments,
    onDocumentsLoaded: setLoadedDocumentsProjectId,
    setImportMode,
    setSkipImportSuggestions,
    refreshSystemHistory,
    onProjectReset: handleProjectReset
  });
  const {
    activeAIContext,
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
    stateMutationReviewItems,
    hiddenStateMutationReviewCountBySceneId,
    hiddenStateMutationReviewCount,
    applyingStateMutationReviewId,
    lastConsistencyReviewAt,
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
    unknownLinkOptions,
    getSuggestedUnknownCategoryId,
    createWorldCategory,
    resolveUnknownEntity,
    resolveAllUnknownEntities,
    dismissAllUnknownEntities,
    dismissUnknownEntity,
    dismissConsistencyReviewItem,
    ignoreUnknownSurfaceProjectWide,
    linkUnknownEntity,
    activeConsistencyPopoverIssue,
    reviewReadiness,
    openConsistencyPopover,
    acceptStateMutationReviewItem,
    rejectStateMutationReviewItem,
    acceptSceneStateMutationReviewItems,
    rejectSceneStateMutationReviewItems,
    hideStateMutationReviewItem,
    restoreHiddenStateMutationReviewItems,
    restoreAllHiddenStateMutationReviewItems
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
  const openResolverNoticeDestination = useCallback(() => {
    if (!resolverNotice) {
      return;
    }
    if (resolverNotice.destination === 'character-sheet-create') {
      navigate('/sheets', {
        state: {
          prefillCharacterId: resolverNotice.targetId,
          autoCreateSheetForCharacterId: resolverNotice.targetId
        }
      });
      return;
    }
    if (resolverNotice.destination === 'character-sheets') {
      navigate('/sheets', {
        state: {
          prefillCharacterId: resolverNotice.targetId
        }
      });
      return;
    }
    if (resolverNotice.destination === 'characters') {
      navigate('/world-bible', {
        state: {focusCategorySlug: 'characters'}
      });
      return;
    }
    navigate('/world-bible', {
      state: resolverNotice.targetId
        ? {
            focusEntityId: resolverNotice.targetId,
            focus:
              resolverNotice.primaryLabel === 'Review Character Match'
                ? 'aliases'
                : 'general',
            handoffKind:
              resolverNotice.primaryLabel === 'Review Character Match'
                ? 'character-canonicalization'
                : undefined,
            handoffSourceName:
              resolverNotice.primaryLabel === 'Review Character Match'
                ? resolverNotice.sourceName
                : undefined,
            handoffMatchEntityId: resolverNotice.matchEntityId
          }
        : undefined
    });
  }, [navigate, resolverNotice]);
  const resolverNoticePrimaryLabel =
    resolverNotice?.primaryLabel ??
    (resolverNotice?.destination === 'character-sheet-create'
      ? 'Create Character Sheet'
      : resolverNotice?.destination === 'character-sheets'
      ? 'Open Character Sheet'
      : resolverNotice?.destination === 'characters'
        ? 'Open World Bible Characters'
        : 'View in World Bible');
  const clearFeedback = useCallback(() => setFeedback(null), []);
  const pushToast = useNotificationStore((state) => state.pushToast);
  const updateCorkboardCard = corkboard.updateCorkboardCard;
  const updateLinkedSceneIds = useCallback(
    (cardId: string, sceneIds: string[]) => updateCorkboardCard(
      cardId,
      {sceneIds},
      {persistImmediately: true}
    ),
    [updateCorkboardCard]
  );
  const {createLinkedScene, retryLink} = useChapterCardSceneActions({
    createDocument: handleNewDocument,
    updateCard: updateLinkedSceneIds
  });
  const focusSceneTitle = useCallback(() => {
    window.requestAnimationFrame(() => sceneTitleInputRef.current?.focus());
    window.setTimeout(() => sceneTitleInputRef.current?.focus(), 50);
    window.setTimeout(() => sceneTitleInputRef.current?.focus(), 150);
  }, []);
  const showLinkedSceneResult = useCallback(async (
    card: ChapterCard,
    result: Awaited<ReturnType<typeof createLinkedScene>>
  ) => {
    if (!result.document) return;
    closeCorkboardModal();
    focusSceneTitle();
    const cardName = card.title.trim() || 'Untitled chapter';
    if (result.linked) {
      pushToast({message: `Scene created and linked to ${cardName}.`});
      return;
    }
    const document = result.document;
    pushToast({
      tone: 'error',
      message: `Scene created but not linked to ${cardName}.`,
      durationMs: null,
      action: {
        label: 'Link now',
        onSelect: () => {
          void retryLink(card, document).then((linked) => {
            pushToast(linked
              ? {message: `Linked ${document.title} to ${cardName}.`}
              : {tone: 'error', message: `Could not link ${document.title} to ${cardName}.`});
          });
        }
      }
    });
  }, [closeCorkboardModal, focusSceneTitle, pushToast, retryLink]);
  const handleCreateLinkedScene = useCallback(async (card: ChapterCard) => {
    if (creatingLinkedSceneCardId) return;
    setCreatingLinkedSceneCardId(card.id);
    try {
      await showLinkedSceneResult(card, await createLinkedScene(card));
    } finally {
      setCreatingLinkedSceneCardId(null);
    }
  }, [createLinkedScene, creatingLinkedSceneCardId, showLinkedSceneResult]);

  const linkedChapterCards = useMemo(
    () => selectedDocument
      ? findCardsForScene(corkboard.corkboardCards, selectedDocument.id)
      : [],
    [corkboard.corkboardCards, selectedDocument]
  );
  const handleOpenChapterCard = useCallback((cardId: string) => {
    setFocusCorkboardCardId(cardId);
    setCorkboardModalOpen(true);
  }, [setCorkboardModalOpen]);
  const handleOpenChapterCardRoute = useCallback((cardId: string) => {
    navigate('/corkboard', {state: {focusCardId: cardId}});
  }, [navigate]);

  useEffect(() => {
    const state = location.state as {createLinkedSceneCardId?: string} | null;
    const cardId = state?.createLinkedSceneCardId;
    if (!cardId || corkboard.corkboardStatus !== 'saved') return;
    navigate(location.pathname, {replace: true, state: {}});
    const card = corkboard.corkboardCards.find((entry) => entry.id === cardId);
    if (card) void handleCreateLinkedScene(card);
  }, [
    corkboard.corkboardCards,
    corkboard.corkboardStatus,
    handleCreateLinkedScene,
    location.pathname,
    location.state,
    navigate
  ]);
  const openResolverNoticeDestinationRef = useRef(openResolverNoticeDestination);
  useEffect(() => {
    openResolverNoticeDestinationRef.current = openResolverNoticeDestination;
  }, [openResolverNoticeDestination]);
  useEffect(() => {
    if (!resolverNotice) {
      return;
    }
    let dismissedByUser = false;
    const toastId = pushToast({
      tone: 'info',
      message: resolverNotice.message,
      durationMs: null,
      action: {
        label: resolverNoticePrimaryLabel,
        onSelect: () => openResolverNoticeDestinationRef.current()
      },
      onDismiss: () => {
        dismissedByUser = true;
        setResolverNotice(null);
      }
    });
    return () => {
      if (!dismissedByUser) {
        useNotificationStore.setState((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== toastId)
        }));
      }
    };
  }, [resolverNotice, resolverNoticePrimaryLabel, pushToast, setResolverNotice]);
  useEffect(() => {
    if (!resolverNotice) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setResolverNotice((current) => (current === resolverNotice ? null : current));
    }, resolverNotice.primaryLabel === 'Review Character Match' ? 7200 : 4200);
    return () => window.clearTimeout(timeoutId);
  }, [resolverNotice, setResolverNotice]);
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
  const statBlocks = useWorkspaceStatBlocks({
    activeProject,
    projectSettings,
    saveProjectSettings,
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
  const {
    statDefinitionNameById,
    resourceDefinitionNameById,
    resolveCharacterBlock,
    resolveItemBlock,
    getStatBlockTokenPresentation,
    getStatBlockPreviewData,
    handleRefreshStatTemplates,
    openStatBlockRebind,
    closeStatBlockModal
  } = statBlocks;
  const {
    sceneRosterModel,
    addSceneRosterEntry,
    inventoryCaptureCharacters,
    inventoryCaptureContexts,
    openSelectionInventoryCapture,
    saveSelectionInventoryCapture,
    saveSelectionConsumptionCapture,
    openDetectedItemStateProposal,
    sceneRosterTimeline,
    hideSceneRosterEntry,
    recordSceneRosterChangeHere,
    consumeSceneRosterItemHere,
    expireSceneRosterTimelineEvent,
    editSceneRosterTimelineEvent,
    invalidateSceneRosterTimelineEvent,
    reanchorSceneRosterTimelineEvent,
    pendingPositionedSheet,
    positionedChangeBefore,
    savePositionedChange,
    selectedSceneTimeline,
    getCharacterStatSnapshot,
    getCharacterStatSnapshotAt
  } = useWorkspaceSceneRoster({
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
  const editStateMutationReviewItem = useCallback(
    (item: (typeof stateMutationReviewItems)[number]) => {
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
  const characterPeekTargets = useMemo(
    () => buildCharacterPeekTargets({sheets: characterSheets, entities, aliases}),
    [aliases, characterSheets, entities]
  );
  const statBlockPreferences = projectSettings?.statBlockPreferences;
  const characterStatPeek = useMemo(
    () =>
      showGameSystems && selectedDocument
        ? {
            targets: characterPeekTargets,
            getSnapshot: getCharacterStatSnapshot,
            template: resolveCharacterStatCardTemplate(statBlockPreferences),
            sceneTitle: selectedDocument.title || 'Untitled scene'
          }
        : undefined,
    [
      characterPeekTargets,
      getCharacterStatSnapshot,
      selectedDocument,
      showGameSystems,
      statBlockPreferences
    ]
  );
  const setWorkspaceStatContext = useWorkspaceUiStore((s) => s.setWorkspaceStatContext);
  const selectedSceneOrder = selectedDocument
    ? getSceneOrder(documents, selectedDocument.id)
    : 0;
  useEffect(() => {
    if (!activeProject || !showGameSystems || !selectedDocument || selectedSceneOrder <= 0) {
      setWorkspaceStatContext(null);
      return;
    }
    setWorkspaceStatContext({
      projectId: activeProject.id,
      sceneId: selectedDocument.id,
      sceneTitle: selectedDocument.title || 'Untitled scene',
      sceneOrder: selectedSceneOrder,
      cursorPosition: sceneCursorPosition,
      getSnapshot: getCharacterStatSnapshotAt
    });
  }, [
    activeProject,
    getCharacterStatSnapshotAt,
    sceneCursorPosition,
    selectedDocument,
    selectedSceneOrder,
    setWorkspaceStatContext,
    showGameSystems
  ]);
  useEffect(() => () => setWorkspaceStatContext(null), [setWorkspaceStatContext]);
  const [statPeekRequest, setStatPeekRequest] = useState<{
    sheetId: string;
    token: number;
  } | null>(null);
  useEffect(() => {
    if (!characterStatPeek) return;
    const onStatPeekRequest = (event: Event) => {
      const detail = (event as CustomEvent<CharacterStatPeekRequestDetail>).detail;
      if (!detail || detail.handled) return;
      if (!characterStatPeek.targets.some((target) => target.sheetId === detail.sheetId)) return;
      detail.handled = true;
      setStatPeekRequest((current) => ({
        sheetId: detail.sheetId,
        token: (current?.token ?? 0) + 1
      }));
    };
    window.addEventListener(CHARACTER_STAT_PEEK_EVENT, onStatPeekRequest);
    return () => window.removeEventListener(CHARACTER_STAT_PEEK_EVENT, onStatPeekRequest);
  }, [characterStatPeek]);
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
  const knownWorldBibleLoreHighlights = useMemo(() => {
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    const highlights = entities.map((entity) => ({
      id: entity.id,
      surface: entity.name,
      type: 'entity' as const
    }));

    aliases.forEach((alias) => {
      if ((alias.targetType ?? 'entity') !== 'entity') {
        return;
      }
      const entity = entityById.get(alias.targetId);
      if (!entity) {
        return;
      }
      highlights.push({
        id: entity.id,
        surface: alias.alias,
        type: 'entity' as const
      });
    });

    return highlights;
  }, [aliases, entities]);
  const pendingInventoryResolution = useMemo(
    () => pendingInventoryCapture
      ? resolveReusableItem({
          itemName: pendingInventoryCapture.itemName,
          categories,
          entities,
          compendiumEntries
        })
      : null,
    [categories, compendiumEntries, entities, pendingInventoryCapture]
  );
  const exactReusableInventoryEntity = pendingInventoryResolution?.status === 'exact' &&
    pendingInventoryResolution.sourceEntityId
    ? entities.find(
        (entity) => entity.id === pendingInventoryResolution.sourceEntityId
      ) ?? null
    : null;
  const pendingConsumableEntry = pendingInventoryResolution?.status === 'exact' &&
    pendingInventoryResolution.definitionId
    ? compendiumEntries.find(
        (entry) => entry.id === pendingInventoryResolution.definitionId
      ) ?? null
    : null;
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
    [handleRefreshStatTemplates, setStatBlockModalOpen]
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

  const isPositionedChangeDialogOpen = Boolean(
    pendingPositionedChange && pendingPositionedSheet && positionedChangeBefore
  );
  const closePositionedChangeDialog = useCallback(() => {
    setPendingPositionedChange(null);
  }, [setPendingPositionedChange]);

  const isInventoryCaptureDialogOpen = Boolean(pendingInventoryCapture);
  const closeInventoryCaptureDialog = useCallback(() => {
    setPendingInventoryCapture(null);
  }, [setPendingInventoryCapture]);

  const isMemoryDialogOpen = Boolean(isMemoryModalOpen && selectedDocument);
  const closeMemoryDialog = useCallback(() => {
    setMemoryModalOpen(false);
  }, [setMemoryModalOpen]);

  useEscapeToClose(closeScratchpadModal, isScratchpadModalOpen);
  useFocusTrap(scratchpadDialogRef, isScratchpadModalOpen);

  useEscapeToClose(closeCorkboardModal, isCorkboardModalOpen);
  useFocusTrap(corkboardDialogRef, isCorkboardModalOpen);

  useEscapeToClose(closeStatBlockModal, isStatBlockModalOpen);
  useFocusTrap(statBlockDialogRef, isStatBlockModalOpen);

  useEscapeToClose(closeExportModal, isExportModalOpen);
  useFocusTrap(exportDialogRef, isExportModalOpen);

  useEscapeToClose(closeMemoryDialog, isMemoryDialogOpen);
  useFocusTrap(memoryDialogRef, isMemoryDialogOpen);

  useEscapeToClose(closePositionedChangeDialog, isPositionedChangeDialogOpen);
  useFocusTrap(positionedChangeDialogRef, isPositionedChangeDialogOpen);

  useEscapeToClose(closeInventoryCaptureDialog, isInventoryCaptureDialogOpen);
  useFocusTrap(inventoryCaptureDialogRef, isInventoryCaptureDialogOpen);


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
        describeError(error, 'Unable to promote scene.');
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
        describeError(error, 'Unable to mark canon as synced.');
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
    handleRunConsistencyReview: runConsistencyReviewFromUi,
    isRunningConsistencyReview, lastConsistencyReviewAt, consistencyReviewItems,
    stateMutationReviewItems, hiddenStateMutationReviewCountBySceneId,
    hiddenStateMutationReviewCount, applyingStateMutationReviewId, reviewReadiness,
    acceptStateMutationReviewItem, rejectStateMutationReviewItem,
    acceptSceneStateMutationReviewItems, rejectSceneStateMutationReviewItems,
    editStateMutationReviewItem,
    hideStateMutationReviewItem, restoreHiddenStateMutationReviewItems,
    restoreAllHiddenStateMutationReviewItems,
    documents, handleSelectDocument,
    onFocusReviewItem: focusReviewItemInScene,
    activeReviewItemId, reviewCreateLabel, reviewLinkLabel, resolvingUnknown,
    linkingUnknown, unknownCategorySelection, setUnknownCategorySelection,
    worldCaptureDrafts, setWorldCaptureDrafts,
    unknownLinkSelection, setUnknownLinkSelection, unknownLinkOptions,
    getSuggestedUnknownCategoryId, createWorldCategory, resolveUnknownEntity, dismissUnknownEntity,
    dismissConsistencyReviewItem,
    ignoreUnknownSurfaceProjectWide, linkUnknownEntity, openWorldRecord,
    scratchpadContent, setScratchpadContent, scratchpadStatus, scratchpadLastSavedAt,
    activeProject, projectSettings, activeAIContext, setPendingAIInsert, previewSceneRevision,
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
              cards={linkedChapterCards}
              onOpenCard={handleOpenChapterCard}
              onOpenCorkboard={handleOpenChapterCardRoute}
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
              aria-label={`Open review drawer: ${reviewReadiness.detail}`}
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
                  onTextInserted={() => {
                    if (pendingAIInsert) {
                      setPendingAIInsert(null);
                      return;
                    }
                    setStatBlockInsertContent(null);
                  }}
                  selectionQuickSnippets={selectionQuickSnippets}
                  knownLoreHighlights={knownWorldBibleLoreHighlights}
                  characterStatPeek={characterStatPeek}
                  statPeekRequest={statPeekRequest}
                  presentStatBlockToken={getStatBlockTokenPresentation}
                  getStatBlockPreviewData={getStatBlockPreviewData}
                  onRebindStatBlockToken={openStatBlockRebind}
                  onOpenAIContext={handleOpenAIContext}
                  onOpenLoreInspector={handleOpenLoreInspector}
                  onOpenWorldCapture={handleOpenManualWorldCapture}
                  onAddSelectionToInventory={isGeneralFictionProject
                    ? undefined
                    : openSelectionInventoryCapture}
                  suppressSelectionBubble={Boolean(manualWorldCapture)}
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

      {pendingPositionedChange && pendingPositionedSheet && positionedChangeBefore && (
        <div
          ref={positionedChangeDialogRef}
          role='dialog'
          aria-modal='true'
          aria-label='Record positioned state change'
          onClick={() => setPendingPositionedChange(null)}
          className={styles.modalOverlay}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <PositionedStateChangeComposer
              key={pendingPositionedChange.event?.id ?? `new-${sceneCursorPosition}`}
              characterName={pendingPositionedChange.character.name}
              sceneTitle={selectedDocument?.title || 'Current scene'}
              cursorPosition={pendingPositionedChange.event?.scenePosition ?? sceneCursorPosition}
              actorId={pendingPositionedSheet.characterEntityId ?? ''}
              ruleset={ruleset}
              before={positionedChangeBefore}
              existingEvent={pendingPositionedChange.event}
              initialLabel={pendingPositionedChange.initialLabel}
              initialCommands={pendingPositionedChange.initialCommands}
              isSaving={isSavingPositionedChange}
              onCancel={() => setPendingPositionedChange(null)}
              onSave={(input) => void savePositionedChange(input)}
            />
          </div>
        </div>
      )}

      {pendingInventoryCapture && (
        <div
          ref={inventoryCaptureDialogRef}
          role='dialog'
          aria-modal='true'
          aria-label={pendingInventoryCapture.action === 'consume'
            ? 'Record selected item use'
            : 'Add selected item to inventory'}
          onClick={() => setPendingInventoryCapture(null)}
          className={styles.modalOverlay}
        >
          <div onClick={(event) => event.stopPropagation()}>
            {pendingInventoryCapture.action === 'consume' ? (
              <SceneConsumptionCapture
                key={`consume:${pendingInventoryCapture.position}:${pendingInventoryCapture.itemName}`}
                itemName={pendingInventoryCapture.itemName}
                evidenceText={pendingInventoryCapture.evidenceText}
                contexts={inventoryCaptureContexts}
                suggestedSheetId={pendingInventoryCapture.suggestedSheetId}
                ruleset={ruleset}
                approvedEntry={pendingConsumableEntry}
                itemReference={{
                  sourceEntityId: pendingInventoryResolution?.status === 'exact'
                    ? pendingInventoryResolution.sourceEntityId
                    : undefined,
                  definitionId: pendingInventoryResolution?.status === 'exact'
                    ? pendingInventoryResolution.definitionId
                    : undefined
                }}
                exactReusableItem={exactReusableInventoryEntity}
                reusableItemMatches={pendingInventoryResolution?.entityMatches ?? []}
                canCreateReusableItem={categories.some(isItemCategory)}
                isSaving={isSavingInventoryCapture}
                onCancel={() => setPendingInventoryCapture(null)}
                onSave={(input) => void saveSelectionConsumptionCapture(input)}
              />
            ) : (
              <SceneInventoryCapture
                key={`acquire:${pendingInventoryCapture.position}:${pendingInventoryCapture.itemName}`}
                itemName={pendingInventoryCapture.itemName}
                characters={inventoryCaptureCharacters}
                evidenceText={pendingInventoryCapture.evidenceText}
                suggestedSheetId={pendingInventoryCapture.suggestedSheetId}
                exactReusableItem={exactReusableInventoryEntity}
                reusableItemMatches={pendingInventoryResolution?.entityMatches ?? []}
                canCreateReusableItem={categories.some(isItemCategory)}
                isSaving={isSavingInventoryCapture}
                onCancel={() => setPendingInventoryCapture(null)}
                onSave={(input) => void saveSelectionInventoryCapture(input)}
              />
            )}
          </div>
        </div>
      )}

      <WorkspaceStatBlockModal
        isOpen={isStatBlockModalOpen} dialogRef={statBlockDialogRef}
        statBlocks={statBlocks} pendingRebindToken={pendingStatBlockRebindToken}
        sourceType={statBlockSourceType} setSourceType={setStatBlockSourceType}
        characterSheets={characterSheets} selectedCharacterId={selectedStatCharacterId}
        setSelectedCharacterId={setSelectedStatCharacterId}
        scopePreset={statBlockScopePreset} setScopePreset={setStatBlockScopePreset}
        setSelectedGroupId={setSelectedStatGroupId} groups={statBlockGroups}
        newGroupName={newStatGroupName} setNewGroupName={setNewStatGroupName}
        entities={entities} selectedEntityId={selectedStatEntityId}
        setSelectedEntityId={setSelectedStatEntityId}
        style={statBlockStyle} setStyle={setStatBlockStyle}
        insertMode={statBlockInsertMode} setInsertMode={setStatBlockInsertMode}
        navigate={navigate}
      />

      <WorkspaceScratchpadModal
        isOpen={isScratchpadModalOpen} dialogRef={scratchpadDialogRef}
        content={scratchpadContent} statusLabel={scratchpadStatusLabel}
        isNarrowViewport={isNarrowViewport} setContent={setScratchpadContent}
        setActiveContextView={setActiveContextView}
        setContextDrawerOpen={setContextDrawerOpen}
        setSceneDrawerOpen={setSceneDrawerOpen} onClose={closeScratchpadModal}
      />

      <WorkspaceCorkboardModal
        isOpen={isCorkboardModalOpen}
        dialogRef={corkboardDialogRef}
        corkboard={corkboard}
        documents={documents}
        currentDocumentId={selectedDocument?.id}
        focusCardId={focusCorkboardCardId}
        onFocusCardHandled={() => setFocusCorkboardCardId(null)}
        onClose={closeCorkboardModal}
        onOpenScratchpad={openScratchpadModal}
        onCurrentSceneAction={(message) => pushToast({tone: 'success', message})}
        onCreateLinkedScene={(card) => void handleCreateLinkedScene(card)}
        creatingLinkedSceneCardId={creatingLinkedSceneCardId}
      />

      <WorkspaceExportModal
        isOpen={isExportModalOpen} dialogRef={exportDialogRef}
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
        isOpen={isMemoryDialogOpen} dialogRef={memoryDialogRef}
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
