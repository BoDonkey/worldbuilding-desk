import {useEffect, useState, useCallback, useRef, useMemo} from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {useAppStore} from '../store/appStore';
import {getProjectCapabilities} from '../projectMode';
import type {Character, EntityCategory, WorldEntity} from '../entityTypes';
import {getEntitiesByProject} from '../entityStorage';
import {
  getCategoriesByProject,
  saveCategory,
  deleteCategory,
  initializeDefaultCategories
} from '../categoryStorage';
import {getCharactersByProject} from '../characterStorage';
import CategoryEditor from '../components/CategoryEditor';
import {WorldBibleRichTextField} from '../components/WorldBibleRichTextField';
import {ProjectScratchpadButton} from '../components/ProjectScratchpadButton';
import {PageHeader} from '../components/PageHeader';
import {AIAssistant} from '../components/AIAssistant/AIAssistant';
import styles from '../assets/components/WorldBibleRoute.module.css';
import type {RAGProvider} from '../services/rag/RAGService';
import {getRAGService} from '../services/rag/getRAGService';
import type {
  ShodhMemoryProvider,
  MemoryEntry
} from '../services/shodh/ShodhMemoryService';
import {getShodhService} from '../services/shodh/getShodhService';
import {emitShodhMemoriesUpdated} from '../services/shodh/shodhEvents';
import {ShodhMemoryPanel} from '../components/ShodhMemoryPanel';
import {getCompendiumEntriesByProject} from '../services/compendium';
import type {ConsistencyAlias} from '../services/consistency';
import {getAliasesByProject} from '../services/consistency';
import {useWorldBibleReview} from '../hooks/useWorldBibleReview';
import {
  useWorldBibleImports,
  type ImportMode,
  type JsonImportConflictResolution
} from '../hooks/useWorldBibleImports';
import {useWorldBibleEntityActions} from '../hooks/useWorldBibleEntityActions';
import {
  getSeriesBibleConfig,
  promoteMemoryToParent,
  getCanonSyncState
} from '../services/seriesBible/SeriesBibleService';
import {
  ALTERNATIVE_NAMES_KEY,
  extractPlainTextFromRichText,
  extractStructuredSummaryFromRichText,
  formatAlternativeNames,
  normalizeRichTextValue,
  normalizeName,
  parseAlternativeNames
} from '../services/worldBible/worldBibleEntityHelpers';
import {
  buildEntityMatchKey,
  getReviewResolutionLabel
} from '../services/worldBible/worldBibleReviewHelpers';
import {
  buildCanonicalAliasList,
  deriveCharacterAliasSuggestions
} from '../services/worldBible/worldBibleCanonicalization';
import {
  parseCharacterImportText,
  readCharacterImportFile,
  type CharacterImportDraft,
  type CharacterImportSectionDraft
} from '../services/characters/characterImportService';

// activeProject read from store below

type WorldBibleViewMode = 'category' | 'review';
type CharacterImportStep = 'idle' | 'input' | 'review';
type CharacterAuthoringMode = 'idle' | 'manual' | 'import';
type RecordAuthoringMode = 'idle' | 'manual';
type AiHelperApplyTarget = 'name' | 'aliases' | `field:${string}`;

const getPreferredImportField = (
  category: EntityCategory
): EntityCategory['fieldSchema'][number] | undefined =>
  category.fieldSchema.find((field) => field.key === 'description') ??
  category.fieldSchema.find((field) => field.type === 'textarea') ??
  category.fieldSchema.find((field) => field.type === 'text');

const CATEGORY_SUMMARY_PRIORITY: Record<string, string[]> = {
  characters: ['description', 'role', 'age', 'notes'],
  locations: ['description', 'climate', 'population', 'notes'],
  items: ['description', 'rarity', 'notes'],
  factions: ['description', 'notes'],
  concepts: ['description', 'notes']
};
const CHARACTER_CATEGORY_HINTS = ['character', 'characters', 'npc', 'person', 'people'];
const CHARACTER_NOTES_FIELD = 'notes';
const CHARACTER_IDENTITY_FIELD_KEYS = ['age', 'role'];
const CHARACTER_AUTHORING_FIELD_KEYS = new Set([
  'description',
  CHARACTER_NOTES_FIELD,
  ...CHARACTER_IDENTITY_FIELD_KEYS,
  ALTERNATIVE_NAMES_KEY
]);

const getWorldBibleRailStorageKey = (projectId: string) =>
  `wbd:world-bible:category-rail-collapsed:${projectId}`;

const slugifyFieldKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'section';

const isCharacterCategory = (category: EntityCategory): boolean => {
  const slug = category.slug.toLowerCase();
  const name = category.name.toLowerCase();
  return CHARACTER_CATEGORY_HINTS.some(
    (hint) => slug.includes(hint) || name.includes(hint)
  );
};

const ensureCharacterCategoryLongFormFields = async (
  categories: EntityCategory[]
): Promise<EntityCategory[]> => {
  let changed = false;
  const updatedCategories = categories.map((category) => {
    if (!isCharacterCategory(category)) {
      return category;
    }
    if (category.fieldSchema.some((field) => field.key === CHARACTER_NOTES_FIELD)) {
      return category;
    }
    changed = true;
    return {
      ...category,
      fieldSchema: [
        ...category.fieldSchema,
        {key: CHARACTER_NOTES_FIELD, label: 'Notes', type: 'textarea' as const}
      ]
    };
  });

  if (changed) {
    await Promise.all(updatedCategories.map((category, index) =>
      category === categories[index] ? Promise.resolve() : saveCategory(category)
    ));
  }

  return updatedCategories;
};

const buildEntityCardSummary = (
  entity: WorldEntity,
  category: EntityCategory | null | undefined,
  aliasTexts: string[] = []
): {
  primarySummary: string | null;
  fullSummary: string | null;
  summaryIsTruncated: boolean;
  secondaryFields: Array<{label: string; value: string}>;
} => {
  const labelByKey = new Map(
    [
      ...(category?.fieldSchema ?? []).map((field) => [field.key, field.label] as const),
      [ALTERNATIVE_NAMES_KEY, 'Alternative names'] as const
    ]
  );
  const richTextKeys = new Set(
    (category?.fieldSchema ?? [])
      .filter((field) => field.type === 'textarea')
      .map((field) => field.key)
  );

  const summaryPriority = [
    ...(category ? CATEGORY_SUMMARY_PRIORITY[category.slug] ?? [] : []),
    'description',
    'summary',
    'notes'
  ];
  const dedupedSummaryKeys = Array.from(new Set(summaryPriority));
  const summarySourceKey =
    dedupedSummaryKeys.find((key) => {
      const value = entity.fields[key];
      return typeof value === 'string' && extractPlainTextFromRichText(value).length > 0;
    }) ??
    Array.from(richTextKeys).find((key) => {
      const value = entity.fields[key];
      return typeof value === 'string' && extractPlainTextFromRichText(value).length > 0;
    }) ??
    null;

  const primarySummary =
    summarySourceKey && typeof entity.fields[summarySourceKey] === 'string'
      ? extractStructuredSummaryFromRichText(entity.fields[summarySourceKey] as string)
      : null;

  const secondaryPriority = Array.from(
    new Set([
      ...(category?.fieldSchema.map((field) => field.key) ?? []),
      ...(aliasTexts.length > 0 ? [ALTERNATIVE_NAMES_KEY] : []),
      ...Object.keys(entity.fields)
    ])
  );

  const secondaryFields = secondaryPriority
    .filter((key) => key !== summarySourceKey)
    .map((key) => {
      if (key === ALTERNATIVE_NAMES_KEY) {
        const fieldAliases = parseAlternativeNames(
          typeof entity.fields[ALTERNATIVE_NAMES_KEY] === 'string'
            ? String(entity.fields[ALTERNATIVE_NAMES_KEY])
            : ''
        );
        return {
          label: labelByKey.get(key) ?? key,
          value: formatAlternativeNames(
            parseAlternativeNames([...fieldAliases, ...aliasTexts].join(', '))
          )
        };
      }
      const value = entity.fields[key];
      if (typeof value === 'string') {
        return {
          label: labelByKey.get(key) ?? key,
          value: extractPlainTextFromRichText(value)
        };
      }
      if (Array.isArray(value)) {
        return {
          label: labelByKey.get(key) ?? key,
          value: value.map((item) => String(item)).filter(Boolean).join(', ')
        };
      }
      if (typeof value === 'boolean') {
        return {
          label: labelByKey.get(key) ?? key,
          value: value ? 'Yes' : 'No'
        };
      }
      return {
        label: labelByKey.get(key) ?? key,
        value: String(value ?? '')
      };
    })
    .filter((field) => field.value.trim().length > 0)
    .slice(0, 4);

  return {
    primarySummary: primarySummary
      ? primarySummary.length > 280
        ? `${primarySummary.slice(0, 280)}...`
        : primarySummary
      : null,
    fullSummary: primarySummary,
    summaryIsTruncated: Boolean(primarySummary && primarySummary.length > 280),
    secondaryFields
  };
};


const getFieldTemplateValue = (field: EntityCategory['fieldSchema'][number]): unknown => {
  if (field.type === 'checkbox') return false;
  if (field.type === 'number') return 0;
  if (field.type === 'select') return field.options?.[0] ?? '';
  if (field.type === 'multiselect') return field.options?.slice(0, 2) ?? [];
  if (field.type === 'dice') {
    return field.diceConfig?.allowMultipleDice ? '2d6+1d4' : '1d20';
  }
  if (field.type === 'modifier') return '+2';
  if (field.type === 'textarea') return 'Detailed notes here';
  return '';
};

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

