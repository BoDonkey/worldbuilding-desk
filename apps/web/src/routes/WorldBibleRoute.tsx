import {useEffect, useState, useCallback, useRef, useMemo} from 'react';
import type {FormEvent} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {useEscapeToClose} from '../hooks/useEscapeToClose';
import {useFocusTrap} from '../hooks/useFocusTrap';
import {useConfirmDialog} from '../hooks/useConfirmDialog';
import {useAppStore} from '../store/appStore';
import {getProjectCapabilities} from '../projectMode';
import type {EntityCategory, WorldEntity} from '../entityTypes';
import {ProjectScratchpadButton} from '../components/ProjectScratchpadButton';
import {PageHeader} from '../components/PageHeader';
import {CategoryManager} from '../components/WorldBible/CategoryManager';
import {EntityFieldEditor} from '../components/WorldBible/EntityFieldEditor';
import {WorldBibleImportWorkspace} from '../components/WorldBible/WorldBibleImportWorkspace';
import {WorldBibleEntityList} from '../components/WorldBible/WorldBibleEntityList';
import {WorldBibleRecordAiHelper} from '../components/WorldBible/WorldBibleRecordAiHelper';
import {WorldBibleCharacterHealth} from '../components/WorldBible/WorldBibleCharacterHealth';
import {WorldBibleLinkedSourceNote} from '../components/WorldBible/WorldBibleLinkedSourceNote';
import {WorldBibleDialogueStyleControl} from '../components/WorldBible/WorldBibleDialogueStyleControl';
import {WorldBibleMechanicsPanel} from '../components/WorldBible/WorldBibleMechanicsPanel';
import {
  WorldBibleCharacterSections,
  type CharacterDetailSection
} from '../components/WorldBible/WorldBibleCharacterSections';
import {CharacterIdentityResolutionQueue} from '../components/WorldBible/CharacterIdentityResolutionQueue';
import {WorldBibleCategoryRail} from '../components/WorldBible/WorldBibleCategoryRail';
import {ItemDescriptionFirstFields} from '../components/WorldBible/ItemDescriptionFirstFields';
import {SystemNegativeSpacePanel} from '../components/WorldBible/SystemNegativeSpacePanel';
import styles from '../assets/components/WorldBibleRoute.module.css';
import type {MemoryEntry} from '../services/shodh/ShodhMemoryService';
import {ShodhMemoryPanel} from '../components/ShodhMemoryPanel';
import {useWorldBibleReview} from '../hooks/useWorldBibleReview';
import {
  useWorldBibleImports
} from '../hooks/useWorldBibleImports';
import {useWorldBibleEntityActions} from '../hooks/useWorldBibleEntityActions';
import {
  getSeriesBibleConfig,
  promoteMemoryToParent
} from '../services/seriesBible/SeriesBibleService';
import {
  ALTERNATIVE_NAMES_KEY,
  buildWorldBibleEntityContent,
  formatAlternativeNames,
  getPreferredImportField,
  getWorldBibleFieldTemplateValue,
  normalizeRichTextValue,
  normalizeName,
  parseAlternativeNames
} from '../services/worldBible/worldBibleEntityHelpers';
import {
  getReviewResolutionLabel
} from '../services/worldBible/worldBibleReviewHelpers';
import {
  CHARACTER_AUTHORING_FIELD_KEYS,
  CHARACTER_IDENTITY_FIELD_KEYS,
  CHARACTER_NOTES_FIELD,
  isCharacterCategory,
  isItemCategory
} from '../services/worldBible/worldBibleSummary';
import {useWorldBibleProjectData} from '../hooks/useWorldBibleProjectData';
import {useWorldBibleSelectedEntity} from '../hooks/useWorldBibleSelectedEntity';
import {useCharacterIdentityResolutionQueue} from '../hooks/useCharacterIdentityResolutionQueue';
import {
  useWorldBibleAuthoringAssistant
} from '../hooks/useWorldBibleAuthoringAssistant';
import {
  useWorldBibleRecordResolution,
  type WorldBibleCanonicalizationHandoff
} from '../hooks/useWorldBibleRecordResolution';
import {createFirstCharacterMechanics} from '../services/characters';
import {
  isSystemNegativeSpaceCategory,
  normalizeSystemNegativeSpaceRecord,
  type SystemNegativeSpaceStatus
} from '../services/worldBible/systemNegativeSpace';
import {describeError} from '../services/errors';
import {RouteFeedback} from '../components/common';

type WorldBibleViewMode = 'category' | 'review';
type CharacterAuthoringMode = 'idle' | 'manual';
type RecordAuthoringMode = 'idle' | 'manual';

const getWorldBibleRailStorageKey = (projectId: string) =>
  `wbd:world-bible:category-rail-collapsed:${projectId}`;

