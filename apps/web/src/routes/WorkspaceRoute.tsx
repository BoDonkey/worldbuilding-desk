import {useEffect, useState, useCallback, useMemo, useRef} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import type {
  Character,
  CharacterSheet,
  EntityCategory,
  ProjectSettings,
  StatBlockGroup,
  StatBlockInsertMode,
  StatBlockScopePreset,
  StatBlockSourceType,
  StatBlockStyle,
  StoredRuleset,
  SystemHistoryEntry,
  WorkspaceImportMode,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import {
  getDocumentsByProject
} from '../writingStorage';
import {getEntitiesByProject} from '../entityStorage';
import {
  getCategoriesByProject,
  initializeDefaultCategories
} from '../categoryStorage';
import {getCharactersByProject} from '../characterStorage';
import {getCharacterSheetsByProject} from '../services/characters';
import {
  getOrCreateSettings,
  getResolvedConsistencyActionCues
} from '../settingsStorage';
import {createEditorConfigWithStyles} from '../config/editorConfig';
import type {EditorConfig} from '../config/editorConfig';
import {EditorWithAI} from '../components/Editor/EditorWithAI';
import {ContextPopover} from '../components/Editor/ContextPopover';
import type {LoreInspectorRecord} from '../components/Editor/LoreInspectorPanel';
import {LoreInspectorPanel} from '../components/Editor/LoreInspectorPanel';
import {SystemHistoryPanel} from '../components/Editor/SystemHistoryPanel';
import {AIAssistant} from '../components/AIAssistant/AIAssistant';
import {ShodhMemoryPanel} from '../components/ShodhMemoryPanel';
import {useWorkspaceMemories} from '../hooks/useWorkspaceMemories';
import {useWorkspaceConsistency} from '../hooks/useWorkspaceConsistency';
import {useWorkspaceDocuments} from '../hooks/useWorkspaceDocuments';
import {useWorkspaceStatBlocks} from '../hooks/useWorkspaceStatBlocks';
import type {RAGProvider} from '../services/rag/RAGService';
import {getRAGService} from '../services/rag/getRAGService';
import {getRulesetByProjectId} from '../services/rules';
import {
  DEFAULT_PARTY_SYNERGY_RULES,
  deriveCharacterRuntimeModifiers,
  getCompendiumActionLogs,
  getCompendiumEntriesByProject,
  getCompendiumProgress,
  getEffectiveResourceValues,
  getEffectiveStatValue,
  getOrCreateSettlementState,
  getPartySynergySuggestions,
  getSettlementModulesByProject
} from '../services/compendium';
import {
  getSeriesBibleConfig,
  promoteDocumentToParent,
  getCanonSyncState,
  syncChildWithParent
} from '../services/seriesBible/SeriesBibleService';
import {getConsistencyEngineService} from '../services/consistency';
import {
  getAliasesByProject,
  type ConsistencyAlias
} from '../services/consistency';
import {
  appendSystemHistoryEntry,
  clearSystemHistoryEntries,
  getSystemHistoryEntries
} from '../services/system';
import {
  getCachedSynopsis,
  getInspectorConsultationUsage,
  incrementInspectorConsultationUsage,
  setCachedSynopsis
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
type ImportMode = WorkspaceImportMode;
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
  const consistencyEngine = useMemo(() => getConsistencyEngineService(), []);
  const [documents, setDocuments] = useState<WritingDocument[]>([]);
  const [editorConfig, setEditorConfig] = useState<EditorConfig | null>(null);
  const [toolbarButtons, setToolbarButtons] = useState<
    Array<{id: string; label: string; markName: string}>
  >([]);
  const [projectSettings, setProjectSettings] =
    useState<ProjectSettings | null>(null);
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [aliases, setAliases] = useState<ConsistencyAlias[]>([]);
  const [resolvedActionCues, setResolvedActionCues] = useState<string[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterSheets, setCharacterSheets] = useState<CharacterSheet[]>([]);
  const [ruleset, setRuleset] = useState<StoredRuleset | null>(null);
  const [settlementState, setSettlementState] = useState<Awaited<
    ReturnType<typeof getOrCreateSettlementState>
  > | null>(null);
  const [settlementModules, setSettlementModules] = useState<Awaited<
    ReturnType<typeof getSettlementModulesByProject>
  >>([]);
  const [statBlockSourceType, setStatBlockSourceType] =
    useState<StatBlockSourceType>('character');
  const [statBlockStyle, setStatBlockStyle] = useState<StatBlockStyle>('full');
  const [statBlockInsertMode, setStatBlockInsertMode] =
    useState<StatBlockInsertMode>('block');
  const [statBlockScopePreset, setStatBlockScopePreset] =
    useState<StatBlockScopePreset>('all');
  const [selectedStatGroupId, setSelectedStatGroupId] = useState('');
  const [selectedStatIds, setSelectedStatIds] = useState<string[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [statBlockGroups, setStatBlockGroups] = useState<StatBlockGroup[]>([]);
  const [newStatGroupName, setNewStatGroupName] = useState('');
  const [selectedStatCharacterId, setSelectedStatCharacterId] = useState('');
  const [selectedStatEntityId, setSelectedStatEntityId] = useState('');
  const [statBlockInsertContent, setStatBlockInsertContent] = useState<string | null>(null);
  const [pendingStatBlockRebindToken, setPendingStatBlockRebindToken] = useState<string | null>(null);
  const [isStatPreferencesHydrated, setStatPreferencesHydrated] = useState(false);
  const [ragService, setRagService] = useState<RAGProvider | null>(null);
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
    unknownLinkOptions,
    resolveUnknownEntity,
    resolveAllUnknownEntities,
    dismissAllUnknownEntities,
    dismissUnknownEntity,
    linkUnknownEntity,
    activeConsistencyPopoverIssue,
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
    resolvedActionCues,
    consistencyEngine,
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

  const syncCompendiumSystemSignals = useCallback(async () => {
    if (!activeProject) return;
    const [logs, entries, progress] = await Promise.all([
      getCompendiumActionLogs(activeProject.id),
      getCompendiumEntriesByProject(activeProject.id),
      getCompendiumProgress(activeProject.id)
    ]);
    const entryMap = new Map(entries.map((entry) => [entry.id, entry]));

    logs.slice(0, 80).forEach((log) => {
      const entry = entryMap.get(log.entryId);
      const action = entry?.actions.find((item) => item.id === log.actionId);
      const message = `Compendium action: ${entry?.name ?? 'Unknown entry'} · ${
        action?.label ?? log.actionId
      } (+${log.pointsAwarded} pts${log.quantity > 1 ? ` x${log.quantity}` : ''}).`;
      appendSystemHistoryEntry(activeProject.id, {
        category: 'resource',
        message,
        insertText: `System Update: ${message}`,
        sourceKey: `compendium-log:${log.id}`,
        createdAt: log.createdAt
      });
    });

    appendSystemHistoryEntry(activeProject.id, {
      category: 'quest',
      message:
        `Compendium progress: ${progress.totalPoints} total points, ` +
        `${progress.unlockedMilestoneIds.length} milestone(s), ` +
        `${progress.unlockedRecipeIds.length} recipe(s) unlocked.`,
      insertText:
        `Quest Progress: ${progress.totalPoints} points · ` +
        `${progress.unlockedMilestoneIds.length} milestones · ` +
        `${progress.unlockedRecipeIds.length} recipes.`,
      sourceKey: `compendium-progress:${progress.updatedAt}`,
      createdAt: progress.updatedAt
    });

    refreshSystemHistory();
  }, [activeProject, refreshSystemHistory]);

  // Load project-scoped data when project changes
  useEffect(() => {
    if (!activeProject) {
      setEditorConfig(null);
      setToolbarButtons([]);
      setProjectSettings(null);
      setEntities([]);
      setCategories([]);
      setAliases([]);
      setResolvedActionCues([]);
      setCharacters([]);
      setCharacterSheets([]);
      setRuleset(null);
      setSettlementState(null);
      setSettlementModules([]);
      setSelectedStatCharacterId('');
      setSelectedStatEntityId('');
      setStatBlockSourceType('character');
      setStatBlockStyle('full');
      setStatBlockInsertMode('block');
      setStatBlockScopePreset('all');
      setSelectedStatGroupId('');
      setSelectedStatIds([]);
      setSelectedResourceIds([]);
      setStatBlockGroups([]);
      setNewStatGroupName('');
      setStatPreferencesHydrated(false);
      setSystemHistoryEntries([]);
      setActiveAIContext(null);
      setQueuedAssistantPrompt(null);
      setActiveLoreRecord(null);
      setPendingAIInsert(null);
      return;
    }

    let cancelled = false;

    (async () => {
      await initializeDefaultCategories(activeProject.id);
      const [docs, settings, resolvedCues, loadedEntities, loadedCategories, loadedAliases, loadedCharacters, loadedSheets, loadedRuleset, loadedSettlementState, loadedSettlementModules] = await Promise.all([
        getDocumentsByProject(activeProject.id),
        getOrCreateSettings(activeProject.id),
        getResolvedConsistencyActionCues(activeProject),
        getEntitiesByProject(activeProject.id),
        getCategoriesByProject(activeProject.id),
        getAliasesByProject(activeProject.id),
        getCharactersByProject(activeProject.id),
        getCharacterSheetsByProject(activeProject.id),
        getRulesetByProjectId(activeProject.id),
        getOrCreateSettlementState(activeProject.id),
        getSettlementModulesByProject(activeProject.id)
      ]);

      if (cancelled) return;

      setDocuments(docs);
      setEditorConfig(createEditorConfigWithStyles(settings.characterStyles));
      setProjectSettings(settings);
      setImportMode(settings.defaultImportMode ?? 'balanced');
      setSkipImportSuggestions(settings.defaultSkipImportSuggestions ?? false);
      setResolvedActionCues(resolvedCues);
      setCategories(loadedCategories);
      setAliases(loadedAliases);
      setStatBlockSourceType(
        settings.statBlockPreferences?.sourceType ?? 'character'
      );
      setStatBlockStyle(settings.statBlockPreferences?.style ?? 'full');
      setStatBlockInsertMode(
        settings.statBlockPreferences?.insertMode ?? 'block'
      );
      setStatBlockScopePreset(
        settings.statBlockPreferences?.scopePreset ?? 'all'
      );
      setSelectedStatGroupId(
        settings.statBlockPreferences?.selectedGroupId ?? ''
      );
      setSelectedStatIds(settings.statBlockPreferences?.selectedStatIds ?? []);
      setSelectedResourceIds(
        settings.statBlockPreferences?.selectedResourceIds ?? []
      );
      setStatBlockGroups(settings.statBlockPreferences?.groups ?? []);
      setEntities(loadedEntities);
      setCharacters(loadedCharacters);
      setCharacterSheets(loadedSheets);
      setRuleset(loadedRuleset);
      setSettlementState(loadedSettlementState);
      setSettlementModules(loadedSettlementModules);
      setSelectedStatCharacterId(loadedSheets[0]?.id ?? '');
      setSelectedStatEntityId(loadedEntities[0]?.id ?? '');
      setStatPreferencesHydrated(true);
      setSystemHistoryEntries(getSystemHistoryEntries(activeProject.id));

      // Generate toolbar buttons from character styles
      const buttons = settings.characterStyles.map((style) => ({
        id: style.id,
        label: style.name,
        markName: style.markName
      }));
      setToolbarButtons(buttons);
      initializeEditorState(docs[0] ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject, initializeEditorState, setImportMode, setSkipImportSuggestions]);

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
    let cancelled = false;

    getRAGService(ragOptions).then((service) => {
      if (!cancelled) {
        setRagService(service);
      }
    });

    return () => {
      cancelled = true;
      setRagService(null);
    };
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) return;
    void syncCompendiumSystemSignals().catch(() => {
      // Compendium data is optional for some projects.
    });

    const onFocus = () => {
      void syncCompendiumSystemSignals().catch(() => {
        // Ignore sync errors from optional stores.
      });
    };

    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [activeProject, syncCompendiumSystemSignals]);

  useEffect(() => {
    if (!activeProject || !ragService) {
      return;
    }

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
  }, [activeProject, ragService, entities, characters]);

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
  const selectionQuickSnippets = useMemo(() => {
    if (!activeProject) {
      return {characters: {}, entities: {}};
    }
    const normalize = (input: string) =>
      input
        .trim()
        .toLowerCase()
        .replace(/[^\w\s'-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
    const characterById = new Map(characters.map((character) => [character.id, character]));
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));

    const recentSystemMessageFor = (name: string): string => {
      const normalized = name.trim().toLowerCase();
      const match = systemHistoryEntries.find((entry) =>
        entry.message.toLowerCase().includes(normalized)
      );
      return match?.message ?? 'No recent linked system event.';
    };

    const buildCharacterLore = (sheet: CharacterSheet): LoreInspectorRecord => {
      const character = sheet.characterId ? characterById.get(sheet.characterId) : null;
      const role =
        typeof character?.fields.role === 'string' && character.fields.role.trim()
          ? character.fields.role.trim()
          : 'Unassigned class';
      const statuses = (sheet.statuses ?? []).slice(0, 2);
      const faction =
        typeof character?.fields.faction === 'string' && character.fields.faction.trim()
          ? character.fields.faction.trim()
          : 'Unknown faction';
      const cached = getCachedSynopsis(activeProject.id, sheet.id, sheet.updatedAt);
      const synopsis =
        cached ??
        {
          goal:
            (typeof character?.fields.goal === 'string' && character.fields.goal.trim()) ||
            'No explicit active goal recorded.',
          recentEvent: recentSystemMessageFor(sheet.name),
          motivation:
            (typeof character?.fields.motivation === 'string' &&
              character.fields.motivation.trim()) ||
            character?.description?.trim() ||
            'No explicit motivation captured yet.'
        };
      if (!cached) {
        setCachedSynopsis(activeProject.id, sheet.id, sheet.updatedAt, synopsis);
      }
      return {
        type: 'character',
        id: sheet.id,
        name: sheet.name,
        vitalSigns: [
          `Level ${sheet.level}`,
          role,
          statuses.length > 0 ? statuses.join(', ') : 'No active buffs/debuffs',
          `Faction: ${faction}`
        ],
        synopsis
      };
    };

    const buildEntityLore = (entity: WorldEntity): LoreInspectorRecord => {
      const categoryName = categoryNameById.get(entity.categoryId) ?? 'Entity';
      const status =
        typeof entity.fields.status === 'string' && entity.fields.status.trim()
          ? entity.fields.status.trim()
          : 'State unknown';
      const cached = getCachedSynopsis(activeProject.id, entity.id, entity.updatedAt);
      const synopsis =
        cached ??
        {
          goal:
            (typeof entity.fields.goal === 'string' && entity.fields.goal.trim()) ||
            `Track relevance of ${entity.name} in this scene.`,
          recentEvent: recentSystemMessageFor(entity.name),
          motivation:
            (typeof entity.fields.motivation === 'string' &&
              entity.fields.motivation.trim()) ||
            (typeof entity.fields.notes === 'string' && entity.fields.notes.trim()) ||
            'No motivation/secret recorded.'
        };
      if (!cached) {
        setCachedSynopsis(activeProject.id, entity.id, entity.updatedAt, synopsis);
      }
      return {
        type: 'entity',
        id: entity.id,
        name: entity.name,
        vitalSigns: [categoryName, status],
        synopsis
      };
    };

    const characterEntries: Array<
      [string, {name: string; html: string; lore: LoreInspectorRecord}]
    > = [];
    const entityEntries: Array<
      [string, {name: string; html: string; lore: LoreInspectorRecord}]
    > = [];
    const surnameCandidates = new Map<string, Array<{
      bucket: 'characters' | 'entities';
      entry: {name: string; html: string; lore: LoreInspectorRecord};
    }>>();

    const registerEntry = (
      bucket: 'characters' | 'entities',
      label: string,
      entry: {name: string; html: string; lore: LoreInspectorRecord}
    ) => {
      const key = normalize(label);
      if (!key) return;
      if (bucket === 'characters') {
        characterEntries.push([key, entry]);
      } else {
        entityEntries.push([key, entry]);
      }

      const tokens = label.trim().split(/\s+/).filter(Boolean);
      if (tokens.length < 2) return;
      const trailing = normalize(tokens[tokens.length - 1] ?? '');
      if (!trailing || trailing.length < 4) return;
      const existing = surnameCandidates.get(trailing) ?? [];
      existing.push({bucket, entry});
      surnameCandidates.set(trailing, existing);
    };

    characterSheets.forEach((sheet) => {
      const entry = {
        name: sheet.name,
        html: resolveCharacterBlock(sheet, 'compact'),
        lore: buildCharacterLore(sheet)
      };
      registerEntry('characters', sheet.name, entry);
    });

    entities.forEach((entity) => {
      const entry = {
        name: entity.name,
        html: resolveItemBlock(entity, 'compact'),
        lore: buildEntityLore(entity)
      };
      registerEntry('entities', entity.name, entry);
    });

    aliases.forEach((alias) => {
      const entity = entityById.get(alias.entityId);
      if (!entity) return;
      const entry = {
        name: entity.name,
        html: resolveItemBlock(entity, 'compact'),
        lore: buildEntityLore(entity)
      };
      registerEntry('entities', alias.alias, entry);
    });

    surnameCandidates.forEach((matches, trailing) => {
      if (matches.length !== 1) return;
      const [match] = matches;
      if (!match) return;
      if (match.bucket === 'characters') {
        characterEntries.push([trailing, match.entry]);
      } else {
        entityEntries.push([trailing, match.entry]);
      }
    });

    return {
      characters: Object.fromEntries(characterEntries),
      entities: Object.fromEntries(entityEntries)
    };
  }, [
    activeProject,
    aliases,
    categories,
    characters,
    characterSheets,
    entities,
    resolveCharacterBlock,
    resolveItemBlock,
    systemHistoryEntries
  ]);
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

  useEffect(() => {
    const state = location.state as {focusDocumentId?: string} | null;
    const focusDocumentId = state?.focusDocumentId;
    if (!focusDocumentId) return;
    const target = documents.find((doc) => doc.id === focusDocumentId);
    if (!target) return;
    if (selectedId !== target.id) {
      handleSelectDocument(target);
    }
    navigate(location.pathname, {replace: true, state: {}});
  }, [documents, handleSelectDocument, location.pathname, location.state, navigate, selectedId]);

  useEffect(() => {
    if (!showGameSystems && activeContextView === 'compendium') {
      setActiveContextView('world-bible');
    }
  }, [showGameSystems, activeContextView, setActiveContextView]);

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
          void handleRunConsistencyReview();
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
    openContextDrawer,
    handleRunConsistencyReview,
    handleSave,
    openMemoryModal,
    openExportModalWithDrawerHandling,
    showGameSystems,
    openContextDrawer,
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
  }, [activeProject, addSystemHistory]);

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

  const contextDrawerTabs: Array<{
    id: ContextDrawerView;
    label: string;
    hidden?: boolean;
  }> = [
    {id: 'world-bible', label: 'World Bible'},
    {id: 'ruleset', label: 'Ruleset'},
    {id: 'characters', label: 'Characters'},
    {id: 'compendium', label: 'Compendium', hidden: !showGameSystems},
    {id: 'review', label: 'Review'},
    {id: 'ai', label: 'AI'},
    {id: 'system', label: 'System'},
    {id: 'lore', label: 'Lore'}
  ];

  const contextDrawerContent = (() => {
    if (activeContextView === 'world-bible') {
      return (
        <div className={styles.contextSummary}>
          <p className={styles.contextSummaryText}>
            Entities: <strong>{entities.length}</strong> · Categories:{' '}
            <strong>{categories.length}</strong>
          </p>
          <button type='button' onClick={() => navigate('/world-bible')}>
            Open World Bible
          </button>
        </div>
      );
    }
    if (activeContextView === 'ruleset') {
      return (
        <div className={styles.contextSummary}>
          <p className={styles.contextSummaryText}>
            Stats: <strong>{ruleset?.statDefinitions.length ?? 0}</strong> · Resources:{' '}
            <strong>{ruleset?.resourceDefinitions.length ?? 0}</strong> · Rules:{' '}
            <strong>{ruleset?.rules.length ?? 0}</strong>
          </p>
          <button type='button' onClick={() => navigate('/ruleset')}>
            Open Ruleset
          </button>
        </div>
      );
    }
    if (activeContextView === 'characters') {
      return (
        <div className={styles.contextSummary}>
          <p className={styles.contextSummaryText}>
            Characters: <strong>{characters.length}</strong> · Sheets:{' '}
            <strong>{characterSheets.length}</strong>
          </p>
          <button type='button' onClick={() => navigate('/characters')}>
            Open Characters
          </button>
        </div>
      );
    }
    if (activeContextView === 'review') {
      return (
        <div className={styles.contextSummary}>
          <div className={styles.contextSummaryText}>
            <strong>Canon Consistency Review</strong>
            <div className={styles.consistencyDescription}>
              Run review when you want a canon check, not on every glance at the page.
            </div>
          </div>
          <div className={styles.consistencyPanelHeader}>
            <button
              type='button'
              onClick={() => void handleRunConsistencyReview()}
              disabled={isRunningConsistencyReview}
            >
              {isRunningConsistencyReview ? 'Running review...' : 'Run review'}
            </button>
          </div>
          {lastConsistencyReviewAt && (
            <div className={styles.consistencyLastRun}>
              Last run: {new Date(lastConsistencyReviewAt).toLocaleString()}
            </div>
          )}
          {consistencyReviewItems.length > 0 ? (
            <ul className={styles.consistencyList}>
              {consistencyReviewItems.slice(0, 24).map((item) => (
                <li key={item.id} className={styles.consistencyListItem}>
                  <strong>{item.issue.code}</strong> in{' '}
                  <button
                    type='button'
                    onClick={() => {
                      const doc = documents.find((entry) => entry.id === item.sceneId);
                      if (doc) handleSelectDocument(doc);
                    }}
                    className={styles.consistencySceneButton}
                  >
                    {item.sceneTitle}
                  </button>
                  : {item.issue.message}
                  {item.issue.relatedEntities && item.issue.relatedEntities.length > 0 && (
                    <span className={styles.consistencyRelated}>
                      {item.issue.relatedEntities.slice(0, 3).map((target) => (
                        <button
                          key={`${item.id}-${target.id}`}
                          type='button'
                          onClick={() => openWorldRecord(target)}
                          className={styles.consistencyRelatedButton}
                        >
                          Open {target.name}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.contextSummaryText}>No open review items.</p>
          )}
        </div>
      );
    }
    if (activeContextView === 'ai') {
      return (
        <AIAssistant
          projectId={activeProject.id}
          aiConfig={projectSettings?.aiSettings}
          projectMode={projectSettings?.projectMode}
          context={activeAIContext ?? undefined}
          onInsert={(text) =>
            setPendingAIInsert({
              text,
              context:
                activeAIContext && activeAIContext.from !== activeAIContext.to
                  ? {from: activeAIContext.from, to: activeAIContext.to}
                  : null
            })
          }
          queuedPrompt={queuedAssistantPrompt}
          onQueuedPromptConsumed={() => setQueuedAssistantPrompt(null)}
          consultationModel={projectSettings?.aiSettings?.inspectorSettings?.lowCostModel}
          consultationMaxTokens={projectSettings?.aiSettings?.inspectorSettings?.maxResponseTokens}
        />
      );
    }
    if (activeContextView === 'system') {
      return (
        <SystemHistoryPanel
          entries={systemHistoryEntries}
          onInsertEntry={(entry) =>
            setPendingAIInsert({
              text: entry.insertText,
              context: null
            })
          }
          onClear={() => {
            clearSystemHistoryEntries(activeProject.id);
            refreshSystemHistory();
            setFeedback({tone: 'success', message: 'System history cleared.'});
          }}
          onOpenScene={(sceneId) => {
            const doc = documents.find((entry) => entry.id === sceneId);
            if (doc) {
              handleSelectDocument(doc);
              return;
            }
            setFeedback({
              tone: 'error',
              message: 'Could not open scene for this system event.'
            });
          }}
          onRunConsistencyReview={() => {
            void handleRunConsistencyReview();
          }}
        />
      );
    }
    if (activeContextView === 'lore') {
      return (
        <LoreInspectorPanel
          record={activeLoreRecord}
          aiEnabled={projectSettings?.aiSettings?.inspectorSettings?.enableAIConsultation !== false}
          aiBudgetUsed={aiBudgetUsed}
          aiBudgetMax={projectSettings?.aiSettings?.inspectorSettings?.maxConsultationsPerDay ?? 20}
          onConsult={handleConsultationFromLore}
        />
      );
    }
    return (
      <div className={styles.contextSummary}>
        <p className={styles.contextSummaryText}>
          Modules: <strong>{settlementModules.length}</strong> · Party synergies:{' '}
          <strong>{activePartySynergies.length}</strong>
        </p>
        <button type='button' onClick={() => navigate('/compendium')}>
          Open Compendium
        </button>
      </div>
    );
  })();

  const contextDrawerPanel = (
    <>
      <div
        className={styles.contextCard}
      >
        <div className={styles.contextTabs}>
          {contextDrawerTabs
            .filter((tab) => !tab.hidden)
            .map((tab) => (
              <button
                key={tab.id}
                type='button'
                onClick={() => setActiveContextView(tab.id)}
                className={styles.contextTabButton}
                style={{
                  backgroundColor:
                    tab.id === activeContextView ? '#dbeafe' : 'transparent'
                }}
              >
                {tab.label}
              </button>
            ))}
        </div>
        <div className={styles.contextContent}>{contextDrawerContent}</div>
      </div>

      {selectedId && (
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
      )}
    </>
  );

  const sceneDrawerPanel = (
    <>
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
        <label className={styles.importModeLabel}>
          Import mode
          <select
            value={importMode}
            onChange={(event) => setImportMode(event.target.value as ImportMode)}
            disabled={isImportingDocuments}
            className={styles.importModeSelect}
          >
            <option value='balanced'>Balanced</option>
            <option value='strict'>Strict</option>
            <option value='lenient'>Lenient</option>
          </select>
        </label>
        <label className={styles.importToggleLabel}>
          <input
            type='checkbox'
            checked={skipImportSuggestions}
            disabled={isImportingDocuments}
            onChange={(event) => setSkipImportSuggestions(event.target.checked)}
          />
          Skip consistency suggestions for this import
        </label>
        <button
          type='button'
          onClick={() => openExportModalWithDrawerHandling('markdown')}
          disabled={documents.length === 0}
          style={{marginLeft: '0.5rem'}}
        >
          Export MD
        </button>
        <button
          type='button'
          onClick={() => openExportModalWithDrawerHandling('docx')}
          disabled={documents.length === 0}
          style={{marginLeft: '0.5rem'}}
        >
          Export DOCX
        </button>
        <button
          type='button'
          onClick={() => openExportModalWithDrawerHandling('epub')}
          disabled={documents.length === 0}
          style={{marginLeft: '0.5rem'}}
        >
          Export EPUB
        </button>
        <input
          ref={importInputRef}
          type='file'
          accept='.txt,.md,.markdown,.html,.htm,.docx,.doc,.pages,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
          multiple
          onChange={(e) => void handleImportDocuments(e)}
          style={{display: 'none'}}
        />
      </div>

      {importSummary && (
        <div className={styles.importSummaryPanel}>
          <strong>Import Summary</strong>
          <p className={styles.importSummaryText}>
            Imported {importSummary.importedCount} · Failed {importSummary.failedCount} ·
            Unresolved {importSummary.unresolvedCount} · Mode {importSummary.mode}
            {importSummary.openedTitle ? ` · Opened "${importSummary.openedTitle}"` : ''}
            {importSummary.suggestionsSkipped ? ' · Suggestions skipped' : ''}
          </p>
          <div className={styles.importSummaryActions}>
            <button
              type='button'
              onClick={() => void handleRetryFailedImports()}
              disabled={isImportingDocuments || retryImportFiles.length === 0}
            >
              Retry failed files only
            </button>
            <button
              type='button'
              onClick={() => {
                setImportSummary(null);
                setRetryImportFiles([]);
              }}
              disabled={isImportingDocuments}
            >
              Dismiss
            </button>
          </div>
          {importSummary.failures.length > 0 && (
            <ul className={styles.importSummaryList}>
              {importSummary.failures.slice(0, 6).map((item) => (
                <li key={`${item.fileName}-${item.reason}`}>
                  {item.fileName}:{' '}
                  {item.reason === 'legacy-doc'
                    ? 'Legacy .doc is unsupported.'
                    : item.reason === 'apple-pages'
                      ? item.detail ?? 'Apple Pages file: export as .docx/.txt then import.'
                      : item.detail ?? 'Could not parse this file.'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
              backgroundColor: doc.id === selectedId ? '#eee' : 'transparent',
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
    </>
  );

  return (
    <section data-workspace-root='true' className={styles.workspaceRoot}>
      {feedback && (
        <p
          role='status'
          className={`${styles.feedbackBanner} ${
            feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess
          }`}
        >
          {feedback.message}
        </p>
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
      {unknownGuardrailIssues.length > 0 && (
        <div className={styles.unknownPanel}>
          <strong>
            {hasBlockingUnknownGuardrailIssues
              ? 'Commit blocked: unknown entities detected.'
              : 'Inline review items highlighted in the scene.'}
          </strong>
          <div className={styles.unknownSummary}>
            {unknownGuardrailIssues.length} item
            {unknownGuardrailIssues.length === 1 ? '' : 's'} highlighted. Click the
            underlined text in the editor to create, link, or dismiss each one.
          </div>
          <div className={styles.unknownBulkActions}>
            <button
              type='button'
              onClick={() => void resolveAllUnknownEntities()}
              className={styles.unknownActionButton}
            >
              Accept all as new entities
            </button>
            <button
              type='button'
              onClick={dismissAllUnknownEntities}
              className={styles.unknownActionButtonSpaced}
            >
              {hasBlockingUnknownGuardrailIssues
                ? 'Dismiss all for now'
                : 'Hide all warnings for now'}
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
            {sceneDrawerPanel}
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
                />
                {consistencyPopover && activeConsistencyPopoverIssue && (
                  <ContextPopover
                    title={activeConsistencyPopoverIssue.surface}
                    message={activeConsistencyPopoverIssue.message}
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
                          aria-label='Entity category'
                        >
                          <option value=''>Auto-select category</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type='button'
                        onClick={() => void resolveUnknownEntity(
                          activeConsistencyPopoverIssue.surface,
                          unknownCategorySelection[activeConsistencyPopoverIssue.surface] || undefined
                        )}
                        disabled={resolvingUnknown === activeConsistencyPopoverIssue.surface}
                      >
                        {resolvingUnknown === activeConsistencyPopoverIssue.surface
                          ? 'Creating...'
                          : 'Create entity'}
                      </button>
                      <button
                        type='button'
                        onClick={() => dismissUnknownEntity(activeConsistencyPopoverIssue.surface)}
                      >
                        Dismiss
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
                          <option value=''>Select entity...</option>
                          {unknownLinkOptions[activeConsistencyPopoverIssue.surface].map(
                            (entity) => (
                              <option key={entity.id} value={entity.id}>
                                {entity.name}
                              </option>
                            )
                          )}
                        </select>
                        <button
                          type='button'
                          onClick={() =>
                            void linkUnknownEntity(
                              activeConsistencyPopoverIssue.surface,
                              unknownLinkSelection[activeConsistencyPopoverIssue.surface]
                            )
                          }
                          disabled={
                            linkingUnknown === activeConsistencyPopoverIssue.surface ||
                            !unknownLinkSelection[activeConsistencyPopoverIssue.surface]
                          }
                        >
                          {linkingUnknown === activeConsistencyPopoverIssue.surface
                            ? 'Linking...'
                            : 'Link alias'}
                        </button>
                      </div>
                    ) : (
                      <div className={styles.consistencyPopoverNote}>
                        No close entity matches available.
                      </div>
                    )}
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
                    onClick={toggleSceneDrawer}
                  >
                    {isSceneDrawerOpen ? 'Scenes on' : 'Scenes off'}
                  </button>
                  <button
                    type='button'
                    className={styles.drawerTopButton}
                    onClick={toggleContextDrawer}
                  >
                    {isContextDrawerOpen ? 'Context on' : 'Context off'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p>Select a scene from the left, or create one with + New Scene.</p>
          )}
        </div>

        {isContextDrawerOpen && !isNarrowViewport && (
          <aside className={styles.contextDrawerDesktop}>
            {contextDrawerPanel}
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
            {sceneDrawerPanel}
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
            {contextDrawerPanel}
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