const buildEntityContent = (entity: WorldEntity) => {
  const fieldText = Object.entries(entity.fields)
    .map(([key, value]) =>
      `${key}: ${typeof value === 'string' ? extractPlainTextFromRichText(value) : value ?? ''}`
    )
    .join('\n');
  return `${entity.name}\n${fieldText}`;
};

const buildCharacterImportDescription = (
  draft: CharacterImportDraft,
  sections: CharacterImportSectionDraft[]
): string => {
  const descriptionBlocks = sections
    .filter((section) => section.action === 'description')
    .map((section) => section.content.trim())
    .filter(Boolean);
  return descriptionBlocks.join('\n\n') || draft.detectedDescription;
};

const buildCharacterImportNotes = (
  draft: CharacterImportDraft,
  sections: CharacterImportSectionDraft[]
): string => {
  const noteBlocks = sections
    .filter((section) => section.action === 'notes')
    .map((section) => `${section.title}\n${section.content.trim()}`)
    .filter(Boolean);
  const residue = draft.unmatchedText.trim();
  return [...noteBlocks, residue ? `Source Notes\n${residue}` : ''].filter(Boolean).join('\n\n');
};

const buildCharacterImportCustomFieldValues = (
  sections: CharacterImportSectionDraft[],
  customFields: EntityCategory['fieldSchema']
): Record<string, string> => {
  const customFieldKeys = new Set(customFields.map((field) => field.key));
  return sections.reduce<Record<string, string>>((values, section) => {
    if (!customFieldKeys.has(section.action)) return values;
    const existing = values[section.action];
    values[section.action] = [existing, section.content.trim()].filter(Boolean).join('\n\n');
    return values;
  }, {});
};