const triggerJsonDownload = (fileName: string, data: unknown): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
function WorldBibleRoute() {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const saveProjectSettings = useAppStore((s) => s.saveProjectSettings);
  const location = useLocation();
  const navigate = useNavigate();
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<WorldBibleViewMode>('category');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [activeImportPreviewId, setActiveImportPreviewId] = useState<string | null>(null);
  const [characterAuthoringMode, setCharacterAuthoringMode] =
    useState<CharacterAuthoringMode>('idle');
  const [recordAuthoringMode, setRecordAuthoringMode] =
    useState<RecordAuthoringMode>('idle');
  const [negativeSpaceStatus, setNegativeSpaceStatus] =
    useState<SystemNegativeSpaceStatus>('open');
  const [negativeSpaceSceneIds, setNegativeSpaceSceneIds] = useState<string[]>([]);
  const [characterDetailSection, setCharacterDetailSection] =
    useState<CharacterDetailSection>('canon');
  const [areItemDetailsExpanded, setAreItemDetailsExpanded] = useState(false);
  const [isPasteImportOpen, setIsPasteImportOpen] = useState(false);
  const [pastedImportText, setPastedImportText] = useState('');
  const [isNameResolverOpen, setIsNameResolverOpen] = useState(false);
  const [manualResolutionTargetId, setManualResolutionTargetId] = useState('');
  const [moveCategoryTargetId, setMoveCategoryTargetId] = useState('');
  const [movingEntityCategoryId, setMovingEntityCategoryId] = useState<string | null>(null);
  const [memoryFilter, setMemoryFilter] = useState('');
  const [pendingReviewFocus, setPendingReviewFocus] = useState<'general' | 'aliases' | null>(
    null
  );
  const [handoffGuidance, setHandoffGuidance] =
    useState<WorldBibleCanonicalizationHandoff | null>(null);
  const reviewFilter = 'all' as const;
  const recommendedFilter = 'all' as const;
  const seriesConfig = activeProject
    ? getSeriesBibleConfig(activeProject)
    : null;
  const capabilities = getProjectCapabilities(projectSettings);
  const showGameSystems = capabilities.canUseGameSystems;
  const showCharacterMechanics = capabilities.canUseRuleAuthoring;
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isCategoryRailCollapsed, setIsCategoryRailCollapsed] = useState(false);
  const [promotingMemoryId, setPromotingMemoryId] = useState<string | null>(null);
  const [isCreatingFirstMechanics, setIsCreatingFirstMechanics] = useState(false);
  const {
    categories,
    setCategories,
    entities,
    setEntities,
    characters,
    setCharacters,
    characterSheets,
    setCharacterSheets,
    ruleset,
    setRuleset,
    characterIdentityReport,
    writingDocuments,
    canonicalFacts,
    stateMutationEvents,
    loreDocuments,
    loreDocumentLinks,
    aliases,
    setAliases,
    ragService,
    shodhService,
    memories,
    refreshMemories,
    canonState,
    setCanonState,
    compendiumLinkedEntityIds,
    setCompendiumLinkedEntityIds
  } = useWorldBibleProjectData({
    activeProject,
    enableSystemNegativeSpace: showGameSystems,
    setFeedback
  });
  const characterIdentityResolution = useCharacterIdentityResolutionQueue({
    activeProject, projectSettings, saveProjectSettings, categories, entities,
    characters, characterSheets, report: characterIdentityReport, setFeedback
  });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const jsonImportInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!activeProject) {
      setIsCategoryRailCollapsed(false);
      return;
    }
    setIsCategoryRailCollapsed(
      window.localStorage.getItem(getWorldBibleRailStorageKey(activeProject.id)) === 'true'
    );
  }, [activeProject]);

  const aliasTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const focusedEntityKeyRef = useRef<string | null>(null);
  const handlePromoteMemory = useCallback(
    async (memory: MemoryEntry) => {
      if (!seriesConfig?.parentProjectId) return;
      setPromotingMemoryId(memory.id);
      setFeedback(null);
      try {
        await promoteMemoryToParent(memory, seriesConfig.parentProjectId);
        await refreshMemories();
        setFeedback({tone: 'success', message: 'Memory promoted to parent canon.'});
      } catch (error) {
        const message =
          describeError(error, 'Unable to promote memory.');
        setFeedback({tone: 'error', message});
      } finally {
        setPromotingMemoryId(null);
      }
    },
    [seriesConfig?.parentProjectId, refreshMemories]
  );

  const worldBibleCategories = useMemo(
    () => showGameSystems
      ? categories
      : categories.filter((category) => !isSystemNegativeSpaceCategory(category)),
    [categories, showGameSystems]
  );

  useEffect(() => {
    if (
      worldBibleCategories.length > 0 &&
      !worldBibleCategories.some((category) => category.id === activeTab)
    ) {
      setActiveTab(worldBibleCategories[0].id);
    }
  }, [worldBibleCategories, activeTab]);

  const activeCategory = worldBibleCategories.find((c) => c.id === activeTab);
  const characterCategory = useMemo(
    () => categories.find((category) => isCharacterCategory(category)) ?? null,
    [categories]
  );
  const activeCategoryIsCharacterLike = useMemo(
    () => Boolean(activeCategory && isCharacterCategory(activeCategory)),
    [activeCategory]
  );
  const activeCategoryIsItem = Boolean(activeCategory && isItemCategory(activeCategory));
  const activeCategoryIsSystemNegativeSpace = isSystemNegativeSpaceCategory(activeCategory);
  const systemNegativeSpaceDraft = useMemo(
    () => activeCategoryIsSystemNegativeSpace
      ? normalizeSystemNegativeSpaceRecord(
          {status: negativeSpaceStatus, sceneIds: negativeSpaceSceneIds},
          new Set(writingDocuments.map((document) => document.id))
        )
      : undefined,
    [
      activeCategoryIsSystemNegativeSpace,
      negativeSpaceSceneIds,
      negativeSpaceStatus,
      writingDocuments
    ]
  );
  const isDescriptionFirstItemDraft = activeCategoryIsItem && !editingId;
  const itemDescriptionField = activeCategoryIsItem
    ? activeCategory?.fieldSchema.find((field) => field.key === 'description') ?? null
    : null;
  const characterDescriptionField = activeCategoryIsCharacterLike
    ? activeCategory?.fieldSchema.find((field) => field.key === 'description') ?? null
    : null;
  const characterNotesField = activeCategoryIsCharacterLike
    ? activeCategory?.fieldSchema.find((field) => field.key === CHARACTER_NOTES_FIELD) ?? null
    : null;
  const characterIdentityFields = activeCategoryIsCharacterLike
    ? CHARACTER_IDENTITY_FIELD_KEYS.map((key) =>
        activeCategory?.fieldSchema.find((field) => field.key === key)
      ).filter((field): field is EntityCategory['fieldSchema'][number] => Boolean(field))
    : [];
  const characterCustomFields = activeCategoryIsCharacterLike
    ? activeCategory?.fieldSchema.filter(
        (field) => !CHARACTER_AUTHORING_FIELD_KEYS.has(field.key)
      ) ?? []
    : [];
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const worldBibleImports = useWorldBibleImports({
    activeProjectId: activeProject?.id ?? null,
    activeCategory: activeCategory ?? null,
    categories,
    entities,
    setCategories,
    setEntities,
    setFeedback,
    onEntitySaved: async (entity, category) => {
      const content = buildWorldBibleEntityContent(entity);
      if (ragService) {
        await ragService.indexDocument(
          entity.id,
          entity.name,
          content,
          'worldbible',
          {
            tags: [category.slug],
            entityIds: [entity.id]
          }
        );
      }
      if (shodhService) {
        await shodhService.captureAutoMemory({
          projectId: entity.projectId,
          documentId: entity.id,
          title: entity.name,
          content,
          tags: ['worldbible', category.slug]
        });
      }
    },
    onEntitiesChanged: refreshMemories
  });
  const {
    isImportingEntities,
    importDrafts,
    isImportingJson,
    handleImportEntities,
    preparePastedImportDraft,
    updateImportDraft,
    applyImportDrafts,
    handleJsonImportFile,
  } = worldBibleImports;
  const currentEntityMemories = editingId
    ? memories.filter((memory) => memory.documentId === editingId)
    : [];
  const aliasMapByEntityId = useMemo(() => {
    const map = new Map<string, string[]>();
    aliases.forEach((alias) => {
      if (alias.targetType !== 'entity') {
        return;
      }
      const current = map.get(alias.targetId) ?? [];
      map.set(
        alias.targetId,
        parseAlternativeNames([...current, alias.alias].join(', '))
      );
    });
    return map;
  }, [aliases]);

  const ignoredEntityMatchKeys = useMemo(
    () => new Set(projectSettings?.ignoredEntityMatchKeys ?? []),
    [projectSettings?.ignoredEntityMatchKeys]
  );
  const richImportDraftCount = useMemo(
    () =>
      importDrafts.filter((draft) => {
        const category = categoryById.get(draft.categoryId);
        const preferredField = category ? getPreferredImportField(category) : null;
        return preferredField?.type === 'textarea';
      }).length,
    [categoryById, importDrafts]
  );
  const activeImportPreviewDraft = useMemo(
    () => importDrafts.find((draft) => draft.id === activeImportPreviewId) ?? null,
    [activeImportPreviewId, importDrafts]
  );
  const importPreviewDialogRef = useRef<HTMLDivElement | null>(null);
  const closeImportPreviewDialog = useCallback(() => {
    setActiveImportPreviewId(null);
  }, [setActiveImportPreviewId]);
  const isImportPreviewDialogOpen = Boolean(activeImportPreviewDraft);
  useEscapeToClose(closeImportPreviewDialog, isImportPreviewDialogOpen);
  useFocusTrap(importPreviewDialogRef, isImportPreviewDialogOpen);
  const {
    selectedEntity,
    selectedEntityCharacterExtension,
    selectedEntityCharacterSheet,
    linkedLoreDocumentByEntityId,
    linkedLoreDocumentsForSelectedEntity,
    selectedEntityAliases,
    selectedEntityFacts,
    selectedEntitySceneMentions,
    selectedEntityStateEvents,
    selectedEntityAcceptedStateEventCount,
    selectedEntityProposedStateEventCount,
    characterHealthProbeResults,
    characterHealthProbeRunning,
    handleCharacterHealthProbe,
    linkingLoreEntityId,
    handleOpenOrCreateLinkedLoreDocument
  } = useWorldBibleSelectedEntity({
    activeProject,
    editingId,
    categories,
    entities,
    characters,
    characterSheets,
    loreDocuments,
    loreDocumentLinks,
    aliasMapByEntityId,
    canonicalFacts,
    writingDocuments,
    stateMutationEvents,
    ragService,
    categoryById,
    navigate,
    setFeedback
  });
  const worldBibleAuthoring = useWorldBibleAuthoringAssistant({
    activeCategory: activeCategory ?? null,
    setCategories,
    selectedEntity,
    name,
    setName,
    fieldValues,
    setFieldValues,
    importDrafts,
    categoryById,
    updateImportDraft,
    setFeedback
  });
  const {
    isRecordAiHelperOpen,
    setIsRecordAiHelperOpen,
    setIsImportAiHelperOpen,
    setAiHelperSelectedText,
    setAiHelperActionTarget,
    setAiHelperNewSectionLabel,
    setAiHelperProposal,
    newCharacterSectionName,
    setNewCharacterSectionName,
    activeCategoryRecordLabel,
    currentCharacterLabel,
    handleAddCharacterSection
  } = worldBibleAuthoring;
  const isFocusedCharacterTask = activeCategoryIsCharacterLike
    ? Boolean(editingId || characterAuthoringMode !== 'idle')
    : false;
  const isFocusedRecordTask = !activeCategoryIsCharacterLike
    ? Boolean(
        recordAuthoringMode !== 'idle' ||
          (editingId && selectedEntity?.categoryId === activeCategory?.id)
      )
    : false;
  const {
    reviewQueue,
    filteredReviewQueue,
    potentialEntityMatches,
    reviewEntityInsightsById,
    visibleEntities,
    selectedEntityQueueItem
  } = useWorldBibleReview({
    entities,
    aliases,
    categories,
    aliasMapByEntityId,
    activeTab,
    viewMode,
    reviewFilter,
    recommendedFilter,
    editingId,
    name,
    fieldValues,
    selectedEntity,
    alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
    ignoredEntityMatchKeys,
    normalizeName,
    parseAlternativeNames
  });
  const memoryPanelEmpty =
    'This entry has no captured memories yet. Save it to generate one or adjust the filter.';

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setFieldValues({});
    setPendingReviewFocus(null);
    setIsNameResolverOpen(false);
    setManualResolutionTargetId('');
    setMoveCategoryTargetId('');
    setCharacterAuthoringMode('idle');
    setCharacterDetailSection('canon');
    setRecordAuthoringMode('idle');
    setNegativeSpaceStatus('open');
    setNegativeSpaceSceneIds([]);
    setAreItemDetailsExpanded(false);
    setIsPasteImportOpen(false);
    setPastedImportText('');
    setIsRecordAiHelperOpen(false);
    setIsImportAiHelperOpen(false);
    setAiHelperSelectedText('');
    setAiHelperActionTarget('name');
    setAiHelperNewSectionLabel('');
    setAiHelperProposal(null);
    setNewCharacterSectionName('');
  };

  const handleSelectCategoryTab = (categoryId: string) => {
    setViewMode('category');
    setActiveTab(categoryId);
    resetForm();
  };

  const handleSelectReview = () => { setViewMode('review'); resetForm(); };

  const handleToggleCategoryRail = () => {
    setIsCategoryRailCollapsed((current) => {
      const next = !current;
      if (activeProject) {
        window.localStorage.setItem(getWorldBibleRailStorageKey(activeProject.id), String(next));
      }
      return next;
    });
  };

  const openCharacterCategory = useCallback(() => {
    if (!characterCategory) return;
    setViewMode('category');
    setActiveTab(characterCategory.id);
  }, [characterCategory]);

  const startNewCharacterCanonRecord = useCallback(() => {
    openCharacterCategory();
    setEditingId(null);
    setName('');
    setFieldValues({});
    setCharacterAuthoringMode('manual');
    setCharacterDetailSection('canon');
    setRecordAuthoringMode('idle');
    setIsPasteImportOpen(false);
    setPastedImportText('');
    setIsRecordAiHelperOpen(false);
    setAiHelperSelectedText('');
    setAiHelperActionTarget('name');
    setAiHelperNewSectionLabel('');
    setAiHelperProposal(null);
  }, [
    openCharacterCategory,
    setAiHelperActionTarget,
    setAiHelperNewSectionLabel,
    setAiHelperProposal,
    setAiHelperSelectedText,
    setIsRecordAiHelperOpen
  ]);

  const startNewCategoryRecord = useCallback(() => {
    if (!activeCategory) return;
    setViewMode('category');
    setEditingId(null);
    setName('');
    setFieldValues({});
    setPendingReviewFocus(null);
    setIsNameResolverOpen(false);
    setManualResolutionTargetId('');
    setCharacterAuthoringMode('idle');
    setCharacterDetailSection('canon');
    setRecordAuthoringMode('manual');
    setNegativeSpaceStatus('open');
    setNegativeSpaceSceneIds([]);
    setAreItemDetailsExpanded(false);
    setIsPasteImportOpen(false);
    setPastedImportText('');
    setIsRecordAiHelperOpen(false);
    setAiHelperSelectedText('');
    setAiHelperActionTarget('name');
    setAiHelperNewSectionLabel('');
    setAiHelperProposal(null);
  }, [
    activeCategory,
    setAiHelperActionTarget,
    setAiHelperNewSectionLabel,
    setAiHelperProposal,
    setAiHelperSelectedText,
    setIsRecordAiHelperOpen
  ]);

  const handlePreparePastedImportDraft = () => {
    if (!activeCategory) return;
    preparePastedImportDraft(pastedImportText, `Pasted ${activeCategory.name.replace(/s$/i, '')}`);
    if (pastedImportText.trim()) {
      setIsPasteImportOpen(false);
      setPastedImportText('');
    }
  };

  const handleEdit = useCallback((entity: WorldEntity, focus: 'general' | 'aliases' = 'general') => {
    setEditingId(entity.id);
    const entityCategory = categoryById.get(entity.categoryId);
    const entityIsCharacterCategory = Boolean(
      entityCategory && isCharacterCategory(entityCategory)
    );
    setCharacterAuthoringMode(
      entityIsCharacterCategory ? 'manual' : 'idle'
    );
    setCharacterDetailSection('canon');
    setRecordAuthoringMode(entityIsCharacterCategory ? 'idle' : 'manual');
    setAreItemDetailsExpanded(true);
    setPendingReviewFocus(focus);
    setAiHelperSelectedText('');
    setAiHelperNewSectionLabel('');
    setAiHelperProposal(null);
    setName(entity.name);
    setNegativeSpaceStatus(entity.systemNegativeSpace?.status ?? 'open');
    setNegativeSpaceSceneIds(entity.systemNegativeSpace?.sceneIds ?? []);
    setMoveCategoryTargetId(entity.categoryId);
    const persistedAlternativeNames =
      typeof entity.fields[ALTERNATIVE_NAMES_KEY] === 'string'
        ? entity.fields[ALTERNATIVE_NAMES_KEY]
        : '';
    const indexedAlternativeNames = aliasMapByEntityId.get(entity.id) ?? [];
    const mergedAlternativeNames = formatAlternativeNames(
      parseAlternativeNames(
        [...parseAlternativeNames(persistedAlternativeNames), ...indexedAlternativeNames]
          .filter((alias) => alias.trim().toLowerCase() !== entity.name.trim().toLowerCase())
          .join(', ')
      )
    );
    const normalizedFields = Object.fromEntries(
      Object.entries(entity.fields as Record<string, string>).map(([key, value]) => {
        const fieldType = categories
          .find((category) => category.id === entity.categoryId)
          ?.fieldSchema.find((field) => field.key === key)?.type;
        return [
          key,
          fieldType === 'textarea'
            ? normalizeRichTextValue(String(value ?? ''))
            : String(value ?? '')
        ];
      })
    );
    setFieldValues({
      ...normalizedFields,
      [ALTERNATIVE_NAMES_KEY]: mergedAlternativeNames
    });
  }, [
    aliasMapByEntityId,
    categories,
    categoryById,
    setAiHelperNewSectionLabel,
    setAiHelperProposal,
    setAiHelperSelectedText
  ]);

  const handleOpenReviewItem = useCallback(
    (entity: WorldEntity, focus: 'general' | 'aliases' = 'general') => {
      setViewMode('category');
      setActiveTab(entity.categoryId);
      handleEdit(entity, focus);
    },
    [handleEdit]
  );

  const hasRuleset = Boolean(activeProject?.rulesetId);

  const {
    isSubmittingEntity,
    deletingEntityId,
    promotingEntityId,
    importingCharacterEntityId,
    exportingCharacterEntityId,
    mergingEntityTargetId,
    aliasingEntityTargetId,
    isSyncingCanon,
    linkingCompendiumEntityId,
    saveEntityDraft,
    handleMarkEntityComplete,
    handleDeleteEntity,
    handleMergeEntityIntoMatch,
    handleMergeMatchIntoCurrentEntity,
    handleConvertEntityToAlias,
    handleImportEntityToCharacters,
    handleExportCharacter,
    handleAddEntityToCompendium,
    handlePromoteEntity,
    handleCanonSync,
    isCharacterLikeEntity
  } = useWorldBibleEntityActions({
    requestConfirm,
    activeProject,
    activeCategory: activeCategory ?? null,
    categories,
    entities,
    characters,
    setCharacters,
    setEntities,
    setAliases,
    setFeedback,
    setViewMode,
    setCanonState,
    ragService,
    shodhService,
    refreshMemories,
    editingId,
    name,
    fieldValues,
    systemNegativeSpace: systemNegativeSpaceDraft,
    viewMode,
    selectedEntityQueueItem,
    filteredReviewQueue,
    aliasMapByEntityId,
    compendiumLinkedEntityIds,
    setCompendiumLinkedEntityIds,
    hasRuleset,
    seriesParentProjectId: seriesConfig?.parentProjectId ?? null,
    normalizeName,
    parseAlternativeNames,
    formatAlternativeNames,
    buildEntityContent: buildWorldBibleEntityContent,
    alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
    openReviewItem: handleOpenReviewItem,
    handleEdit,
    resetForm,
    navigate: (to, options) => navigate(to, options as never)
  });

  const {
    isCanonicalRenameDraft,
    suggestedCharacterAliases,
    canonicalRenameAliasPreview,
    manualResolutionTargets,
    manualResolutionTarget,
    canonicalResolutionMatches,
    handleSaveCanonicalRename,
    handlePromoteAliasToCanonical,
    handleMoveSelectedEntityCategory,
    handleKeepSeparateMatch,
    handleIgnoreEntityMatch,
    handleAddSuggestedCharacterAlias
  } = useWorldBibleRecordResolution({
    activeProject,
    projectSettings,
    saveProjectSettings,
    activeCategoryIsCharacterLike,
    activeTab,
    editingId,
    name,
    setName,
    fieldValues,
    setFieldValues,
    selectedEntity,
    selectedEntityAliases,
    entities,
    setEntities,
    categories,
    potentialEntityMatches,
    handoffGuidance,
    manualResolutionTargetId,
    setManualResolutionTargetId,
    moveCategoryTargetId,
    setMovingEntityCategoryId,
    setActiveTab,
    setIsNameResolverOpen,
    setFeedback,
    ragService,
    shodhService,
    refreshMemories,
    buildEntityContent: buildWorldBibleEntityContent,
    handleEdit,
    saveEntityDraft
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (activeCategoryIsItem && !editingId) {
      await saveEntityDraft({successMessage: 'Item saved.'});
      return;
    }
    await saveEntityDraft();
  };

  useEffect(() => {
    if (pendingReviewFocus !== 'aliases') return;
    aliasTextareaRef.current?.focus();
    aliasTextareaRef.current?.setSelectionRange(
      aliasTextareaRef.current.value.length,
      aliasTextareaRef.current.value.length
    );
    setPendingReviewFocus(null);
  }, [editingId, pendingReviewFocus]);

  useEffect(() => {
    const state = location.state as {
      focusEntityId?: string;
      focusCategorySlug?: string;
      startCharacterImport?: boolean;
      focus?: 'general' | 'aliases';
      focusCharacterSection?: CharacterDetailSection;
      handoffKind?: 'character-canonicalization';
      handoffSourceName?: string;
      handoffMatchEntityId?: string;
    } | null;
    if (state?.focusCategorySlug && categories.length > 0) {
      const targetCategory = categories.find(
        (category) => category.slug === state.focusCategorySlug
      );
      if (targetCategory && activeTab !== targetCategory.id) {
        setActiveTab(targetCategory.id);
      }
      setViewMode('category');
      if (state.startCharacterImport && !isPasteImportOpen) {
        setIsPasteImportOpen(true);
      }
    }
    const focusEntityId = state?.focusEntityId;
    if (!focusEntityId) return;
    const focus = state?.focus ?? 'general';
    const focusKey = `${location.key}:${focusEntityId}:${focus}:${state?.focusCharacterSection ?? ''}`;
    if (focusedEntityKeyRef.current === focusKey) {
      return;
    }
    const target = entities.find((entity) => entity.id === focusEntityId);
    if (!target) return;
    setActiveTab(target.categoryId);
    setViewMode('category');
    handleEdit(target, focus);
    if (state?.focusCharacterSection) {
      setCharacterDetailSection(state.focusCharacterSection);
    }
    if (state?.handoffKind === 'character-canonicalization' && state.handoffSourceName) {
      setHandoffGuidance({
        kind: 'character-canonicalization',
        sourceName: state.handoffSourceName,
        matchEntityId: state.handoffMatchEntityId
      });
    }
    focusedEntityKeyRef.current = focusKey;
  }, [activeTab, categories, entities, handleEdit, isPasteImportOpen, location.key, location.state]);

  const handleApplyImportDrafts = async (options?: {
    draftIds?: string[];
    openFirstImported?: boolean;
  }) => {
    const firstImportedEntity = await applyImportDrafts(options);
    if (options?.openFirstImported && firstImportedEntity) {
      setActiveImportPreviewId(null);
      setViewMode('category');
      setActiveTab(firstImportedEntity.categoryId);
      handleEdit(firstImportedEntity);
    }
  };

  const handleDownloadJsonTemplate = () => {
    if (!activeCategory) return;
    const row: Record<string, unknown> = {
      name: `${activeCategory.name.slice(0, -1) || 'Entry'} Name`
    };
    activeCategory.fieldSchema.forEach((field) => {
      row[field.key] = getWorldBibleFieldTemplateValue(field);
    });
    triggerJsonDownload(
      `${activeCategory.slug || 'worldbible'}-template.json`,
      {
        entries: [row],
        notes: {
          description:
            'Use this template for World Bible JSON import. Keep "name" populated for each row.'
        }
      }
    );
  };

  const handleDownloadJsonSample = () => {
    if (!activeCategory) return;
    const baseName = activeCategory.name.slice(0, -1) || 'Entry';
    const makeRow = (index: number): Record<string, unknown> => {
      const row: Record<string, unknown> = {
        name: `${baseName} ${index}`
      };
      activeCategory.fieldSchema.forEach((field) => {
        const value = getWorldBibleFieldTemplateValue(field);
        if (typeof value === 'string' && value.length > 0) {
          row[field.key] = `${value} ${index}`.trim();
        } else {
          row[field.key] = value;
        }
      });
      return row;
    };
    triggerJsonDownload(
      `${activeCategory.slug || 'worldbible'}-sample.json`,
      {
        entries: [makeRow(1), makeRow(2), makeRow(3)]
      }
    );
  };

  const renderEntityField = (field: EntityCategory['fieldSchema'][number]) => (
    <EntityFieldEditor
      key={field.key}
      field={field}
      fieldValues={fieldValues}
      variant={activeCategoryIsCharacterLike ? 'character' : 'default'}
      onFieldValuesChange={setFieldValues}
    />
  );

  if (!activeProject) {
    return (
      <section className={styles.noProject}>
        <h1>World Bible</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.container}>
      <PageHeader
        eyebrow='Structured canon'
        title='World Bible'
        description='Keep canonical names, aliases, and structured story facts here. Use Source Notes for longform dossiers and background material.'
        actions={
          <>
            <ProjectScratchpadButton projectId={activeProject.id} />
            <button
              type='button'
              className={styles.categoryRailToggle}
              onClick={handleToggleCategoryRail}
            >
              {isCategoryRailCollapsed ? 'Show categories' : 'Hide categories'}
            </button>
          </>
        }
      />
      {activeCategory && (
        <>
          <input
            ref={importInputRef}
            type='file'
            accept='.txt,.md,.markdown,.html,.htm,.docx,.doc,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
            multiple
            onChange={(e) => void handleImportEntities(e)}
            style={{display: 'none'}}
          />
          <input
            ref={jsonImportInputRef}
            type='file'
            accept='.json,application/json'
            onChange={(e) => void handleJsonImportFile(e)}
            style={{display: 'none'}}
          />
        </>
      )}
      <div
        className={`${styles.routeShell} ${
          isCategoryRailCollapsed ? styles.routeShellRailCollapsed : ''
        }`}
      >
        <WorldBibleCategoryRail
          isCollapsed={isCategoryRailCollapsed} categories={worldBibleCategories}
          viewMode={viewMode} activeTab={activeTab}
          reviewCount={reviewQueue.length + characterIdentityResolution.queue.length}
          showCategoryManager={showCategoryManager}
          isImportingEntities={isImportingEntities} isImportingJson={isImportingJson}
          importInputRef={importInputRef} jsonImportInputRef={jsonImportInputRef}
          onSelectCategory={handleSelectCategoryTab}
          onSelectReview={handleSelectReview}
          onToggleCategoryManager={() => setShowCategoryManager((value) => !value)}
          onDownloadJsonTemplate={handleDownloadJsonTemplate}
          onDownloadJsonSample={handleDownloadJsonSample}
        />

        <div className={styles.mainColumn}>
      <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} />
      {seriesConfig?.parentProjectId && (
        <div className={styles.banner}>
          <strong>Parent canon:</strong> {canonState.parentName ?? 'Unknown'} ·
          Version {canonState.parentCanonVersion ?? 'n/a'}
          {canonState.parentCanonVersion &&
            canonState.childLastSynced &&
            canonState.parentCanonVersion !== canonState.childLastSynced && (
              <span className={styles.outOfSync}>Out of sync</span>
            )}
          <div className={styles.syncRow}>
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

      {viewMode === 'review' && (
        <CharacterIdentityResolutionQueue
          items={characterIdentityResolution.queue} canonicalCharacters={characterIdentityResolution.canonicalCharacters}
          resolvingKey={characterIdentityResolution.resolvingKey} onLink={characterIdentityResolution.linkToCanon}
          onCreateCanon={characterIdentityResolution.createCanon} onKeepSeparate={characterIdentityResolution.keepSeparate}
          canonReviewItems={filteredReviewQueue} onOpenCanonReview={handleOpenReviewItem}
        />
      )}

      {activeCategory && viewMode === 'category' && (
        <section className={styles.castPanel} aria-label={`${activeCategory.name} canon`}>
          <div className={styles.castHeader}>
            <div>
              <div className={styles.castEyebrow}>{activeCategory.name} canon</div>
              <h2>{activeCategory.name}</h2>
              {activeCategoryIsCharacterLike ? (
                <p>
                  Build story-facing character records here. Canonical names,
                  aliases, description, role, and notes stay in World Bible; sheets
                  remain optional system tools.
                </p>
              ) : activeCategoryIsSystemNegativeSpace ? (
                <p>
                  Keep an explicit list of human problems that progression cannot solve.
                  Status and scene links are author-maintained; meaning is not inferred here.
                </p>
              ) : (
                <p>
                  Build story-facing {activeCategory.name.toLowerCase()} here.
                  Canonical names, aliases, descriptions, and notes stay in World
                  Bible.
                </p>
              )}
            </div>
          </div>
          <div className={styles.castTaskGrid}>
            <div className={styles.castTask}>
              <h3>Manual {activeCategory.name.replace(/s$/i, '')}</h3>
              <p>
                {activeCategoryIsItem
                  ? 'Describe the item first, then add structured details only when they help.'
                  : 'Start with a canonical name, aliases, and the core canon fields.'}
              </p>
              <button
                type='button'
                onClick={
                  activeCategoryIsCharacterLike
                    ? startNewCharacterCanonRecord
                    : startNewCategoryRecord
                }
              >
                Create Manually
              </button>
            </div>
            <div className={styles.castTask}>
              <h3>Import {activeCategory.name.replace(/s$/i, '')}</h3>
              <p>Import documents or pasted dossiers, then review each generated canon record.</p>
              <div className={styles.castTaskActions}>
                <button
                  type='button'
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImportingEntities}
                >
                  {isImportingEntities ? 'Importing...' : 'Import Docs'}
                </button>
                <button
                  type='button'
                  onClick={() => setIsPasteImportOpen(true)}
                >
                  Paste Text
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <WorldBibleImportWorkspace
        activeProject={activeProject} projectSettings={projectSettings}
        activeCategory={activeCategory} categories={categories} categoryById={categoryById}
        imports={worldBibleImports} authoring={worldBibleAuthoring}
        isPasteImportOpen={isPasteImportOpen} setIsPasteImportOpen={setIsPasteImportOpen}
        pastedImportText={pastedImportText} setPastedImportText={setPastedImportText}
        handlePreparePastedImportDraft={handlePreparePastedImportDraft}
        richImportDraftCount={richImportDraftCount}
        activeImportPreviewDraft={activeImportPreviewDraft}
        importPreviewDialogRef={importPreviewDialogRef}
        setActiveImportPreviewId={setActiveImportPreviewId}
        handleApplyImportDrafts={handleApplyImportDrafts}
      />
      {showCategoryManager && (
        <CategoryManager
          projectId={activeProject.id}
          categories={worldBibleCategories}
          onCategoriesChange={(updatedCategories) => {
            const hiddenCategories = categories.filter(
              (category) => !worldBibleCategories.some(
                (visibleCategory) => visibleCategory.id === category.id
              )
            );
            setCategories([...updatedCategories, ...hiddenCategories]);
          }}
          onClose={() => setShowCategoryManager(false)}
        />
      )}

      {activeCategory && (
        <div
          className={`${styles.content} ${styles.castContent}`}
        >
          {(activeCategoryIsCharacterLike ? isFocusedCharacterTask : isFocusedRecordTask) && (
          <div className={styles.formSection}>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formHeadingRow}>
                <h2>
                  {activeCategoryIsCharacterLike
                    ? editingId
                      ? 'Edit Character Canon'
                      : 'New Character Canon'
                    : `${editingId ? 'Edit' : 'New'} ${activeCategory.name.slice(0, -1)}`}
                </h2>
                {(!isDescriptionFirstItemDraft || areItemDetailsExpanded) && (
                  <button
                    type='button'
                    onClick={() => {
                      setAiHelperSelectedText('');
                      setAiHelperProposal(null);
                      setIsRecordAiHelperOpen((value) => !value);
                    }}
                    aria-expanded={isRecordAiHelperOpen}
                  >
                    {isRecordAiHelperOpen ? 'Hide AI helper' : 'AI helper'}
                  </button>
                )}
              </div>
              {(!isDescriptionFirstItemDraft || areItemDetailsExpanded) && (
                <WorldBibleRecordAiHelper
                  activeProject={activeProject} projectSettings={projectSettings}
                  activeCategory={activeCategory} editingId={editingId}
                  authoring={worldBibleAuthoring}
                />
              )}

              {activeCategoryIsCharacterLike && (
                <div className={styles.reviewHint}>
                  This is the character's canonical home. Use the sections below for
                  story-facing canon and any optional capabilities attached to it.
                </div>
              )}
              {activeCategoryIsCharacterLike && handoffGuidance?.kind === 'character-canonicalization' && (
                <div className={styles.handoffBanner}>
                  <div>
                    <strong>Resolve {handoffGuidance.sourceName}</strong>
                    <p>
                      World Bible owns character identity. If this is the same person
                      as an existing character, make the shorter name an alias. If not,
                      keep them separate.
                    </p>
                  </div>
                  {canonicalResolutionMatches.length === 0 && selectedEntity && (
                    <button
                      type='button'
                      onClick={() =>
                        void handleMarkEntityComplete(selectedEntity).then(() => {
                          setHandoffGuidance(null);
                        })
                      }
                    >
                      Keep {currentCharacterLabel} canonical
                    </button>
                  )}
                  <button
                    type='button'
                    className={styles.dismissButton}
                    onClick={() => setHandoffGuidance(null)}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {activeCategoryIsCharacterLike ? (
                <WorldBibleCharacterSections
                  activeSection={characterDetailSection}
                  onSectionChange={setCharacterDetailSection}
                  isSaved={Boolean(selectedEntity)}
                  characterName={name.trim() || selectedEntity?.name || 'New character'}
                  canUseMechanics={showCharacterMechanics}
                  characterExtension={selectedEntityCharacterExtension}
                  characterSheet={selectedEntityCharacterSheet}
                  linkedNoteCount={linkedLoreDocumentsForSelectedEntity.length}
                  sceneMentionCount={selectedEntitySceneMentions.length}
                  stateEventCount={selectedEntityStateEvents.length}
                  isExporting={Boolean(selectedEntity && exportingCharacterEntityId === selectedEntity.id)}
                  onExport={() => {
                    if (selectedEntity) void handleExportCharacter(selectedEntity);
                  }}
                  dialogueStyleContent={
                    selectedEntity ? (
                      <WorldBibleDialogueStyleControl
                        entity={selectedEntity}
                        characterExtension={selectedEntityCharacterExtension}
                        characterStyles={projectSettings?.characterStyles ?? []}
                        onSaved={(character, message) => {
                          setCharacters((current) => current.some((entry) => entry.id === character.id)
                            ? current.map((entry) => entry.id === character.id ? character : entry)
                            : [...current, character]);
                          setFeedback({tone: 'success', message});
                        }}
                        onManageStyles={() => navigate('/settings')}
                      />
                    ) : null
                  }
                  canonContent={
                    <>
                  <section className={styles.canonSection} aria-label='Canonical names and aliases'>
                    <div className={styles.canonSectionHeader}>
                      <div>
                        <strong>Canon and aliases</strong>
                        <span>Canonical name, aliases, overlap review, and merge decisions for this character.</span>
                      </div>
                      <button
                        type='button'
                        onClick={() => setIsNameResolverOpen((value) => !value)}
                      >
                        {isNameResolverOpen ? 'Hide resolver' : 'Resolve names'}
                      </button>
                    </div>
                    <div className={styles.formGroup}>
                      <label>
                        Name
                        <input
                          type='text'
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </label>
                      {isCanonicalRenameDraft && selectedEntity && (
                        <div className={styles.reviewHint}>
                          Saving this rename will keep <strong>{selectedEntity.name}</strong> as an
                          alternative name.
                        </div>
                      )}
                    </div>
                    <div className={styles.formGroup}>
                      <label>
                        Alternative names
                        <textarea
                          ref={aliasTextareaRef}
                          value={fieldValues[ALTERNATIVE_NAMES_KEY] || ''}
                          onChange={(e) =>
                            setFieldValues({
                              ...fieldValues,
                              [ALTERNATIVE_NAMES_KEY]: e.target.value
                            })
                          }
                          rows={3}
                          placeholder='Comma-separated nicknames, titles, short forms, or alternate spellings'
                        />
                      </label>
                      <div className={styles.reviewHint}>
                        Use alternative names for short forms like first-name references,
                        titles, nicknames, and prior canonical forms after a rename.
                      </div>
                      {suggestedCharacterAliases.length > 0 && (
                        <div className={styles.aliasSuggestionPanel}>
                          <span>Suggested aliases</span>
                          <div className={styles.aliasSuggestionList}>
                            {suggestedCharacterAliases.map((alias) => (
                              <button
                                key={alias}
                                type='button'
                                onClick={() => handleAddSuggestedCharacterAlias(alias)}
                              >
                                Add {alias}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedEntity && selectedEntityAliases.length > 0 && (
                        <div className={styles.aliasPromotionPanel}>
                          <span>Current aliases</span>
                          <div className={styles.aliasPromotionList}>
                            {selectedEntityAliases.map((alias) => (
                              <span key={alias} className={styles.aliasPromotionChip}>
                                {alias}
                                <button
                                  type='button'
                                  onClick={() => handlePromoteAliasToCanonical(alias)}
                                >
                                  Make canonical
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedEntity && (
                      <div className={styles.categoryMovePanel}>
                        <label>
                          Category
                          <select
                            value={moveCategoryTargetId || selectedEntity.categoryId}
                            onChange={(event) => setMoveCategoryTargetId(event.target.value)}
                          >
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type='button'
                          onClick={() => void handleMoveSelectedEntityCategory()}
                          disabled={
                            movingEntityCategoryId === selectedEntity.id ||
                            !moveCategoryTargetId ||
                            moveCategoryTargetId === selectedEntity.categoryId
                          }
                        >
                          {movingEntityCategoryId === selectedEntity.id
                            ? 'Moving...'
                            : 'Move to category'}
                        </button>
                      </div>
                    )}

                    {isNameResolverOpen && (
                      <div className={styles.nameResolverPanel}>
                        <strong>Resolve against another character</strong>
                        <p>
                          Pick any character in this category when the app cannot infer the
                          relationship. You choose which name stays canonical.
                        </p>
                        {isCanonicalRenameDraft && selectedEntity && (
                          <div className={styles.canonicalRenameSummary}>
                            <div>
                              <strong>Rename this character instead</strong>
                              <p>
                                Save <strong>{name.trim()}</strong> as the canonical name
                                for this record. The old name and listed alternatives stay
                                attached as aliases.
                              </p>
                            </div>
                            {canonicalRenameAliasPreview.length > 0 && (
                              <div className={styles.aliasPreviewList}>
                                {canonicalRenameAliasPreview.map((alias) => (
                                  <span key={alias}>{alias}</span>
                                ))}
                              </div>
                            )}
                            <button
                              type='button'
                              className={styles.primaryButton}
                              onClick={() => void handleSaveCanonicalRename()}
                              disabled={isSubmittingEntity}
                            >
                              {isSubmittingEntity ? 'Saving...' : 'Save canonical rename'}
                            </button>
                          </div>
                        )}
                        {editingId ? (
                          manualResolutionTargets.length > 0 ? (
                            <>
                              <label>
                                Character
                                <select
                                  value={manualResolutionTarget?.id ?? ''}
                                  onChange={(event) =>
                                    setManualResolutionTargetId(event.target.value)
                                  }
                                >
                                  {manualResolutionTargets.map((entity) => (
                                    <option key={entity.id} value={entity.id}>
                                      {entity.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {manualResolutionTarget && (
                                <div className={styles.reviewToolbarActions}>
                                  <button
                                    type='button'
                                    className={styles.primaryButton}
                                    onClick={() =>
                                      void handleConvertEntityToAlias(manualResolutionTarget)
                                    }
                                    disabled={
                                      aliasingEntityTargetId === manualResolutionTarget.id
                                    }
                                  >
                                    {aliasingEntityTargetId === manualResolutionTarget.id
                                      ? 'Saving...'
                                      : `Make ${currentCharacterLabel} an alias of ${manualResolutionTarget.name}`}
                                  </button>
                                  <button
                                    type='button'
                                    onClick={() =>
                                      void handleMergeMatchIntoCurrentEntity(manualResolutionTarget)
                                    }
                                    disabled={
                                      mergingEntityTargetId === manualResolutionTarget.id
                                    }
                                  >
                                    {mergingEntityTargetId === manualResolutionTarget.id
                                      ? 'Saving...'
                                      : `Make ${manualResolutionTarget.name} an alias of ${currentCharacterLabel}`}
                                  </button>
                                  <button
                                    type='button'
                                    onClick={() => handleEdit(manualResolutionTarget, 'aliases')}
                                  >
                                    Open {manualResolutionTarget.name}
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className={styles.reviewHint}>
                              No other characters exist in this category yet.
                            </div>
                          )
                        ) : (
                          <div className={styles.reviewHint}>
                            Save this character before resolving it against another record.
                          </div>
                        )}
                      </div>
                    )}

                    {canonicalResolutionMatches.length > 0 && (
                      <div className={styles.matchPanel}>
                        <strong>Possible canonical character overlaps</strong>
                        <p>
                          This character may already exist. If this is the same person,
                          make the shorter name an alias of the full canon record.
                        </p>
                        <div className={styles.matchList}>
                          {canonicalResolutionMatches.slice(0, 4).map((match) => (
                            <div key={match.entity.id} className={styles.matchCard}>
                              <div>
                                <strong>{match.entity.name}</strong>
                                <div className={styles.matchReasons}>
                                  {match.reasons.join(' · ')}
                                </div>
                                <div className={styles.reviewHint}>
                                  Alias is safest when {currentCharacterLabel} is a nickname,
                                  first-name reference, title, or alternate spelling for
                                  {' '}{match.entity.name}.
                                </div>
                              </div>
                              <div className={styles.reviewToolbarActions}>
                                {activeCategoryIsCharacterLike ? (
                                  <>
                                    {editingId && (
                                      <button
                                        type='button'
                                        className={styles.primaryButton}
                                        onClick={() => void handleConvertEntityToAlias(match.entity)}
                                        disabled={aliasingEntityTargetId === match.entity.id}
                                      >
                                        {aliasingEntityTargetId === match.entity.id
                                          ? 'Saving...'
                                          : `Make ${currentCharacterLabel} an alias of ${match.entity.name}`}
                                      </button>
                                    )}
                                    {editingId && (
                                      <button
                                        type='button'
                                        onClick={() => void handleMergeMatchIntoCurrentEntity(match.entity)}
                                        disabled={mergingEntityTargetId === match.entity.id}
                                      >
                                        {mergingEntityTargetId === match.entity.id
                                          ? 'Saving...'
                                          : `Make ${match.entity.name} an alias of ${currentCharacterLabel}`}
                                      </button>
                                    )}
                                    {editingId && match.matchKey && (
                                      <button
                                        type='button'
                                        onClick={() => void handleKeepSeparateMatch(match.entity)}
                                      >
                                        No, keep separate
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {editingId && (
                                      <button
                                        type='button'
                                        className={styles.primaryButton}
                                        onClick={() => void handleConvertEntityToAlias(match.entity)}
                                        disabled={
                                          aliasingEntityTargetId === match.entity.id ||
                                          mergingEntityTargetId === match.entity.id
                                        }
                                      >
                                        {aliasingEntityTargetId === match.entity.id
                                          ? 'Converting...'
                                          : `Make ${currentCharacterLabel} an alias of ${match.entity.name}`}
                                      </button>
                                    )}
                                    {editingId && (
                                      <button
                                        type='button'
                                        onClick={() => void handleMergeEntityIntoMatch(match.entity)}
                                        disabled={mergingEntityTargetId === match.entity.id}
                                      >
                                        {mergingEntityTargetId === match.entity.id
                                          ? 'Merging...'
                                          : `Merge details into ${match.entity.name}`}
                                      </button>
                                    )}
                                    {editingId && match.matchKey && (
                                      <button
                                        type='button'
                                        onClick={() => void handleKeepSeparateMatch(match.entity)}
                                      >
                                        Keep separate
                                      </button>
                                    )}
                                    {editingId && match.matchKey && (
                                      <button
                                        type='button'
                                        onClick={() => void handleIgnoreEntityMatch(match.entity)}
                                      >
                                        Ignore suggestion
                                      </button>
                                    )}
                                  </>
                                )}
                                <button
                                  type='button'
                                  onClick={() => handleEdit(match.entity)}
                                >
                                  Open {match.entity.name}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  {characterIdentityFields.length > 0 && (
                    <div className={styles.identityGrid}>
                      {characterIdentityFields.map(renderEntityField)}
                    </div>
                  )}

                  {characterDescriptionField && renderEntityField(characterDescriptionField)}
                    </>
                  }
                  notesContent={
                    <>
                      {characterNotesField && renderEntityField(characterNotesField)}

                      {characterCustomFields.map(renderEntityField)}

                      <div className={styles.characterSectionBuilder}>
                        <div>
                          <strong>Add character section</strong>
                          <p>
                            Create a reusable rich section for this project, such as
                            Education, Traumas, Addictions, Relationships, or Voice.
                          </p>
                        </div>
                        <div className={styles.characterSectionControls}>
                          <input
                            type='text'
                            value={newCharacterSectionName}
                            onChange={(event) => setNewCharacterSectionName(event.target.value)}
                            placeholder='Education, Traumas, Addictions...'
                          />
                          <button
                            type='button'
                            onClick={() => void handleAddCharacterSection()}
                          >
                            Add Section
                          </button>
                        </div>
                      </div>

                      {selectedEntity && (
                        <WorldBibleLinkedSourceNote
                          entity={selectedEntity}
                          linkedDocument={linkedLoreDocumentByEntityId.get(selectedEntity.id) ?? null}
                          isOpening={linkingLoreEntityId === selectedEntity.id}
                          compactCopy
                          onOpen={(entity) => void handleOpenOrCreateLinkedLoreDocument(entity)}
                        />
                      )}
                    </>
                  }
                  continuityContent={
                    <WorldBibleCharacterHealth
                      selectedEntity={selectedEntity}
                      selectedEntityAliases={selectedEntityAliases}
                      selectedEntityFacts={selectedEntityFacts}
                      linkedLoreDocumentsForSelectedEntity={linkedLoreDocumentsForSelectedEntity}
                      selectedEntitySceneMentions={selectedEntitySceneMentions}
                      selectedEntityStateEvents={selectedEntityStateEvents}
                      selectedEntityAcceptedStateEventCount={selectedEntityAcceptedStateEventCount}
                      selectedEntityProposedStateEventCount={selectedEntityProposedStateEventCount}
                      characterHealthProbeResults={characterHealthProbeResults}
                      characterHealthProbeRunning={characterHealthProbeRunning}
                      currentEntityMemories={currentEntityMemories}
                      documents={writingDocuments}
                      canProbe={Boolean(ragService)}
                      handleCharacterHealthProbe={handleCharacterHealthProbe}
                      onOpenScene={(sceneId) => navigate('/workspace', {state: {focusDocumentId: sceneId}})}
                    />
                  }
                  mechanicsContent={
                    selectedEntity ? (
                      <WorldBibleMechanicsPanel
                        key={selectedEntity.id}
                        characterSheet={selectedEntityCharacterSheet}
                        ruleset={ruleset}
                        hasRuleset={hasRuleset}
                        stateEventCount={selectedEntityStateEvents.length}
                        stateEvents={selectedEntityStateEvents}
                        isSaving={isCreatingFirstMechanics}
                        isOpeningSheet={Boolean(selectedEntity && importingCharacterEntityId === selectedEntity.id)}
                        onCreate={async (input) => {
                          if (!activeProject) return;
                          setIsCreatingFirstMechanics(true);
                          setFeedback(null);
                          try {
                            const created = await createFirstCharacterMechanics({
                              project: activeProject,
                              character: selectedEntity,
                              ...input
                            });
                            useAppStore.setState({activeProject: created.project});
                            setRuleset({...created.ruleset, projectId: activeProject.id});
                            setCharacterSheets((current) => [...current, created.sheet]);
                            window.localStorage.removeItem(`wbd:first-mechanics:${activeProject.id}:${selectedEntity.id}`);
                            setFeedback({tone: 'success', message: `${input.name} is now tracked for ${selectedEntity.name}.`});
                          } catch (error) {
                            setFeedback({tone: 'error', message: describeError(error, 'Unable to enable mechanics tracking.')});
                          } finally {
                            setIsCreatingFirstMechanics(false);
                          }
                        }}
                        onRecordChange={() => navigate('/sheets', {state: {
                          prefillSheetId: selectedEntityCharacterSheet?.id,
                          initialTaskView: 'scene-history'
                        }})}
                        onOpenAdvanced={() => navigate('/sheets', {state: {
                          prefillSheetId: selectedEntityCharacterSheet?.id,
                          showAdvanced: true
                        }})}
                        onAddSheet={() => void handleImportEntityToCharacters(selectedEntity, {autoCreateSheet: true})}
                        draftStorageKey={`wbd:first-mechanics:${activeProject?.id ?? 'none'}:${selectedEntity.id}`}
                      />
                    ) : null
                  }
                />
              ) : (
                <>
                  {activeCategoryIsSystemNegativeSpace && (
                    <SystemNegativeSpacePanel
                      categoryId={activeCategory.id}
                      entities={entities}
                      documents={writingDocuments}
                      editing
                      status={negativeSpaceStatus}
                      sceneIds={negativeSpaceSceneIds}
                      onStatusChange={setNegativeSpaceStatus}
                      onSceneIdsChange={setNegativeSpaceSceneIds}
                      onOpenScene={(sceneId) => navigate('/workspace', {
                        state: {focusDocumentId: sceneId}
                      })}
                    />
                  )}
                  {isDescriptionFirstItemDraft && (
                    <ItemDescriptionFirstFields
                      name={name}
                      descriptionField={itemDescriptionField}
                      fieldValues={fieldValues}
                      detailsExpanded={areItemDetailsExpanded}
                      onNameChange={setName}
                      onFieldValuesChange={setFieldValues}
                      onToggleDetails={() => setAreItemDetailsExpanded((value) => !value)}
                    />
                  )}

                  {(!isDescriptionFirstItemDraft || areItemDetailsExpanded) && (
                    <div id='item-detailed-fields'>
                    <section className={styles.canonSection} aria-label='Names and aliases'>
                    <div className={styles.canonSectionHeader}>
                      <div>
                        <strong>Names and aliases</strong>
                        <span>
                          Canonical name, alternate names, overlap review, and merge
                          decisions for this {activeCategoryRecordLabel}.
                        </span>
                      </div>
                      <button
                        type='button'
                        onClick={() => setIsNameResolverOpen((value) => !value)}
                      >
                        {isNameResolverOpen ? 'Hide resolver' : 'Resolve names'}
                      </button>
                    </div>

                    {!isDescriptionFirstItemDraft && (
                      <div className={styles.formGroup}>
                        <label>
                          Name
                          <input
                            type='text'
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                        </label>
                        {isCanonicalRenameDraft && selectedEntity && (
                          <div className={styles.reviewHint}>
                            Saving this rename will keep <strong>{selectedEntity.name}</strong> as an
                            alternative name.
                          </div>
                        )}
                      </div>
                    )}

                    <div className={styles.formGroup}>
                    <label>
                      Alternative names
                      <textarea
                        ref={aliasTextareaRef}
                        value={fieldValues[ALTERNATIVE_NAMES_KEY] || ''}
                        onChange={(e) =>
                          setFieldValues({
                            ...fieldValues,
                            [ALTERNATIVE_NAMES_KEY]: e.target.value
                          })
                        }
                        rows={3}
                        placeholder='Comma-separated aliases, titles, or shorthand references'
                      />
                    </label>
                    {selectedEntity && selectedEntityAliases.length > 0 && (
                      <div className={styles.aliasPromotionPanel}>
                        <span>Current aliases</span>
                        <div className={styles.aliasPromotionList}>
                          {selectedEntityAliases.map((alias) => (
                            <span key={alias} className={styles.aliasPromotionChip}>
                              {alias}
                              <button
                                type='button'
                                onClick={() => handlePromoteAliasToCanonical(alias)}
                              >
                                Make canonical
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    </div>

                    {selectedEntity && (
                      <div className={styles.categoryMovePanel}>
                        <label>
                          Category
                          <select
                            value={moveCategoryTargetId || selectedEntity.categoryId}
                            onChange={(event) => setMoveCategoryTargetId(event.target.value)}
                          >
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type='button'
                          onClick={() => void handleMoveSelectedEntityCategory()}
                          disabled={
                            movingEntityCategoryId === selectedEntity.id ||
                            !moveCategoryTargetId ||
                            moveCategoryTargetId === selectedEntity.categoryId
                          }
                        >
                          {movingEntityCategoryId === selectedEntity.id
                            ? 'Moving...'
                            : 'Move to category'}
                        </button>
                      </div>
                    )}

                    {isNameResolverOpen && (
                    <div className={styles.nameResolverPanel}>
                      <strong>Resolve against another {activeCategoryRecordLabel}</strong>
                      <p>
                        Pick any {activeCategoryRecordLabel} in this category when the app
                        cannot infer the relationship. You choose which name stays canonical.
                      </p>
                      {editingId ? (
                        manualResolutionTargets.length > 0 ? (
                          <>
                            <label>
                              {activeCategory?.name ?? 'Records'}
                              <select
                                value={manualResolutionTarget?.id ?? ''}
                                onChange={(event) =>
                                  setManualResolutionTargetId(event.target.value)
                                }
                              >
                                {manualResolutionTargets.map((entity) => (
                                  <option key={entity.id} value={entity.id}>
                                    {entity.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {manualResolutionTarget && (
                              <div className={styles.reviewToolbarActions}>
                                <button
                                  type='button'
                                  className={styles.primaryButton}
                                  onClick={() =>
                                    void handleConvertEntityToAlias(manualResolutionTarget)
                                  }
                                  disabled={
                                    aliasingEntityTargetId === manualResolutionTarget.id ||
                                    mergingEntityTargetId === manualResolutionTarget.id
                                  }
                                >
                                  {aliasingEntityTargetId === manualResolutionTarget.id
                                    ? 'Converting...'
                                    : `Make ${name.trim() || selectedEntity?.name || 'this record'} an alias of ${manualResolutionTarget.name}`}
                                </button>
                                <button
                                  type='button'
                                  onClick={() =>
                                    void handleMergeMatchIntoCurrentEntity(manualResolutionTarget)
                                  }
                                  disabled={mergingEntityTargetId === manualResolutionTarget.id}
                                >
                                  {mergingEntityTargetId === manualResolutionTarget.id
                                    ? 'Merging...'
                                    : `Merge ${manualResolutionTarget.name} into this record`}
                                </button>
                                <button
                                  type='button'
                                  onClick={() => handleEdit(manualResolutionTarget, 'aliases')}
                                >
                                  Open {manualResolutionTarget.name}
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className={styles.reviewHint}>
                            No other {activeCategory?.name.toLowerCase() ?? 'records'} exist in
                            this category yet.
                          </div>
                        )
                      ) : (
                        <div className={styles.reviewHint}>
                          Save this {activeCategoryRecordLabel} before resolving it against
                          another record.
                        </div>
                      )}
                    </div>
                    )}

                    {canonicalResolutionMatches.length > 0 && (
                    <div className={styles.matchPanel}>
                      <strong>Possible duplicate or alias matches</strong>
                      <p>
                        This draft overlaps with existing canon. Choose one action for
                        each match: merge duplicates, convert this record into an alias,
                        keep both records as separate canon, or ignore a noisy suggestion.
                      </p>
                      <div className={styles.matchList}>
                        {canonicalResolutionMatches.slice(0, 4).map((match) => (
                          <div key={match.entity.id} className={styles.matchCard}>
                            <div>
                              <strong>{match.entity.name}</strong>
                              <div className={styles.matchReasons}>
                                {match.reasons.join(' · ')}
                              </div>
                              <div className={styles.reviewHint}>
                                Recommended: {getReviewResolutionLabel(match.recommendedResolution)}.
                              </div>
                            </div>
                            <div className={styles.reviewToolbarActions}>
                              <button type='button' onClick={() => handleEdit(match.entity)}>
                                Open other record
                              </button>
                              <button
                                type='button'
                                onClick={() => handleEdit(match.entity, 'aliases')}
                              >
                                Open aliases
                              </button>
                              {editingId && match.matchKey && (
                                <button
                                  type='button'
                                  onClick={() => void handleKeepSeparateMatch(match.entity)}
                                >
                                  Keep both records
                                </button>
                              )}
                              {editingId && match.matchKey && (
                                <button
                                  type='button'
                                  onClick={() => void handleIgnoreEntityMatch(match.entity)}
                                >
                                  Ignore this suggestion
                                </button>
                              )}
                              {editingId && (
                                <button
                                  type='button'
                                  onClick={() => void handleMergeMatchIntoCurrentEntity(match.entity)}
                                  disabled={mergingEntityTargetId === match.entity.id}
                                >
                                  {mergingEntityTargetId === match.entity.id
                                    ? 'Merging...'
                                    : 'Merge match into this record'}
                                </button>
                              )}
                              {editingId && (
                                <button
                                  type='button'
                                  onClick={() => void handleMergeEntityIntoMatch(match.entity)}
                                  disabled={mergingEntityTargetId === match.entity.id}
                                >
                                  {mergingEntityTargetId === match.entity.id
                                    ? 'Merging...'
                                    : 'Merge this record into match'}
                                </button>
                              )}
                              {editingId && (
                                <button
                                  type='button'
                                  onClick={() => void handleConvertEntityToAlias(match.entity)}
                                  disabled={
                                    aliasingEntityTargetId === match.entity.id ||
                                    mergingEntityTargetId === match.entity.id
                                  }
                                >
                                  {aliasingEntityTargetId === match.entity.id
                                    ? 'Converting...'
                                    : 'Convert this record into an alias'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    )}
                  </section>

                  {activeCategory.fieldSchema
                    .filter(
                      (field) =>
                        !isDescriptionFirstItemDraft || field.key !== itemDescriptionField?.key
                    )
                    .map(renderEntityField)}

                  <div className={styles.characterSectionBuilder}>
                    <div>
                      <strong>Add {activeCategoryRecordLabel} section</strong>
                      <p>
                        Create a reusable rich section for this tab, such as
                        History, Reputation, Rules, Relationships, or Notes.
                      </p>
                    </div>
                    <div className={styles.characterSectionControls}>
                      <input
                        type='text'
                        value={newCharacterSectionName}
                        onChange={(event) => setNewCharacterSectionName(event.target.value)}
                        placeholder='History, Reputation, Rules...'
                      />
                      <button
                        type='button'
                        onClick={() => void handleAddCharacterSection()}
                      >
                        Add Section
                      </button>
                    </div>
                  </div>
                    </div>
                  )}
                </>
              )}

              {selectedEntity && !activeCategoryIsCharacterLike && (
                <WorldBibleLinkedSourceNote
                  entity={selectedEntity}
                  linkedDocument={linkedLoreDocumentByEntityId.get(selectedEntity.id) ?? null}
                  isOpening={linkingLoreEntityId === selectedEntity.id}
                  onOpen={(entity) => void handleOpenOrCreateLinkedLoreDocument(entity)}
                />
              )}

              <div className={styles.formActions}>
                <button
                  type='submit'
                  className={styles.primaryButton}
                  disabled={isSubmittingEntity}
                >
                  {isSubmittingEntity
                    ? 'Saving...'
                    : editingId
                      ? activeCategoryIsCharacterLike
                        ? 'Save Canon Changes'
                        : 'Save Changes'
                      : activeCategoryIsCharacterLike
                        ? 'Create Canon Record'
                        : activeCategoryIsItem
                          ? 'Save Item'
                          : 'Create Entry'}
                </button>
                {(editingId || activeCategoryIsCharacterLike || recordAuthoringMode !== 'idle') && (
                  <button type='button' onClick={resetForm} disabled={isSubmittingEntity}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
            {editingId &&
              (!activeCategoryIsCharacterLike || characterDetailSection === 'notes') && (
              <ShodhMemoryPanel
                title='Canon summary'
                memories={currentEntityMemories}
                filterValue={memoryFilter}
                onFilterChange={setMemoryFilter}
                highlightDocumentId={editingId}
                onRefresh={() => void refreshMemories()}
                pageSize={0}
                scopeSummaryLabel='this entry'
                emptyState={memoryPanelEmpty}
                renderSourceLabel={(memory) =>
                  memory.projectId === activeProject.id ? 'Local' : 'Parent'
                }
                renderMemoryActions={(memory) => {
                  if (
                    seriesConfig?.parentProjectId &&
                    memory.projectId === activeProject.id
                  ) {
                    return (
                      <button
                        type='button'
                        onClick={() => void handlePromoteMemory(memory)}
                        disabled={promotingMemoryId === memory.id}
                        style={{fontSize: '0.8rem'}}
                      >
                        {promotingMemoryId === memory.id ? 'Promoting...' : 'Promote'}
                      </button>
                    );
                  }
                  return null;
                }}
              />
            )}
          </div>
          )}

          {activeCategoryIsSystemNegativeSpace && !isFocusedRecordTask && (
            <SystemNegativeSpacePanel
              categoryId={activeCategory.id}
              entities={entities}
              documents={writingDocuments}
              editing={false}
              status='open'
              sceneIds={[]}
              onStatusChange={() => undefined}
              onSceneIdsChange={() => undefined}
              onOpenScene={(sceneId) => navigate('/workspace', {
                state: {focusDocumentId: sceneId}
              })}
            />
          )}
          <WorldBibleEntityList
            viewMode={viewMode} activeCategoryIsCharacterLike={activeCategoryIsCharacterLike}
            isFocusedCharacterTask={isFocusedCharacterTask}
            isFocusedRecordTask={isFocusedRecordTask} activeCategory={activeCategory}
            categories={worldBibleCategories} visibleEntities={visibleEntities}
            reviewEntityInsightsById={reviewEntityInsightsById} reviewQueue={reviewQueue}
            aliasMapByEntityId={aliasMapByEntityId}
            linkedLoreDocumentByEntityId={linkedLoreDocumentByEntityId}
            linkingLoreEntityId={linkingLoreEntityId}
            compendiumLinkedEntityIds={compendiumLinkedEntityIds}
            seriesParentProjectId={seriesConfig?.parentProjectId ?? null}
            showCharacterMechanics={showCharacterMechanics} showGameSystems={showGameSystems}
            hasRuleset={hasRuleset}
            actions={{
              isCharacterLikeEntity, handleMarkEntityComplete, handleDeleteEntity,
              handlePromoteEntity, handleImportEntityToCharacters, handleAddEntityToCompendium,
              deletingEntityId, promotingEntityId, importingCharacterEntityId,
              linkingCompendiumEntityId
            }}
            handleEdit={handleEdit}
            handleOpenCharacterWritingAids={(entity) => {
              handleEdit(entity);
              setCharacterDetailSection('writing-aids');
            }}
            handleOpenOrCreateLinkedLoreDocument={handleOpenOrCreateLinkedLoreDocument}
          />
        </div>
      )}
        </div>
      </div>

      {confirmDialog}
    </section>
  );
}
export default WorldBibleRoute;