function WorldBibleRoute() {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const saveProjectSettings = useAppStore((s) => s.saveProjectSettings);
  const location = useLocation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<WorldBibleViewMode>('category');
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [aliases, setAliases] = useState<ConsistencyAlias[]>([]);
  const [activeImportPreviewId, setActiveImportPreviewId] = useState<string | null>(null);
  const [characterImportStep, setCharacterImportStep] =
    useState<CharacterImportStep>('idle');
  const [characterAuthoringMode, setCharacterAuthoringMode] =
    useState<CharacterAuthoringMode>('idle');
  const [recordAuthoringMode, setRecordAuthoringMode] =
    useState<RecordAuthoringMode>('idle');
  const [pastedCharacterImportText, setPastedCharacterImportText] = useState('');
  const [characterImportDraft, setCharacterImportDraft] =
    useState<CharacterImportDraft | null>(null);
  const [characterImportSections, setCharacterImportSections] = useState<
    CharacterImportSectionDraft[]
  >([]);
  const [isImportingCharacterDoc, setIsImportingCharacterDoc] = useState(false);
  const [isRecordAiHelperOpen, setIsRecordAiHelperOpen] = useState(false);
  const [isImportAiHelperOpen, setIsImportAiHelperOpen] = useState(false);
  const [aiHelperSelectedText, setAiHelperSelectedText] = useState('');
  const [aiHelperApplyTarget, setAiHelperApplyTarget] =
    useState<AiHelperApplyTarget>('name');
  const [newCharacterSectionName, setNewCharacterSectionName] = useState('');
  const [expandedSummaryEntityIds, setExpandedSummaryEntityIds] = useState<string[]>([]);
  const [isNameResolverOpen, setIsNameResolverOpen] = useState(false);
  const [manualResolutionTargetId, setManualResolutionTargetId] = useState('');
  const [ragService, setRagService] = useState<RAGProvider | null>(null);
  const [shodhService, setShodhService] =
    useState<ShodhMemoryProvider | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoryFilter, setMemoryFilter] = useState('');
  const [pendingReviewFocus, setPendingReviewFocus] = useState<'general' | 'aliases' | null>(
    null
  );
  const [handoffGuidance, setHandoffGuidance] = useState<{
    kind: 'character-canonicalization';
    sourceName: string;
    matchEntityId?: string;
  } | null>(null);
  const reviewFilter = 'all' as const;
  const recommendedFilter = 'all' as const;
  const seriesConfig = activeProject
    ? getSeriesBibleConfig(activeProject)
    : null;
  const capabilities = getProjectCapabilities(projectSettings);
  const showGameSystems = capabilities.canUseGameSystems;
  const showCharacterTools = capabilities.canUseRuleAuthoring;
  const [canonState, setCanonState] = useState<{
    parentCanonVersion?: string;
    childLastSynced?: string;
    parentName?: string;
  }>({});
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isCategoryRailCollapsed, setIsCategoryRailCollapsed] = useState(false);
  const [promotingMemoryId, setPromotingMemoryId] = useState<string | null>(null);
  const [compendiumLinkedEntityIds, setCompendiumLinkedEntityIds] = useState<
    Set<string>
  >(new Set());
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const jsonImportInputRef = useRef<HTMLInputElement | null>(null);
  const characterImportInputRef = useRef<HTMLInputElement | null>(null);

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
  const refreshMemories = useCallback(async () => {
    if (!shodhService) {
      setMemories([]);
      emitShodhMemoriesUpdated([]);
      return;
    }
    const list = await shodhService.listMemories();
    setMemories(list);
    emitShodhMemoriesUpdated(list);
  }, [shodhService]);

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
          error instanceof Error ? error.message : 'Unable to promote memory.';
        setFeedback({tone: 'error', message});
      } finally {
        setPromotingMemoryId(null);
      }
    },
    [seriesConfig?.parentProjectId, refreshMemories]
  );

  useEffect(() => {
    if (!activeProject) {
      return;
    }

    let cancelled = false;

    (async () => {
      const projectId = activeProject.id;

      await initializeDefaultCategories(projectId);

      const [cats, ents, loadedAliases, loadedCharacters] = await Promise.all([
        getCategoriesByProject(projectId),
        getEntitiesByProject(projectId),
        getAliasesByProject(projectId),
        getCharactersByProject(projectId)
      ]);
      const normalizedCategories = await ensureCharacterCategoryLongFormFields(cats);

      if (!cancelled) {
        setCategories(normalizedCategories);
        setEntities(ents);
        setAliases(loadedAliases);
        setCharacters(loadedCharacters);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      setAliases([]);
      return;
    }

    let cancelled = false;
    getAliasesByProject(activeProject.id)
      .then((loadedAliases) => {
        if (!cancelled) {
          setAliases(loadedAliases);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAliases([]);
        }
      });

    const refreshAliases = () => {
      void getAliasesByProject(activeProject.id)
        .then((loadedAliases) => {
          if (!cancelled) {
            setAliases(loadedAliases);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setAliases([]);
          }
        });
    };

    window.addEventListener('wbd:alias-records-changed', refreshAliases);
    return () => {
      cancelled = true;
      window.removeEventListener('wbd:alias-records-changed', refreshAliases);
    };
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      setCompendiumLinkedEntityIds(new Set());
      return;
    }

    let cancelled = false;
    getCompendiumEntriesByProject(activeProject.id)
      .then((entries) => {
        if (cancelled) return;
        setCompendiumLinkedEntityIds(
          new Set(entries.map((entry) => entry.sourceEntityId).filter(Boolean) as string[])
        );
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load compendium links.';
        setFeedback({tone: 'error', message});
      });

    return () => {
      cancelled = true;
    };
  }, [activeProject, entities.length]);

  useEffect(() => {
    void refreshMemories();
  }, [refreshMemories]);

  useEffect(() => {
    if (!activeTab && categories.length > 0) {
      setActiveTab(categories[0].id);
    }
  }, [categories, activeTab]);

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
    Promise.all([getRAGService(ragOptions), getShodhService(shodhOptions)]).then(
      ([rag, shodh]) => {
        if (!cancelled) {
          setRagService(rag);
          setShodhService(shodh);
        }
      }
    );

    return () => {
      cancelled = true;
      setRagService(null);
      setShodhService(null);
    };
  }, [activeProject]);

  useEffect(() => {
    let cancelled = false;
    if (!activeProject || !seriesConfig?.parentProjectId) {
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
  }, [activeProject, seriesConfig?.parentProjectId]);

  useEffect(() => {
    if (!ragService) return;
    const vocabulary = entities.map((entity) => ({
      id: entity.id,
      terms: [
        entity.name,
        ...Object.values(entity.fields).filter(
          (value): value is string => typeof value === 'string'
        )
      ]
    }));
    ragService.setEntityVocabulary(vocabulary);
  }, [entities, ragService]);

  const activeCategory = categories.find((c) => c.id === activeTab);
  const characterCategory = useMemo(
    () => categories.find((category) => isCharacterCategory(category)) ?? null,
    [categories]
  );
  const activeCategoryIsCharacterLike = useMemo(() => {
    const slug = (activeCategory?.slug ?? '').toLowerCase();
    const categoryName = (activeCategory?.name ?? '').toLowerCase();
    return CHARACTER_CATEGORY_HINTS.some(
      (hint) => slug.includes(hint) || categoryName.includes(hint)
    );
  }, [activeCategory?.name, activeCategory?.slug]);
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
  const characterImportDestinationFields = characterCustomFields.filter(
    (field) => field.type === 'textarea'
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const {
    isImportingEntities,
    isApplyingImports,
    importDrafts,
    clearImportDrafts,
    isImportingJson,
    isApplyingJsonImport,
    jsonImportSession,
    jsonImportConflictResolutions,
    activeJsonCategory,
    preparedJsonRows,
    jsonImportValidCount,
    jsonImportConflictCount,
    unresolvedJsonConflictCount,
    handleImportEntities,
    updateImportDraft,
    applyImportDrafts,
    applyJsonImport,
    handleJsonImportFile,
    handleJsonCategoryChange,
    handleJsonNameKeyChange,
    handleJsonModeChange,
    handleJsonFieldMapChange,
    handleJsonConflictResolutionChange,
    clearJsonImportSession
  } = useWorldBibleImports({
    activeProjectId: activeProject?.id ?? null,
    activeCategory: activeCategory ?? null,
    categories,
    entities,
    setCategories,
    setEntities,
    setFeedback,
    onEntitySaved: async (entity, category) => {
      const content = buildEntityContent(entity);
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
  const selectedEntity = editingId
    ? entities.find((entity) => entity.id === editingId) ?? null
    : null;
  const activeCategoryRecordLabel =
    activeCategory?.name.replace(/s$/i, '').toLowerCase() || 'record';
  const currentRecordAiContext = useMemo(() => {
    if (!activeCategory) return '';
    return [
      `Category: ${activeCategory.name}`,
      name.trim() ? `Current name: ${name.trim()}` : ''
    ]
      .filter(Boolean)
      .join('\n\n');
  }, [activeCategory, name]);
  const aiHelperApplyTargets = useMemo(() => {
    if (!activeCategory) return [];
    return [
      {value: 'name' as AiHelperApplyTarget, label: 'Name'},
      {value: 'aliases' as AiHelperApplyTarget, label: 'Alternative names'},
      ...activeCategory.fieldSchema.map((field) => ({
        value: `field:${field.key}` as AiHelperApplyTarget,
        label: field.label
      }))
    ];
  }, [activeCategory]);
  const importAiContext = useMemo(() => {
    if (importDrafts.length === 0) return '';
    return importDrafts
      .slice(0, 8)
      .map((draft) => {
        const category = categoryById.get(draft.categoryId);
        return [
          `File: ${draft.fileName}`,
          category ? `Target category: ${category.name}` : '',
          draft.name.trim() ? `Detected name: ${draft.name.trim()}` : '',
          draft.parseError ? `Error: ${draft.parseError}` : `Preview: ${draft.preview}`
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n---\n\n');
  }, [categoryById, importDrafts]);
  const currentCharacterLabel =
    name.trim() || selectedEntity?.name || activeCategory?.name.slice(0, -1) || 'this record';
  const isFocusedCharacterTask = activeCategoryIsCharacterLike
    ? Boolean(editingId || characterAuthoringMode !== 'idle')
    : false;
  const isFocusedRecordTask = !activeCategoryIsCharacterLike
    ? Boolean(
        recordAuthoringMode !== 'idle' ||
          (editingId && selectedEntity?.categoryId === activeCategory?.id)
      )
    : false;
  const isCanonicalRenameDraft = Boolean(
    selectedEntity &&
      name.trim().length > 0 &&
      normalizeName(selectedEntity.name) !== normalizeName(name)
  );
  const suggestedCharacterAliases = useMemo(() => {
    if (!activeCategoryIsCharacterLike) {
      return [];
    }
    const currentName = name.trim();
    if (!currentName) {
      return [];
    }
    const existingAliases = new Set(
      parseAlternativeNames(fieldValues[ALTERNATIVE_NAMES_KEY] || '')
        .map((alias) => normalizeName(alias))
        .filter(Boolean)
    );
    return deriveCharacterAliasSuggestions(currentName).filter(
      (alias) =>
        normalizeName(alias) !== normalizeName(currentName) &&
        !existingAliases.has(normalizeName(alias))
    );
  }, [activeCategoryIsCharacterLike, fieldValues, name]);
  const canonicalRenameAliasPreview = useMemo(() => {
    if (!isCanonicalRenameDraft || !selectedEntity) {
      return [];
    }
    return buildCanonicalAliasList({
      previousName: selectedEntity.name,
      nextName: name,
      aliases: parseAlternativeNames(fieldValues[ALTERNATIVE_NAMES_KEY] || '')
    });
  }, [fieldValues, isCanonicalRenameDraft, name, selectedEntity]);
  const manualResolutionTargets = useMemo(
    () =>
      entities
        .filter((entity) => entity.categoryId === activeTab && entity.id !== editingId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [activeTab, editingId, entities]
  );
  const manualResolutionTarget =
    manualResolutionTargets.find((entity) => entity.id === manualResolutionTargetId) ??
    manualResolutionTargets[0] ??
    null;
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
  const canonicalResolutionMatches = useMemo(() => {
    if (!editingId) {
      return potentialEntityMatches;
    }
    const handoffMatch = handoffGuidance?.matchEntityId
      ? entities.find((entity) => entity.id === handoffGuidance.matchEntityId)
      : null;
    if (!handoffMatch || handoffMatch.id === editingId) {
      return potentialEntityMatches;
    }
    if (potentialEntityMatches.some((match) => match.entity.id === handoffMatch.id)) {
      return potentialEntityMatches;
    }
    return [
      {
        entity: handoffMatch,
        matchKey: buildEntityMatchKey(editingId, handoffMatch.id),
        reasons: [`Linked from ${handoffGuidance?.sourceName ?? 'Character Tools'}`],
        recommendedResolution: 'merge' as const
      },
      ...potentialEntityMatches
    ];
  }, [editingId, entities, handoffGuidance, potentialEntityMatches]);
  const memoryPanelEmpty =
    'This entry has no captured memories yet. Save it to generate one or adjust the filter.';

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setFieldValues({});
    setPendingReviewFocus(null);
    setIsNameResolverOpen(false);
    setManualResolutionTargetId('');
    setCharacterAuthoringMode('idle');
    setRecordAuthoringMode('idle');
    setCharacterImportStep('idle');
    setCharacterImportDraft(null);
    setCharacterImportSections([]);
    setIsRecordAiHelperOpen(false);
    setIsImportAiHelperOpen(false);
    setAiHelperSelectedText('');
    setAiHelperApplyTarget('name');
    setNewCharacterSectionName('');
  };

  const handleSelectCategoryTab = (categoryId: string) => {
    setViewMode('category');
    setActiveTab(categoryId);
    resetForm();
  };

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
    setRecordAuthoringMode('idle');
    setCharacterImportStep('idle');
    setCharacterImportDraft(null);
    setCharacterImportSections([]);
    setIsRecordAiHelperOpen(false);
    setAiHelperSelectedText('');
    setAiHelperApplyTarget('name');
  }, [openCharacterCategory]);

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
    setRecordAuthoringMode('manual');
    setCharacterImportStep('idle');
    setCharacterImportDraft(null);
    setCharacterImportSections([]);
    setIsRecordAiHelperOpen(false);
    setAiHelperSelectedText('');
    setAiHelperApplyTarget('name');
  }, [activeCategory]);

  const applyCharacterImportDraftToFields = useCallback(
    (draft: CharacterImportDraft, sections: CharacterImportSectionDraft[]) => {
      openCharacterCategory();
      setEditingId(null);
      setName(draft.detectedName);
      setCharacterAuthoringMode('import');
      const customFieldValues = buildCharacterImportCustomFieldValues(
        sections,
        characterImportDestinationFields
      );
      setFieldValues({
        description: normalizeRichTextValue(buildCharacterImportDescription(draft, sections)),
        age: draft.detectedAge,
        role: draft.detectedRole,
        [CHARACTER_NOTES_FIELD]: normalizeRichTextValue(
          buildCharacterImportNotes(draft, sections)
        ),
        ...Object.fromEntries(
          Object.entries(customFieldValues).map(([key, value]) => [
            key,
            normalizeRichTextValue(value)
          ])
        )
      });
    },
    [characterImportDestinationFields, openCharacterCategory]
  );

  const reviewCharacterImportDraft = useCallback(
    (draft: CharacterImportDraft) => {
      setCharacterImportDraft(draft);
      setCharacterImportSections(draft.sections);
      applyCharacterImportDraftToFields(draft, draft.sections);
      setCharacterImportStep('review');
      setFeedback(null);
    },
    [applyCharacterImportDraftToFields]
  );

  const handleReviewPastedCharacterImport = () => {
    const source = pastedCharacterImportText.trim();
    if (!source) {
      setFeedback({tone: 'error', message: 'Paste character notes before reviewing.'});
      return;
    }
    reviewCharacterImportDraft(parseCharacterImportText(source));
  };

  const handleCharacterImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsImportingCharacterDoc(true);
    setFeedback(null);
    try {
      const source = await readCharacterImportFile(file);
      setPastedCharacterImportText(source);
      reviewCharacterImportDraft(parseCharacterImportText(source, file.name));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import this character document.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsImportingCharacterDoc(false);
    }
  };

  const handleApplyAiHelperSelection = useCallback(() => {
    if (!activeCategory) return;
    const selectedText = aiHelperSelectedText.trim();
    if (!selectedText) {
      setFeedback({
        tone: 'error',
        message: 'Highlight text in the assistant response before applying it.'
      });
      return;
    }

    if (aiHelperApplyTarget === 'name') {
      setName(selectedText);
      setFeedback({
        tone: 'success',
        message: `Set the ${activeCategoryRecordLabel} name from selected assistant text. Review before saving.`
      });
      return;
    }

    if (aiHelperApplyTarget === 'aliases') {
      setFieldValues((currentValues) => {
        const existingAliases = parseAlternativeNames(
          currentValues[ALTERNATIVE_NAMES_KEY] || ''
        );
        const nextAliases = formatAlternativeNames(
          parseAlternativeNames([...existingAliases, selectedText].join(', '))
        );
        return {
          ...currentValues,
          [ALTERNATIVE_NAMES_KEY]: nextAliases
        };
      });
      setFeedback({
        tone: 'success',
        message: 'Added selected assistant text to alternative names. Review before saving.'
      });
      return;
    }

    const fieldKey = aiHelperApplyTarget.replace(/^field:/, '');
    const targetField = activeCategory.fieldSchema.find((field) => field.key === fieldKey);
    if (!targetField) {
      setFeedback({
        tone: 'error',
        message: 'Choose a valid destination field before applying assistant text.'
      });
      return;
    }

    setFieldValues((currentValues) => {
      const existing = currentValues[targetField.key]?.trim();
      const shouldAppend = targetField.type === 'textarea';
      const nextValue = shouldAppend
        ? [existing, selectedText].filter(Boolean).join('\n\n')
        : selectedText;
      return {
        ...currentValues,
        [targetField.key]:
          targetField.type === 'textarea'
            ? normalizeRichTextValue(nextValue)
            : nextValue
      };
    });
    setFeedback({
      tone: 'success',
      message: `Applied selected assistant text to ${targetField.label}. Review before saving.`
    });
  }, [
    activeCategory,
    activeCategoryRecordLabel,
    aiHelperApplyTarget,
    aiHelperSelectedText
  ]);

  const detectedSectionImportDraftCount = useMemo(
    () =>
      importDrafts.filter(
        (draft) =>
          draft.include &&
          !draft.parseError &&
          (draft.detectedSections?.length ?? 0) > 0
      ).length,
    [importDrafts]
  );

  const handleUseDetectedSectionsForImportDrafts = useCallback(() => {
    const draftsToUpdate = importDrafts.filter(
      (draft) =>
        draft.include &&
        !draft.parseError &&
        (draft.detectedSections?.length ?? 0) > 0
    );
    if (draftsToUpdate.length === 0) {
      setFeedback({
        tone: 'error',
        message: 'No selected import drafts have detected headings to apply.'
      });
      return;
    }

    draftsToUpdate.forEach((draft) => {
      updateImportDraft(draft.id, {useDetectedSections: true});
    });
    setFeedback({
      tone: 'success',
      message:
        draftsToUpdate.length === 1
          ? 'Detected headings will be created as fields when you apply this import.'
          : `Detected headings will be created as fields for ${draftsToUpdate.length} selected imports.`
    });
  }, [importDrafts, updateImportDraft]);

  const updateCharacterImportSectionAction = (
    sectionId: string,
    action: CharacterImportSectionDraft['action']
  ) => {
    if (!characterImportDraft) return;
    const nextSections = characterImportSections.map((section) =>
      section.id === sectionId ? {...section, action} : section
    );
    setCharacterImportSections(nextSections);
    applyCharacterImportDraftToFields(characterImportDraft, nextSections);
  };

  const handleAddCharacterSection = async () => {
    if (!activeCategory) return;
    const label = newCharacterSectionName.trim();
    if (!label) {
      setFeedback({
        tone: 'error',
        message: `Name the ${activeCategoryRecordLabel} section first.`
      });
      return;
    }

    const existingKeys = new Set(activeCategory.fieldSchema.map((field) => field.key));
    const baseKey = slugifyFieldKey(label);
    let key = baseKey;
    let suffix = 2;
    while (existingKeys.has(key)) {
      key = `${baseKey}_${suffix}`;
      suffix += 1;
    }

    const updatedCategory: EntityCategory = {
      ...activeCategory,
      fieldSchema: [
        ...activeCategory.fieldSchema,
        {key, label, type: 'textarea'}
      ]
    };
    await saveCategory(updatedCategory);
    setCategories((prev) =>
      prev.map((category) =>
        category.id === updatedCategory.id ? updatedCategory : category
      )
    );
    setFieldValues((prev) => ({
      ...prev,
      [key]: normalizeRichTextValue('')
    }));
    setNewCharacterSectionName('');
    setFeedback({
      tone: 'success',
      message: `Added "${label}" to ${activeCategory.name.toLowerCase()} records.`
    });
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
    setRecordAuthoringMode(entityIsCharacterCategory ? 'idle' : 'manual');
    setPendingReviewFocus(focus);
    setName(entity.name);
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
  }, [aliasMapByEntityId, categories, categoryById]);

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
    handleAddEntityToCompendium,
    handlePromoteEntity,
    handleCanonSync,
    isCharacterLikeEntity
  } = useWorldBibleEntityActions({
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
    buildEntityContent,
    alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
    openReviewItem: handleOpenReviewItem,
    handleEdit,
    resetForm,
    navigate: (to, options) => navigate(to, options as never)
  });

  const handleSaveCanonicalRename = useCallback(async () => {
    await saveEntityDraft({successMessage: 'Canonical name updated.'});
    setIsNameResolverOpen(false);
  }, [saveEntityDraft]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await saveEntityDraft();
  };

  const persistIgnoredEntityMatch = useCallback(
    async (otherEntityId: string) => {
      if (!activeProject || !projectSettings || !editingId) {
        throw new Error('Project settings are not ready.');
      }

      const matchKey = buildEntityMatchKey(editingId, otherEntityId);
      const nextSettings = {
        ...projectSettings,
        ignoredEntityMatchKeys: Array.from(
          new Set([...(projectSettings.ignoredEntityMatchKeys ?? []), matchKey])
        )
      };
      await saveProjectSettings(nextSettings);
      return matchKey;
    },
    [activeProject, editingId, projectSettings, saveProjectSettings]
  );

  const handleKeepSeparateMatch = useCallback(
    async (otherEntity: WorldEntity) => {
      try {
        await persistIgnoredEntityMatch(otherEntity.id);
        setFeedback({
          tone: 'success',
          message: `"${selectedEntity?.name ?? 'This entry'}" and "${otherEntity.name}" will stay separate.`
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to keep these records separate.';
        setFeedback({tone: 'error', message});
      }
    },
    [
      persistIgnoredEntityMatch,
      selectedEntity,
      setFeedback
    ]
  );

  const handleIgnoreEntityMatch = useCallback(
    async (otherEntity: WorldEntity) => {
      try {
        await persistIgnoredEntityMatch(otherEntity.id);
        setFeedback({
          tone: 'success',
          message: `Ignored the match between "${selectedEntity?.name ?? 'this entry'}" and "${otherEntity.name}".`
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to ignore this match.';
        setFeedback({tone: 'error', message});
      }
    },
    [
      persistIgnoredEntityMatch,
      selectedEntity,
      setFeedback
    ]
  );

  const handleAddSuggestedCharacterAlias = useCallback(
    (alias: string) => {
      setFieldValues((prev) => ({
        ...prev,
        [ALTERNATIVE_NAMES_KEY]: formatAlternativeNames(
          parseAlternativeNames(
            [prev[ALTERNATIVE_NAMES_KEY] || '', alias].filter(Boolean).join(', ')
          )
        )
      }));
    },
    []
  );

  useEffect(() => {
    setManualResolutionTargetId((targetId) =>
      manualResolutionTargets.some((entity) => entity.id === targetId)
        ? targetId
        : manualResolutionTargets[0]?.id ?? ''
    );
  }, [manualResolutionTargets]);

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
      if (state.startCharacterImport && characterImportStep === 'idle') {
        setCharacterImportStep('input');
      }
    }
    const focusEntityId = state?.focusEntityId;
    if (!focusEntityId) return;
    const focus = state?.focus ?? 'general';
    const focusKey = `${location.key}:${focusEntityId}:${focus}`;
    if (focusedEntityKeyRef.current === focusKey) {
      return;
    }
    const target = entities.find((entity) => entity.id === focusEntityId);
    if (!target) return;
    setActiveTab(target.categoryId);
    setViewMode('category');
    handleEdit(target, focus);
    if (state?.handoffKind === 'character-canonicalization' && state.handoffSourceName) {
      setHandoffGuidance({
        kind: 'character-canonicalization',
        sourceName: state.handoffSourceName,
        matchEntityId: state.handoffMatchEntityId
      });
    }
    focusedEntityKeyRef.current = focusKey;
  }, [activeTab, categories, characterImportStep, entities, handleEdit, location.key, location.state]);

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
      row[field.key] = getFieldTemplateValue(field);
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
        const value = getFieldTemplateValue(field);
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
    <div key={field.key} className={styles.formGroup}>
      {field.type === 'textarea' ? (
        <WorldBibleRichTextField
          label={field.label}
          required={field.required}
          value={fieldValues[field.key] || ''}
          variant={activeCategoryIsCharacterLike ? 'character' : 'default'}
          onChange={(value) =>
            setFieldValues({
              ...fieldValues,
              [field.key]: value
            })
          }
        />
      ) : (
        <label>
          {field.label}
          {field.required && ' *'}
          {field.type === 'select' ? (
            <select
              value={fieldValues[field.key] || ''}
              onChange={(e) =>
                setFieldValues({
                  ...fieldValues,
                  [field.key]: e.target.value
                })
              }
              required={field.required}
            >
              <option value=''>-- Select --</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : field.type === 'multiselect' ? (
            <div className={styles.multiselectContainer}>
              {field.options?.map((opt) => (
                <label key={opt} className={styles.multiselectOption}>
                  <input
                    type='checkbox'
                    checked={(fieldValues[field.key] || '')
                      .split(',')
                      .includes(opt)}
                    onChange={(e) => {
                      const current = (fieldValues[field.key] || '')
                        .split(',')
                        .filter(Boolean);
                      const updated = e.target.checked
                        ? [...current, opt]
                        : current.filter((v) => v !== opt);
                      setFieldValues({
                        ...fieldValues,
                        [field.key]: updated.join(',')
                      });
                    }}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          ) : field.type === 'checkbox' ? (
            <input
              type='checkbox'
              checked={fieldValues[field.key] === 'true'}
              onChange={(e) =>
                setFieldValues({
                  ...fieldValues,
                  [field.key]: e.target.checked ? 'true' : 'false'
                })
              }
            />
          ) : field.type === 'dice' ? (
            <input
              type='text'
              value={fieldValues[field.key] || ''}
              onChange={(e) =>
                setFieldValues({
                  ...fieldValues,
                  [field.key]: e.target.value
                })
              }
              placeholder={
                field.diceConfig?.allowMultipleDice
                  ? 'e.g., 3d6, 2d8+1d4'
                  : 'e.g., 1d20'
              }
              pattern={field.diceConfig?.allowMultipleDice ? '.*' : '1d\\d+'}
              required={field.required}
            />
          ) : field.type === 'modifier' ? (
            <input
              type='text'
              value={fieldValues[field.key] || ''}
              onChange={(e) =>
                setFieldValues({
                  ...fieldValues,
                  [field.key]: e.target.value
                })
              }
              placeholder='e.g., +5, -2'
              pattern='[+-]?\\d+'
              required={field.required}
            />
          ) : (
            <input
              type={field.type}
              value={fieldValues[field.key] || ''}
              onChange={(e) =>
                setFieldValues({
                  ...fieldValues,
                  [field.key]: e.target.value
                })
              }
              required={field.required}
            />
          )}
        </label>
      )}
    </div>
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
        description='Browse, import, and refine story-facing canon records without leaving the current project.'
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
        {!isCategoryRailCollapsed && (
          <aside className={styles.categoryRail} aria-label='World Bible categories'>
            <div className={styles.categoryRailHeader}>
              <h2>Categories</h2>
              <span className={styles.categoryRailCount}>{categories.length}</span>
            </div>
            <div className={styles.tabNav}>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type='button'
                  onClick={() => handleSelectCategoryTab(cat.id)}
                  className={`${styles.tab} ${
                    viewMode === 'category' && activeTab === cat.id ? styles.active : ''
                  }`}
                >
                  {cat.name}
                </button>
              ))}
              <button
                onClick={() => setShowCategoryManager(!showCategoryManager)}
                className={styles.manageButton}
              >
                {showCategoryManager ? 'Close' : 'Manage Categories'}
              </button>
            </div>
            <div className={styles.categoryRailSection}>
              <h3>Templates</h3>
              <div className={styles.railActions}>
                <button
                  type='button'
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImportingEntities}
                >
                  {isImportingEntities ? 'Importing...' : 'Import Docs'}
                </button>
                <button
                  type='button'
                  onClick={() => jsonImportInputRef.current?.click()}
                  disabled={isImportingJson}
                >
                  {isImportingJson ? 'Loading JSON...' : 'Import JSON'}
                </button>
                <button type='button' onClick={handleDownloadJsonTemplate}>
                  Download JSON Template
                </button>
                <button type='button' onClick={handleDownloadJsonSample}>
                  Download JSON Sample
                </button>
              </div>
            </div>
            <details className={styles.railHelpPanel}>
              <summary>Onboarding</summary>
              <div className={styles.helpBody}>
                <p>
                  Start here when you need stable canon before writing. Add only the records
                  you need for the next scene, then expand later.
                </p>
                <p>
                  Fast path: choose a category, create a record, and capture names,
                  alternative names, status, and one or two high-value facts the workspace
                  should recognize.
                </p>
                <p>
                  Import path: use the import cards in the active category, then review
                  anything marked as needing completion.
                </p>
              </div>
            </details>
            <details className={styles.railHelpPanel}>
              <summary>Workflow Help</summary>
              <div className={styles.helpBody}>
                <p>
                  Step 1: pick or create categories, then choose the active tab.
                </p>
                <p>
                  Step 2: add entries manually or import docs/JSON in batch.
                </p>
                <p>
                  Step 3: review/edit entries and optionally link to Compendium.
                </p>
                <p>
                  Step 4: for multi-project canon, promote key entries or sync parent canon.
                </p>
                <p>
                  Import JSON accepts: <code>[{"{...}"}]</code>,{' '}
                  <code>{"{"}entries: [{"{...}"}]{"}"}</code>,{' '}
                  <code>{"{"}items: [{"{...}"}]{"}"}</code>,{' '}
                  <code>{"{"}rows: [{"{...}"}]{"}"}</code>.
                </p>
              </div>
            </details>
          </aside>
        )}
        <div className={styles.mainColumn}>
      {feedback && (
        <p
          role='status'
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            border: `1px solid ${
              feedback.tone === 'error' ? 'var(--color-error-soft-border)' : 'var(--color-success-soft-border)'
            }`,
            backgroundColor:
              feedback.tone === 'error' ? 'var(--color-error-soft-bg)' : 'var(--color-success-soft-bg)',
            color: feedback.tone === 'error' ? 'var(--color-error)' : 'var(--color-success)'
          }}
        >
          {feedback.message}
        </p>
      )}
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
              <p>Start with a canonical name, aliases, and the core canon fields.</p>
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
              {activeCategoryIsCharacterLike ? (
                <>
                  <p>Review pasted profiles or dossier drafts before they enter rich canon fields.</p>
                  <button
                    type='button'
                    onClick={() => {
                      openCharacterCategory();
                      setCharacterAuthoringMode('import');
                      setCharacterImportStep('input');
                    }}
                  >
                    Import Or Paste
                  </button>
                </>
              ) : (
                <>
                  <p>Import documents into this tab, then review each generated canon record.</p>
                  <button
                    type='button'
                    onClick={() => importInputRef.current?.click()}
                    disabled={isImportingEntities}
                  >
                    {isImportingEntities ? 'Importing...' : 'Import Docs'}
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {activeCategoryIsCharacterLike && characterImportStep === 'input' && (
        <section className={styles.characterImportPanel} aria-label='Import character'>
          <div className={styles.importPanelHeader}>
            <div>
              <h2>Import Character</h2>
              <p className={styles.importSummary}>
                Paste a profile or import a character document. The parsed draft will
                fill World Bible rich fields before you save.
              </p>
            </div>
            <div className={styles.importPanelActions}>
              <button
                type='button'
                onClick={() => setIsImportAiHelperOpen((value) => !value)}
                aria-expanded={isImportAiHelperOpen}
              >
                {isImportAiHelperOpen ? 'Hide AI helper' : 'AI helper'}
              </button>
              <button
                type='button'
                onClick={() => {
                  setCharacterImportStep('idle');
                  setCharacterAuthoringMode('idle');
                  setIsImportAiHelperOpen(false);
                }}
              >
                Close
              </button>
            </div>
          </div>
          {isImportAiHelperOpen && (
            <section className={styles.aiHelperPanel} aria-label='Import AI helper'>
              <div className={styles.aiHelperHeader}>
                <div>
                  <strong>Import AI helper</strong>
                  <p>
                    Ask how to clean up, split, or map this source before reviewing
                    the parsed fields.
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() => setIsImportAiHelperOpen(false)}
                >
                  Close
                </button>
              </div>
              <AIAssistant
                projectId={activeProject.id}
                aiConfig={projectSettings?.aiSettings}
                projectMode={projectSettings?.projectMode}
                context={{
                  type: 'world-bible',
                  id: activeCategory?.id ?? activeProject.id,
                  selectedText: pastedCharacterImportText
                }}
                showContextPreview={false}
              />
            </section>
          )}
          <label className={styles.characterImportLabel}>
            Character notes
            <textarea
              value={pastedCharacterImportText}
              onChange={(event) => setPastedCharacterImportText(event.target.value)}
              rows={10}
              placeholder={'Name: Mira Voss\nRole: Cartographer\n\nBackground:\n...'}
            />
          </label>
          <div className={styles.importPanelActions}>
            <button type='button' onClick={handleReviewPastedCharacterImport}>
              Review Paste
            </button>
            <button
              type='button'
              onClick={() => characterImportInputRef.current?.click()}
              disabled={isImportingCharacterDoc}
            >
              {isImportingCharacterDoc ? 'Importing...' : 'Import File'}
            </button>
            <input
              ref={characterImportInputRef}
              type='file'
              accept='.txt,.md,.rtf,.html,.htm,.docx,text/plain,text/markdown,text/rtf,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              onChange={(event) => void handleCharacterImportFile(event)}
              style={{display: 'none'}}
            />
          </div>
        </section>
      )}

      {activeCategoryIsCharacterLike && characterImportStep === 'review' && characterImportDraft && (
        <section className={styles.characterImportPanel} aria-label='Review character import'>
          <div className={styles.importPanelHeader}>
            <div>
              <h2>Review Character Import</h2>
              <p className={styles.importSummary}>
                Confirm the extracted name and section destinations. The editor below is
                already populated; save only after reviewing the rich fields.
              </p>
            </div>
            <div className={styles.importPanelActions}>
              <button
                type='button'
                onClick={() => setIsImportAiHelperOpen((value) => !value)}
                aria-expanded={isImportAiHelperOpen}
              >
                {isImportAiHelperOpen ? 'Hide AI helper' : 'AI helper'}
              </button>
              <button
                type='button'
                onClick={() => {
                  setCharacterImportStep('idle');
                  setCharacterAuthoringMode('idle');
                  setIsImportAiHelperOpen(false);
                }}
              >
                Close
              </button>
            </div>
          </div>
          {isImportAiHelperOpen && (
            <section className={styles.aiHelperPanel} aria-label='Import review AI helper'>
              <div className={styles.aiHelperHeader}>
                <div>
                  <strong>Import AI helper</strong>
                  <p>
                    Ask for section mapping, cleanup, field suggestions, or gaps to
                    resolve before saving.
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() => setIsImportAiHelperOpen(false)}
                >
                  Close
                </button>
              </div>
              <AIAssistant
                projectId={activeProject.id}
                aiConfig={projectSettings?.aiSettings}
                projectMode={projectSettings?.projectMode}
                context={{
                  type: 'world-bible',
                  id: activeCategory?.id ?? activeProject.id,
                  selectedText: [
                    `Detected name: ${characterImportDraft.detectedName}`,
                    ...characterImportSections.map(
                      (section) => `${section.title} -> ${section.action}\n${section.content}`
                    )
                  ].join('\n\n')
                }}
                showContextPreview={false}
              />
            </section>
          )}
          {characterImportDraft.warnings.length > 0 && (
            <div className={styles.importError}>
              {characterImportDraft.warnings.join(' ')}
            </div>
          )}
          {characterImportSections.length > 0 && (
            <div className={styles.characterImportReviewList}>
              {characterImportSections.map((section) => (
                <div key={section.id} className={styles.characterImportReviewCard}>
                  <div>
                    <strong>{section.title}</strong>
                    <p>{section.content}</p>
                  </div>
                  <label>
                    Destination
                    <select
                      value={section.action}
                      onChange={(event) =>
                        updateCharacterImportSectionAction(
                          section.id,
                          event.target.value as CharacterImportSectionDraft['action']
                        )
                      }
                    >
                      <option value='notes'>Notes</option>
                      <option value='description'>Description</option>
                      {characterImportDestinationFields.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                      <option value='ignore'>Ignore</option>
                    </select>
                  </label>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {importDrafts.length > 0 && (
        <section className={styles.importPanel}>
          <div className={styles.importPanelHeader}>
            <h2>Import Preview</h2>
            <div className={styles.importPanelActions}>
              <button
                type='button'
                onClick={() => setIsImportAiHelperOpen((value) => !value)}
                aria-expanded={isImportAiHelperOpen}
              >
                {isImportAiHelperOpen ? 'Hide AI helper' : 'AI helper'}
              </button>
              <button
                type='button'
                onClick={() => void handleApplyImportDrafts()}
                disabled={isApplyingImports}
              >
                {isApplyingImports ? 'Importing...' : 'Apply Imports'}
              </button>
              <button
                type='button'
                onClick={clearImportDrafts}
                disabled={isApplyingImports}
              >
                Clear
              </button>
            </div>
          </div>
          <p className={styles.importSummary}>
            {importDrafts.filter((draft) => draft.include && !draft.parseError).length}{' '}
            selected · {importDrafts.filter((draft) => draft.parseError).length} with
            errors · {richImportDraftCount} targeting rich-text lore fields
          </p>
          {isImportAiHelperOpen && (
            <section className={styles.aiHelperPanel} aria-label='Import AI helper'>
              <div className={styles.aiHelperHeader}>
                <div>
                  <strong>Import AI helper</strong>
                  <p>
                    Ask about field mapping, cleanup, duplicate handling, or whether
                    these drafts should become one record or several.
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() => setIsImportAiHelperOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className={styles.importHelperActions}>
                <div>
                  <strong>Apply structure to pending imports</strong>
                  <p>
                    The helper can advise, but field changes are staged through the
                    import draft before anything is saved.
                  </p>
                </div>
                <button
                  type='button'
                  onClick={handleUseDetectedSectionsForImportDrafts}
                  disabled={detectedSectionImportDraftCount === 0 || isApplyingImports}
                >
                  Use detected headings
                </button>
                <span>
                  {detectedSectionImportDraftCount > 0
                    ? `${detectedSectionImportDraftCount} selected draft${
                        detectedSectionImportDraftCount === 1 ? '' : 's'
                      } with headings`
                    : 'No selected drafts have detected headings'}
                </span>
              </div>
              <AIAssistant
                projectId={activeProject.id}
                aiConfig={projectSettings?.aiSettings}
                projectMode={projectSettings?.projectMode}
                context={{
                  type: 'world-bible',
                  id: activeCategory?.id ?? activeProject.id,
                  selectedText: importAiContext
                }}
                showContextPreview={false}
              />
            </section>
          )}
          <ul className={styles.importDraftList}>
            {importDrafts.map((draft) => {
              const category = categoryById.get(draft.categoryId) ?? null;
              const preferredField = category ? getPreferredImportField(category) : null;
              const landsAsRichText = preferredField?.type === 'textarea';
              const sourceKind = draft.fileName.toLowerCase().endsWith('.html') ||
                draft.fileName.toLowerCase().endsWith('.htm')
                ? 'HTML'
                : draft.fileName.toLowerCase().endsWith('.md') ||
                    draft.fileName.toLowerCase().endsWith('.markdown')
                  ? 'Markdown'
                  : draft.fileName.toLowerCase().endsWith('.docx')
                    ? 'DOCX'
                    : 'Text';
              return (
                <li key={draft.id} className={styles.importDraftCard}>
                  <div className={styles.importDraftTop}>
                    <label>
                      <input
                        type='checkbox'
                        checked={draft.include}
                        disabled={Boolean(draft.parseError) || isApplyingImports}
                        onChange={(e) =>
                          updateImportDraft(draft.id, {include: e.target.checked})
                        }
                      />
                      <span>{draft.fileName}</span>
                    </label>
                    <div className={styles.importChipRow}>
                      <span className={styles.importChip}>{sourceKind}</span>
                      {preferredField && (
                        <span
                          className={`${styles.importChip} ${
                            landsAsRichText ? styles.importChipRich : styles.importChipPlain
                          }`}
                        >
                          {landsAsRichText
                            ? `Rich text -> ${preferredField.label}`
                            : `Plain field -> ${preferredField.label}`}
                        </span>
                      )}
                      {draft.detectedSections && draft.detectedSections.length > 0 && (
                        <span className={`${styles.importChip} ${styles.importChipRich}`}>
                          {draft.detectedSections.length} section fields detected
                        </span>
                      )}
                      <span className={styles.importChip}>
                        {draft.mode === 'upsert' ? 'Update by name' : 'Create new'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.importDraftFields}>
                    <label>
                      Entry Name
                      <input
                        type='text'
                        value={draft.name}
                        disabled={Boolean(draft.parseError) || isApplyingImports}
                        onChange={(e) =>
                          updateImportDraft(draft.id, {name: e.target.value})
                        }
                      />
                    </label>
                    <label>
                      Category
                      <select
                        value={draft.categoryId}
                        disabled={Boolean(draft.parseError) || isApplyingImports}
                        onChange={(e) =>
                          updateImportDraft(draft.id, {categoryId: e.target.value})
                        }
                      >
                        {categories.map((categoryOption) => (
                          <option key={categoryOption.id} value={categoryOption.id}>
                            {categoryOption.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Behavior
                      <select
                        value={draft.mode}
                        disabled={Boolean(draft.parseError) || isApplyingImports}
                        onChange={(e) =>
                          updateImportDraft(draft.id, {mode: e.target.value as ImportMode})
                        }
                      >
                        <option value='create'>Create New</option>
                        <option value='upsert'>Update by Name</option>
                      </select>
                    </label>
                  </div>
                  {draft.parseError ? (
                    <p className={styles.importError}>{draft.parseError}</p>
                  ) : (
                    <>
                      {draft.detectedSections && draft.detectedSections.length > 0 && (
                        <div className={styles.importSectionMapping}>
                          <label>
                            <input
                              type='checkbox'
                              checked={draft.useDetectedSections ?? false}
                              disabled={isApplyingImports}
                              onChange={(event) =>
                                updateImportDraft(draft.id, {
                                  useDetectedSections: event.target.checked
                                })
                              }
                            />
                            <span>Create fields from detected headings</span>
                          </label>
                          <div className={styles.importSectionList}>
                            {draft.detectedSections.slice(0, 8).map((section) => (
                              <span key={section.id}>{section.title}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className={styles.importDraftActions}>
                        <button
                          type='button'
                          className={styles.importPreviewButton}
                          onClick={() =>
                            void handleApplyImportDrafts({
                              draftIds: [draft.id],
                              openFirstImported: true
                            })
                          }
                          disabled={isApplyingImports}
                        >
                          Import and open
                        </button>
                        {draft.richTextHtml && (
                          <button
                            type='button'
                            className={styles.importPreviewButton}
                            onClick={() => setActiveImportPreviewId(draft.id)}
                            disabled={isApplyingImports}
                          >
                            Preview source document
                          </button>
                        )}
                      </div>
                      <p className={styles.importPreview}>{draft.preview}</p>
                      <p className={styles.importDraftNote}>
                        {draft.useDetectedSections && (draft.detectedSections?.length ?? 0) > 0
                          ? 'Description keeps intro or unmapped text. Detected top-level headings are copied into separate fields.'
                          : landsAsRichText
                            ? 'This import will preserve richer prose structure in the target lore field.'
                            : 'This import will land as plain text in the target field.'}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {activeImportPreviewDraft && (() => {
        const previewCategory = categoryById.get(activeImportPreviewDraft.categoryId) ?? null;
        const previewField = previewCategory ? getPreferredImportField(previewCategory) : null;
        const previewSourceKind =
          activeImportPreviewDraft.fileName.toLowerCase().endsWith('.html') ||
          activeImportPreviewDraft.fileName.toLowerCase().endsWith('.htm')
            ? 'HTML'
            : activeImportPreviewDraft.fileName.toLowerCase().endsWith('.md') ||
                activeImportPreviewDraft.fileName.toLowerCase().endsWith('.markdown')
              ? 'Markdown'
              : activeImportPreviewDraft.fileName.toLowerCase().endsWith('.docx')
                ? 'DOCX'
                : 'Text';
        return (
          <div
            className={styles.importPreviewOverlay}
            role='dialog'
            aria-modal='true'
            aria-label='Import document preview'
            onClick={() => setActiveImportPreviewId(null)}
          >
            <div
              className={styles.importPreviewCard}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.importPreviewHeader}>
                <div>
                  <div className={styles.importPreviewEyebrow}>Import document preview</div>
                  <h3 className={styles.importPreviewTitle}>
                    {activeImportPreviewDraft.name || activeImportPreviewDraft.fileName}
                  </h3>
                  <div className={styles.importChipRow}>
                    <span className={styles.importChip}>{previewSourceKind}</span>
                    {previewField && (
                      <span
                        className={`${styles.importChip} ${
                          previewField.type === 'textarea'
                            ? styles.importChipRich
                            : styles.importChipPlain
                        }`}
                      >
                        {previewField.type === 'textarea'
                          ? `Rich text -> ${previewField.label}`
                          : `Plain field -> ${previewField.label}`}
                      </span>
                    )}
                    <span className={styles.importChip}>{activeImportPreviewDraft.fileName}</span>
                  </div>
                </div>
                <button
                  type='button'
                  className={styles.importPreviewButton}
                  onClick={() =>
                    void handleApplyImportDrafts({
                      draftIds: [activeImportPreviewDraft.id],
                      openFirstImported: true
                    })
                  }
                  disabled={isApplyingImports}
                >
                  Import and open
                </button>
                <button
                  type='button'
                  className={styles.importPreviewButton}
                  onClick={() => setActiveImportPreviewId(null)}
                  disabled={isApplyingImports}
                >
                  Close preview
                </button>
              </div>
              <div className={styles.importPreviewDocument}>
                <article
                  className={styles.importPreviewContent}
                  dangerouslySetInnerHTML={{
                    __html:
                      activeImportPreviewDraft.richTextHtml ||
                      normalizeRichTextValue(activeImportPreviewDraft.text)
                  }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {jsonImportSession && (
        <section className={styles.importPanel}>
          <p className={styles.wizardStep}>
            Step 2 of 3: map keys and resolve validation errors.
          </p>
          <div className={styles.importPanelHeader}>
            <h2>JSON Import Mapping</h2>
            <div className={styles.importPanelActions}>
              <button
                type='button'
                onClick={() => void applyJsonImport()}
                disabled={isApplyingJsonImport}
              >
                {isApplyingJsonImport ? 'Importing...' : 'Apply JSON Import'}
              </button>
              <button
                type='button'
                onClick={clearJsonImportSession}
                disabled={isApplyingJsonImport}
              >
                Clear
              </button>
            </div>
          </div>
          <p className={styles.importSummary}>
            File: {jsonImportSession.fileName} · Rows: {jsonImportSession.rows.length} ·
            Valid: {jsonImportValidCount} · Invalid:{' '}
            {preparedJsonRows.length - jsonImportValidCount} · Conflicts:{' '}
            {jsonImportConflictCount}
          </p>
          {jsonImportConflictCount > 0 && (
            <p className={styles.importError}>
              Resolve duplicate-name conflicts before applying import. Unreviewed conflicts:{' '}
              {unresolvedJsonConflictCount}
            </p>
          )}
          <div className={styles.importDraftFields}>
            <label>
              Category
              <select
                value={jsonImportSession.categoryId}
                onChange={(e) => handleJsonCategoryChange(e.target.value)}
                disabled={isApplyingJsonImport}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Row Name Key
              <select
                value={jsonImportSession.nameKey}
                onChange={(e) => handleJsonNameKeyChange(e.target.value)}
                disabled={isApplyingJsonImport}
              >
                <option value=''>-- Select key --</option>
                {jsonImportSession.keys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Behavior
              <select
                value={jsonImportSession.mode}
                onChange={(e) => handleJsonModeChange(e.target.value as ImportMode)}
                disabled={isApplyingJsonImport}
              >
                <option value='create'>Create New</option>
                <option value='upsert'>Update by Name</option>
              </select>
            </label>
          </div>

          {activeJsonCategory && (
            <div className={styles.mappingGrid}>
              {activeJsonCategory.fieldSchema.map((field) => (
                <label key={field.key}>
                  Map to {field.label}
                  <select
                    value={jsonImportSession.fieldMap[field.key] ?? ''}
                    onChange={(e) =>
                      handleJsonFieldMapChange(field.key, e.target.value)
                    }
                    disabled={isApplyingJsonImport}
                  >
                    <option value=''>-- Unmapped --</option>
                    {jsonImportSession.keys.map((key) => (
                      <option key={`${field.key}:${key}`} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}

          <ul className={styles.importDraftList}>
            {preparedJsonRows.slice(0, 30).map((row) => (
              <li key={`json-row-${row.rowIndex}`} className={styles.importDraftCard}>
                <div className={styles.importDraftTop}>
                  <strong>Row {row.rowIndex}</strong>
                </div>
                <p className={styles.importPreview}>
                  {row.name ? row.name : '(no name)'}
                </p>
                {row.errors.length > 0 && (
                  <p className={styles.importError}>{row.errors.join(' ')}</p>
                )}
                {row.conflict && (
                  <>
                    <p className={styles.importError}>{row.conflict.message}</p>
                    <label>
                      Conflict resolution
                      <select
                        value={jsonImportConflictResolutions[row.rowIndex] ?? ''}
                        onChange={(e) =>
                          handleJsonConflictResolutionChange(
                            row.rowIndex,
                            e.target.value as JsonImportConflictResolution
                          )
                        }
                        disabled={isApplyingJsonImport}
                      >
                        <option value=''>-- Choose resolution --</option>
                        <option value='skip'>Skip Row</option>
                        <option value='upsert'>Update by Name</option>
                        <option value='create'>Create Duplicate</option>
                      </select>
                    </label>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showCategoryManager && (
        <CategoryManager
          projectId={activeProject.id}
          categories={categories}
          onCategoriesChange={setCategories}
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
                <button
                  type='button'
                  onClick={() => {
                    setAiHelperSelectedText('');
                    setIsRecordAiHelperOpen((value) => !value);
                  }}
                  aria-expanded={isRecordAiHelperOpen}
                >
                  {isRecordAiHelperOpen ? 'Hide AI helper' : 'AI helper'}
                </button>
              </div>
              {isRecordAiHelperOpen && (
                <section className={styles.aiHelperPanel} aria-label='World Bible AI helper'>
                  <div className={styles.aiHelperHeader}>
                    <div>
                      <strong>AI helper</strong>
                      <p>
                        Ask for names, descriptions, field ideas, revisions, cleanup,
                        or new sections. Highlight assistant text, choose a destination,
                        then apply it.
                      </p>
                    </div>
                    <button
                      type='button'
                      onClick={() => {
                        setAiHelperSelectedText('');
                        setIsRecordAiHelperOpen(false);
                      }}
                    >
                      Close
                    </button>
                  </div>
                  <div className={styles.aiHelperApplyBar}>
                    <label>
                      Apply to
                      <select
                        value={aiHelperApplyTarget}
                        onChange={(event) =>
                          setAiHelperApplyTarget(event.target.value as AiHelperApplyTarget)
                        }
                      >
                        {aiHelperApplyTargets.map((target) => (
                          <option key={target.value} value={target.value}>
                            {target.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className={styles.aiHelperSelectionPreview}>
                      {aiHelperSelectedText.trim() || 'Highlight text in an assistant response'}
                    </div>
                    <button
                      type='button'
                      onClick={handleApplyAiHelperSelection}
                      disabled={!aiHelperSelectedText.trim()}
                    >
                      Apply selected text
                    </button>
                  </div>
                  <AIAssistant
                    projectId={activeProject.id}
                    aiConfig={projectSettings?.aiSettings}
                    projectMode={projectSettings?.projectMode}
                    context={{
                      type: 'world-bible',
                      id: editingId ?? activeCategory.id,
                      selectedText: currentRecordAiContext
                    }}
                    onAssistantSelectionChange={setAiHelperSelectedText}
                    showContextPreview={false}
                  />
                </section>
              )}
              {activeCategoryIsCharacterLike && (
                <div className={styles.reviewHint}>
                  This World Bible record is the canonical character profile. Resolve
                  the stable name, aliases, duplicate cast records, and story-facing
                  lore here
                  {showCharacterTools
                    ? '; open Character Tools later only for sheets, stats, inventory, or resources.'
                    : '.'}
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
                    </div>

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

                  {selectedEntity && showCharacterTools && (
                    <section className={styles.canonSection} aria-label='Optional character tools'>
                      <div className={styles.canonSectionHeader}>
                        <strong>Optional tools and state</strong>
                        <span>
                          Open sheets, stats, inventory, resources, or replayed state
                          only when this character needs operational tracking.
                        </span>
                      </div>
                      <div className={styles.reviewHint}>
                        World Bible remains the source for canonical name, aliases,
                        lore, and merge decisions. Character Tools uses this canon
                        record as its starting point.
                      </div>
                      <div className={styles.reviewToolbarActions}>
                        <button
                          type='button'
                          onClick={() => void handleImportEntityToCharacters(selectedEntity)}
                          disabled={importingCharacterEntityId === selectedEntity.id}
                        >
                          {importingCharacterEntityId === selectedEntity.id
                            ? 'Opening...'
                            : 'Open optional tools'}
                        </button>
                        {hasRuleset ? (
                          <button
                            type='button'
                            onClick={() =>
                              void handleImportEntityToCharacters(selectedEntity, {
                                autoCreateSheet: true
                              })
                            }
                            disabled={importingCharacterEntityId === selectedEntity.id}
                          >
                            {importingCharacterEntityId === selectedEntity.id
                              ? 'Opening...'
                              : 'Create/open sheet + state'}
                          </button>
                        ) : (
                          <span className={styles.reviewHint}>
                            Sheets and state unlock after this project has a ruleset.
                          </span>
                        )}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <>
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
                        placeholder='Comma-separated aliases, titles, or shorthand references'
                      />
                    </label>
                    </div>

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

                  {activeCategory.fieldSchema.map(renderEntityField)}

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
                </>
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
                        : 'Create Entry'}
                </button>
                {(editingId || activeCategoryIsCharacterLike || recordAuthoringMode !== 'idle') && (
                  <button type='button' onClick={resetForm} disabled={isSubmittingEntity}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
            {editingId && (
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

          {viewMode !== 'review' && (activeCategoryIsCharacterLike ? !isFocusedCharacterTask : !isFocusedRecordTask) && (
          <div
            className={`${styles.listSection} ${styles.castListSection}`}
          >
            <h2>{activeCategory.name}</h2>
            {visibleEntities.length === 0 && (
              <p className={styles.emptyState}>
                {`No ${activeCategory.name.toLowerCase()} yet. Use Create Manually above when you are ready.`}
              </p>
            )}
            <ul className={styles.entityList}>
              {visibleEntities.map((entity) => {
                const entityCategory =
                  categories.find((category) => category.id === entity.categoryId) ?? null;
                const {primarySummary, fullSummary, summaryIsTruncated, secondaryFields} = buildEntityCardSummary(
                  entity,
                  entityCategory,
                  aliasMapByEntityId.get(entity.id) ?? []
                );
                const isSummaryExpanded = expandedSummaryEntityIds.includes(entity.id);
                const displayedSummary = isSummaryExpanded ? fullSummary : primarySummary;
                const entityIsCharacterLike = isCharacterLikeEntity(entity);
                const entityInsight = reviewEntityInsightsById.get(entity.id);
                const entityQueueItem = reviewQueue.find((item) => item.entity.id === entity.id);
                const needsAliasReview = Boolean(
                  entityQueueItem?.reasons.includes('aliasFollowUp')
                );
                const needsCompletionReview = Boolean(
                  entityQueueItem?.reasons.includes('needsCompletion') || entity.needsCompletion
                );
                const hasNameResolutionMatch =
                  entityIsCharacterLike && (entityInsight?.matchCount ?? 0) > 0;
                const needsNameReview = needsAliasReview || hasNameResolutionMatch;
                const hasReviewBadge = needsCompletionReview || needsNameReview;

                return (
                <li key={entity.id} className={styles.entityCard}>
                  <div className={styles.entityHeader}>
                    <div className={styles.entityName}>{entity.name}</div>
                    {entity.isNew && (
                      <span className={styles.newBadge}>New</span>
                    )}
                    {needsCompletionReview && (
                      <span className={styles.completionBadge}>Needs completion</span>
                    )}
                    {needsNameReview && (
                      <span className={styles.aliasMatchBadge}>Names need review</span>
                    )}
                  </div>
                  {hasNameResolutionMatch && (
                    <div className={styles.entityAttentionNote}>
                      This character looks related to{' '}
                      {entityInsight?.matchCount === 1
                        ? 'another canon record'
                        : `${entityInsight?.matchCount ?? 0} canon records`}
                      . Use Resolve names to merge duplicates or convert short forms into aliases.
                    </div>
                  )}
                  {displayedSummary && (
                    <div className={styles.entitySummaryBlock}>
                      <p className={styles.entitySummary}>{displayedSummary}</p>
                      {summaryIsTruncated && (
                        <button
                          type='button'
                          className={styles.entitySummaryToggle}
                          onClick={() =>
                            setExpandedSummaryEntityIds((prev) =>
                              prev.includes(entity.id)
                                ? prev.filter((id) => id !== entity.id)
                                : [...prev, entity.id]
                            )
                          }
                        >
                          {isSummaryExpanded ? 'Show less' : 'Read more'}
                        </button>
                      )}
                    </div>
                  )}
                  {secondaryFields.map((field) => (
                    <div key={field.label} className={styles.entityField}>
                      <strong>{field.label}:</strong> {field.value}
                    </div>
                  ))}
                  <div className={styles.entityActions}>
                    <button
                      onClick={() => handleEdit(entity)}
                    >
                      Edit
                    </button>
                    {hasNameResolutionMatch && (
                      <button
                        type='button'
                        className={styles.primaryButton}
                        onClick={() => handleEdit(entity, 'aliases')}
                      >
                        Resolve names
                      </button>
                    )}
                    {hasReviewBadge && (
                      <button
                        type='button'
                        onClick={() => void handleMarkEntityComplete(entity)}
                      >
                        Mark reviewed
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteEntity(entity.id)}
                      disabled={deletingEntityId === entity.id}
                      className={styles.deleteButton}
                    >
                      {deletingEntityId === entity.id ? 'Deleting...' : 'Delete'}
                    </button>
                    {seriesConfig?.parentProjectId && (
                      <button
                        type='button'
                        onClick={() => void handlePromoteEntity(entity)}
                        disabled={promotingEntityId === entity.id}
                      >
                        {promotingEntityId === entity.id
                          ? 'Promoting...'
                          : 'Promote to parent'}
                      </button>
                    )}
                    {entityIsCharacterLike && showCharacterTools && (
                      <button
                        type='button'
                        onClick={() => void handleImportEntityToCharacters(entity)}
                        disabled={importingCharacterEntityId === entity.id}
                        title='Open optional character tools for roster details. World Bible remains the canonical record.'
                      >
                        {importingCharacterEntityId === entity.id
                          ? 'Opening...'
                          : 'Open optional tools'}
                      </button>
                    )}
                    {entityIsCharacterLike && showCharacterTools && hasRuleset && (
                      <button
                        type='button'
                        onClick={() =>
                          void handleImportEntityToCharacters(entity, {
                            autoCreateSheet: true
                          })
                        }
                        disabled={importingCharacterEntityId === entity.id}
                        title='Open or create sheet and state tracking for this World Bible character. World Bible remains the canonical record.'
                      >
                        {importingCharacterEntityId === entity.id
                          ? 'Opening...'
                          : 'Create/open sheet + state'}
                      </button>
                    )}
                    {showGameSystems && (
                      <button
                        type='button'
                        onClick={() => void handleAddEntityToCompendium(entity)}
                        disabled={linkingCompendiumEntityId === entity.id}
                        title='Attach optional progression, crafting, discovery, or bestiary mechanics.'
                      >
                        {linkingCompendiumEntityId === entity.id
                          ? 'Linking...'
                          : compendiumLinkedEntityIds.has(entity.id)
                            ? 'Update Mechanics'
                            : 'Add Mechanics'}
                      </button>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
          </div>
          )}
        </div>
      )}
        </div>
      </div>
    </section>
  );
}

interface CategoryManagerProps {
  projectId: string;
  categories: EntityCategory[];
  onCategoriesChange: (cats: EntityCategory[]) => void;
  onClose: () => void;
}

function CategoryManager({
  projectId,
  categories,
  onCategoriesChange,
  onClose
}: CategoryManagerProps) {
  const [newCatName, setNewCatName] = useState('');
  const [editingCategory, setEditingCategory] = useState<EntityCategory | null>(
    null
  );

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;

    const cat: EntityCategory = {
      id: crypto.randomUUID(),
      projectId,
      name: newCatName,
      slug: newCatName.toLowerCase().replace(/\s+/g, '-'),
      fieldSchema: [
        {key: 'description', label: 'Description', type: 'textarea'}
      ],
      createdAt: Date.now()
    };

    await saveCategory(cat);
    onCategoriesChange([...categories, cat]);
    setNewCatName('');
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? All entities in it will be orphaned.'))
      return;
    await deleteCategory(id);
    onCategoriesChange(categories.filter((c) => c.id !== id));
  };

  const handleSaveCategory = (updated: EntityCategory) => {
    onCategoriesChange(
      categories.map((c) => (c.id === updated.id ? updated : c))
    );
    setEditingCategory(null);
  };

  if (editingCategory) {
    return (
      <CategoryEditor
        category={editingCategory}
        onSave={handleSaveCategory}
        onCancel={() => setEditingCategory(null)}
      />
    );
  }

  return (
    <div className={styles.categoryManager}>
      <h3>Manage Categories</h3>
      <div className={styles.addCategoryForm}>
        <input
          type='text'
          placeholder='New category name (e.g., Monsters)'
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
        />
        <button onClick={handleAddCategory}>Add Category</button>
      </div>

      <ul className={styles.categoryList}>
        {categories.map((cat) => (
          <li key={cat.id} className={styles.categoryItem}>
            <div className={styles.categoryInfo}>
              <strong>{cat.name}</strong>
              <span className={styles.categoryMeta}>
                ({cat.fieldSchema.length} fields)
              </span>
            </div>
            <div className={styles.categoryActions}>
              <button onClick={() => setEditingCategory(cat)}>
                Edit Fields
              </button>
              <button
                onClick={() => handleDeleteCategory(cat.id)}
                className={styles.deleteButton}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button onClick={onClose} className={styles.closeButton}>
        Close
      </button>
    </div>
  );
}

export default WorldBibleRoute;
