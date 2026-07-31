import {useEffect, useState, useCallback, useMemo} from 'react';
import type {FormEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import type {
  Character,
  CharacterSheet,
  CharacterTrackedEntry,
  CompendiumEntry,
  CharacterStat,
  CharacterResource,
  StateMutationCommand,
  StateMutationEvent,
  WritingDocument
} from '../entityTypes';
import type {StoredRuleset} from '../entityTypes';
import {
  getCharacterSheetsByProject,
  saveCharacterSheet,
  deleteCharacterSheet
} from '../services/characters';
import {getCharactersByProject} from '../characterStorage';
import {getRulesetByProjectId} from '../services/rules';
import type {
  ShodhMemoryProvider,
  MemoryEntry
} from '../services/shodh/ShodhMemoryService';
import {getShodhService} from '../services/shodh/getShodhService';
import {ShodhMemoryPanel} from '../components/ShodhMemoryPanel';
import {
  getSeriesBibleConfig,
  promoteMemoryToParent,
  promoteDocumentToParent
} from '../services/seriesBible/SeriesBibleService';
import {
  DEFAULT_PARTY_SYNERGY_RULES,
  deriveCharacterRuntimeModifiers,
  getEffectiveResourceValues,
  getEffectiveStatValue,
  getOrCreateSettlementState,
  getPartySynergySuggestions,
  getSettlementModulesByProject,
  getCompendiumEntriesByProject
} from '../services/compendium';
import {getDocumentsByProject, sortWritingDocuments} from '../writingStorage';
import {
  getStateMutationEventsByProject,
  invalidateStateMutationEventById,
  saveStateMutationEvent
} from '../services/state/stateMutationLedger';
import {
  replayCharacterState,
  validateStateMutationCommandAgainstState,
  validateStateMutationEventForRuleset
} from '../services/state/stateReplay';
import {buildStateMutationPreview} from '../services/state/stateMutationPresentation';
import {validateStateMutationEvent} from '../services/state/stateMutationSchemas';
import {
  describeStateMutationEventStaleness,
  getStateMutationEventStaleness
} from '../services/state/stateMutationStaleness';

import {useAppStore} from '../store/appStore';
import {getProjectCapabilities} from '../projectMode';
import {
  reconcileCharacterResources,
  reconcileCharacterStats
} from '../services/characters/characterSheetRuleset';
import {
  buildDefaultResources,
  buildDefaultStats,
  hashString,
  summarizeMutationCommand
} from '../services/characters/characterSheetDefaults';
import {
  MutationForm,
  type MutationFormType
} from '../components/CharacterSheets/MutationForm';
import {CharacterSheetList} from '../components/CharacterSheets/CharacterSheetList';
import styles from '../styles/CharacterSheetsRoute.module.css';

interface CharacterSheetsRouteProps {
  embedded?: boolean;
  prefillCharacterId?: string | null;
  onPrefillConsumed?: () => void;
  autoCreateSheetCharacterId?: string | null;
  onAutoCreateConsumed?: () => void;
}

function CharacterSheetsRoute({
  embedded = false,
  prefillCharacterId,
  onPrefillConsumed,
  autoCreateSheetCharacterId,
  onAutoCreateConsumed
}: CharacterSheetsRouteProps) {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const navigate = useNavigate();
  const [sheets, setSheets] = useState<CharacterSheet[]>([]);
  const [ruleset, setRuleset] = useState<StoredRuleset | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taskView, setTaskView] = useState<'setup' | 'scene-history'>('setup');
  const [name, setName] = useState('');
  const [level, setLevel] = useState(1);
  const [experience, setExperience] = useState(0);
  const [stats, setStats] = useState<CharacterStat[]>([]);
  const [resources, setResources] = useState<CharacterResource[]>([]);
  const [notes, setNotes] = useState('');
  const [inventoryEntries, setInventoryEntries] = useState<CharacterTrackedEntry[]>([]);
  const [equipmentEntries, setEquipmentEntries] = useState<CharacterTrackedEntry[]>([]);
  const [statusEntries, setStatusEntries] = useState<CharacterTrackedEntry[]>([]);
  const [compendiumEntries, setCompendiumEntries] = useState<CompendiumEntry[]>(
    []
  );
  const [documents, setDocuments] = useState<WritingDocument[]>([]);
  const [stateMutationEvents, setStateMutationEvents] = useState<StateMutationEvent[]>([]);
  const [quickInventoryName, setQuickInventoryName] = useState('');
  const [quickInventoryQty, setQuickInventoryQty] = useState(1);
  const [quickEquipmentName, setQuickEquipmentName] = useState('');
  const [quickStatusName, setQuickStatusName] = useState('');
  const [catalogInventoryId, setCatalogInventoryId] = useState('');
  const [catalogEquipmentId, setCatalogEquipmentId] = useState('');
  const [catalogStatusId, setCatalogStatusId] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [settlementState, setSettlementState] = useState<Awaited<
    ReturnType<typeof getOrCreateSettlementState>
  > | null>(null);
  const [settlementModules, setSettlementModules] = useState<Awaited<
    ReturnType<typeof getSettlementModulesByProject>
  >>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [shodhService, setShodhService] =
    useState<ShodhMemoryProvider | null>(null);
  const [rulesetMemory, setRulesetMemory] = useState<MemoryEntry | null>(null);
  const [rulesetMemoryFilter, setRulesetMemoryFilter] = useState('');
  const capabilities = getProjectCapabilities(projectSettings);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingSheetId, setDeletingSheetId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [mutationTargetSheetId, setMutationTargetSheetId] = useState('');
  const [mutationSceneId, setMutationSceneId] = useState('');
  const [mutationType, setMutationType] =
    useState<MutationFormType>('resource_change');
  const [mutationStatDefinitionId, setMutationStatDefinitionId] = useState('');
  const [mutationResourceDefinitionId, setMutationResourceDefinitionId] =
    useState('');
  const [mutationNumberValue, setMutationNumberValue] = useState('0');
  const [mutationTextValue, setMutationTextValue] = useState('');
  const [mutationBooleanValue, setMutationBooleanValue] = useState(false);
  const [mutationStatusName, setMutationStatusName] = useState('');
  const [mutationItemName, setMutationItemName] = useState('');
  const [mutationQuantity, setMutationQuantity] = useState('1');
  const [mutationLocationName, setMutationLocationName] = useState('');
  const [isSavingMutation, setIsSavingMutation] = useState(false);
  const [invalidatingMutationEventId, setInvalidatingMutationEventId] =
    useState<string | null>(null);
  const [editingMutationEventId, setEditingMutationEventId] = useState<string | null>(
    null
  );
  const [reorderingMutationEventId, setReorderingMutationEventId] = useState<
    string | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!activeProject) {
        if (!cancelled) {
          setSheets([]);
          setRuleset(null);
          setCharacters([]);
          setSettlementState(null);
          setSettlementModules([]);
          setCompendiumEntries([]);
          setDocuments([]);
          setStateMutationEvents([]);
          setShodhService(null);
          setRulesetMemory(null);
          setIsLoaded(true);
        }
        return;
      }
      if (!cancelled) {
        setIsLoaded(false);
      }

      const [
        loadedSheets,
        loadedRuleset,
        loadedCharacters,
        loadedSettlementState,
        loadedSettlementModules,
        loadedCompendiumEntries,
        loadedDocuments,
        loadedStateMutationEvents
      ] = await Promise.all(
        [
          getCharacterSheetsByProject(activeProject.id),
          getRulesetByProjectId(activeProject.id),
          getCharactersByProject(activeProject.id),
          getOrCreateSettlementState(activeProject.id),
          getSettlementModulesByProject(activeProject.id),
          getCompendiumEntriesByProject(activeProject.id),
          getDocumentsByProject(activeProject.id),
          getStateMutationEventsByProject(activeProject.id)
        ]
      );

      const bibleConfig = getSeriesBibleConfig(activeProject);
      const shodhOptions =
        bibleConfig.parentProjectId && bibleConfig.inheritShodh
          ? {
              projectId: activeProject.id,
              inheritFromParent: true,
              parentProjectId: bibleConfig.parentProjectId
            }
          : {projectId: activeProject.id};

      let shodh: ShodhMemoryProvider | null = null;
      if (!cancelled) {
        setSheets(
          loadedSheets.map((sheet) => ({
            ...sheet,
            stats: reconcileCharacterStats(loadedRuleset, sheet.stats),
            resources: reconcileCharacterResources(loadedRuleset, sheet.resources)
          }))
        );
        setRuleset(loadedRuleset);
        setStats(buildDefaultStats(loadedRuleset));
        setResources(buildDefaultResources(loadedRuleset));
        setCharacters(loadedCharacters);
        setSettlementState(loadedSettlementState);
        setSettlementModules(loadedSettlementModules);
        setCompendiumEntries(loadedCompendiumEntries);
        setDocuments(loadedDocuments);
        setStateMutationEvents(loadedStateMutationEvents);
        shodh = await getShodhService(shodhOptions);
        if (!cancelled) {
          setShodhService(shodh);
        }

        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    if (!prefillCharacterId || editingId || !isLoaded) {
      return;
    }
    const character = characters.find((c) => c.id === prefillCharacterId);
    if (character) {
      setEditingId(null);
      setSelectedCharacterId(prefillCharacterId);
      setName(character.name);
      setLevel(1);
      setExperience(0);
      setNotes('');
      setInventoryEntries([]);
      setEquipmentEntries([]);
      setStatusEntries([]);
      setQuickInventoryName('');
      setQuickInventoryQty(1);
      setQuickEquipmentName('');
      setQuickStatusName('');
      setCatalogInventoryId('');
      setCatalogEquipmentId('');
      setCatalogStatusId('');
      setStats(buildDefaultStats(ruleset));
      setResources(buildDefaultResources(ruleset));
      setFeedback({
        tone: 'success',
        message: `"${character.name}" is ready for a sheet. Base stats and resources below come from the active ruleset.`
      });
    }
    onPrefillConsumed?.();
  }, [
    prefillCharacterId,
    characters,
    editingId,
    isLoaded,
    ruleset,
    onPrefillConsumed
  ]);

  useEffect(() => {
    if (!autoCreateSheetCharacterId || editingId || !isLoaded || !activeProject) {
      return;
    }
    const character = characters.find((entry) => entry.id === autoCreateSheetCharacterId);
    if (!character) {
      onAutoCreateConsumed?.();
      return;
    }

    const existingSheet =
      sheets.find((sheet) => sheet.characterId === autoCreateSheetCharacterId) ?? null;
    if (existingSheet) {
      setEditingId(existingSheet.id);
      setSelectedCharacterId(existingSheet.characterId || '');
      setName(existingSheet.name);
      setLevel(existingSheet.level);
      setExperience(existingSheet.experience);
      setStats(reconcileCharacterStats(ruleset, existingSheet.stats));
      setResources(reconcileCharacterResources(ruleset, existingSheet.resources));
      setNotes(existingSheet.notes || '');
      setInventoryEntries(
        mergeLegacyAndTracked(existingSheet.inventory, existingSheet.inventoryEntries)
      );
      setEquipmentEntries(
        mergeLegacyAndTracked(existingSheet.equipment, existingSheet.equipmentEntries)
      );
      setStatusEntries(
        mergeLegacyAndTracked(existingSheet.statuses, existingSheet.statusEntries)
      );
      setFeedback({
        tone: 'success',
        message: `Opened the existing sheet for "${character.name}".`
      });
      onAutoCreateConsumed?.();
      return;
    }

    const now = Date.now();
    const sheet: CharacterSheet = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      characterId: character.id,
      name: character.name,
      level: 1,
      experience: 0,
      stats: buildDefaultStats(ruleset),
      resources: buildDefaultResources(ruleset),
      inventory: [],
      equipment: [],
      statuses: [],
      inventoryEntries: [],
      equipmentEntries: [],
      statusEntries: [],
      notes: character.description ?? '',
      createdAt: now,
      updatedAt: now
    };

    void saveCharacterSheet(sheet)
      .then(() => {
        setSheets((prev) => [...prev, sheet]);
        setEditingId(sheet.id);
        setSelectedCharacterId(sheet.characterId || '');
        setName(sheet.name);
        setLevel(sheet.level);
        setExperience(sheet.experience);
        setStats(reconcileCharacterStats(ruleset, sheet.stats));
        setResources(reconcileCharacterResources(ruleset, sheet.resources));
        setNotes(sheet.notes || '');
        setInventoryEntries(
          mergeLegacyAndTracked(sheet.inventory, sheet.inventoryEntries)
        );
        setEquipmentEntries(
          mergeLegacyAndTracked(sheet.equipment, sheet.equipmentEntries)
        );
        setStatusEntries(
          mergeLegacyAndTracked(sheet.statuses, sheet.statusEntries)
        );
        setFeedback({
          tone: 'success',
          message: `Created a character sheet for "${character.name}". Stats and resources came from the active ruleset.`
        });
      })
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to create a character sheet.';
        setFeedback({tone: 'error', message});
      })
      .finally(() => {
        onAutoCreateConsumed?.();
      });
  }, [
    activeProject,
    autoCreateSheetCharacterId,
    characters,
    editingId,
    isLoaded,
    onAutoCreateConsumed,
    ruleset,
    sheets
  ]);

  const refreshRulesetMemory = useCallback(async () => {
    if (!shodhService || !ruleset?.id) {
      setRulesetMemory(null);
      return;
    }
    const list = await shodhService.listMemories();
    const memory = list.find((entry) => entry.documentId === ruleset.id) ?? null;
    setRulesetMemory(memory);
  }, [shodhService, ruleset?.id]);

  useEffect(() => {
    void refreshRulesetMemory();
  }, [refreshRulesetMemory]);


  const resetForm = () => {
    setEditingId(null);
    setSelectedCharacterId('');
    setName('');
    setLevel(1);
    setExperience(0);
    setNotes('');
    setInventoryEntries([]);
    setEquipmentEntries([]);
    setStatusEntries([]);
    setQuickInventoryName('');
    setQuickInventoryQty(1);
    setQuickEquipmentName('');
    setQuickStatusName('');
    setCatalogInventoryId('');
    setCatalogEquipmentId('');
    setCatalogStatusId('');
    initializeStatsAndResources();
  };

  const initializeStatsAndResources = () => {
    setStats(buildDefaultStats(ruleset));
    setResources(buildDefaultResources(ruleset));
  };

  const toLegacyList = (entries: CharacterTrackedEntry[]): string[] =>
    entries.map((entry) =>
      entry.quantity && entry.quantity > 1
        ? `${entry.name} x${entry.quantity}`
        : entry.name
    );

  const mergeLegacyAndTracked = (
    legacy: string[] | undefined,
    tracked: CharacterTrackedEntry[] | undefined
  ): CharacterTrackedEntry[] => {
    const fromTracked = tracked ?? [];
    const seen = new Set(
      fromTracked.map((entry) => `${entry.name}:${entry.quantity ?? 1}`)
    );
    const fromLegacy = (legacy ?? [])
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .filter((name) => {
        const key = `${name}:1`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .map((name) => ({
        id: crypto.randomUUID(),
        mode: 'quick' as const,
        name,
        quantity: 1
      }));
    return [...fromTracked, ...fromLegacy];
  };

  const appendQuickEntry = (
    target: 'inventory' | 'equipment' | 'status',
    name: string,
    quantity = 1
  ) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next: CharacterTrackedEntry = {
      id: crypto.randomUUID(),
      mode: 'quick',
      name: trimmed,
      quantity
    };
    if (target === 'inventory') {
      setInventoryEntries((prev) => [...prev, next]);
      setQuickInventoryName('');
      setQuickInventoryQty(1);
      return;
    }
    if (target === 'equipment') {
      setEquipmentEntries((prev) => [...prev, next]);
      setQuickEquipmentName('');
      return;
    }
    setStatusEntries((prev) => [...prev, next]);
    setQuickStatusName('');
  };

  const appendCatalogEntry = (
    target: 'inventory' | 'equipment' | 'status',
    entryId: string
  ) => {
    if (!entryId) return;
    const found = compendiumEntries.find((entry) => entry.id === entryId);
    if (!found) return;
    const next: CharacterTrackedEntry = {
      id: crypto.randomUUID(),
      mode: 'cataloged',
      name: found.name,
      quantity: 1,
      definitionId: found.id
    };
    if (target === 'inventory') {
      setInventoryEntries((prev) => [...prev, next]);
      setCatalogInventoryId('');
      return;
    }
    if (target === 'equipment') {
      setEquipmentEntries((prev) => [...prev, next]);
      setCatalogEquipmentId('');
      return;
    }
    setStatusEntries((prev) => [...prev, next]);
    setCatalogStatusId('');
  };

  const removeTrackedEntry = (
    target: 'inventory' | 'equipment' | 'status',
    id: string
  ) => {
    if (target === 'inventory') {
      setInventoryEntries((prev) => prev.filter((entry) => entry.id !== id));
      return;
    }
    if (target === 'equipment') {
      setEquipmentEntries((prev) => prev.filter((entry) => entry.id !== id));
      return;
    }
    setStatusEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeProject) {
      alert('Select or create a project first.');
      return;
    }

    const now = Date.now();
    const id = editingId ?? crypto.randomUUID();
    const existing = sheets.find((s) => s.id === id);

    const normalizedInventory = inventoryEntries.filter(
      (entry) => entry.name.trim().length > 0
    );
    const normalizedEquipment = equipmentEntries.filter(
      (entry) => entry.name.trim().length > 0
    );
    const normalizedStatuses = statusEntries.filter(
      (entry) => entry.name.trim().length > 0
    );

    const sheet: CharacterSheet = {
      id,
      projectId: activeProject.id,
      characterId: selectedCharacterId || undefined,
      name: name.trim(),
      level,
      experience,
      stats: reconcileCharacterStats(ruleset, stats),
      resources: reconcileCharacterResources(ruleset, resources),
      inventory: toLegacyList(normalizedInventory),
      equipment: toLegacyList(normalizedEquipment),
      statuses: toLegacyList(normalizedStatuses),
      inventoryEntries: normalizedInventory,
      equipmentEntries: normalizedEquipment,
      statusEntries: normalizedStatuses,
      notes: notes.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    setIsSubmitting(true);
    setFeedback(null);
    try {
      await saveCharacterSheet(sheet);

      setSheets((prev) =>
        editingId ? prev.map((s) => (s.id === id ? sheet : s)) : [...prev, sheet]
      );

      resetForm();
      setFeedback({
        tone: 'success',
        message: editingId ? 'Character sheet updated.' : 'Character sheet created.'
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to save character sheet.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (sheet: CharacterSheet) => {
    setTaskView('setup');
    setEditingId(sheet.id);
    setSelectedCharacterId(sheet.characterId || '');
    setName(sheet.name);
    setLevel(sheet.level);
    setExperience(sheet.experience);
    setStats(reconcileCharacterStats(ruleset, sheet.stats));
    setResources(reconcileCharacterResources(ruleset, sheet.resources));
    setNotes(sheet.notes || '');
    setInventoryEntries(
      mergeLegacyAndTracked(sheet.inventory, sheet.inventoryEntries)
    );
    setEquipmentEntries(
      mergeLegacyAndTracked(sheet.equipment, sheet.equipmentEntries)
    );
    setStatusEntries(
      mergeLegacyAndTracked(sheet.statuses, sheet.statusEntries)
    );
  };

  const handleCharacterSelect = (characterId: string) => {
    setSelectedCharacterId(characterId);
    const character = characters.find((c) => c.id === characterId);
    if (character && !editingId) {
      setName(character.name);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this character sheet?')) return;
    setDeletingSheetId(id);
    setFeedback(null);
    try {
      await deleteCharacterSheet(id);
      setSheets((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) resetForm();
      setFeedback({tone: 'success', message: 'Character sheet deleted.'});
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to delete character sheet.';
      setFeedback({tone: 'error', message});
    } finally {
      setDeletingSheetId(null);
    }
  };

  const updateStatValue = (definitionId: string, value: number) => {
    setStats((prev) =>
      prev.map((s) => (s.definitionId === definitionId ? {...s, value} : s))
    );
  };

  const updateResourceCurrent = (definitionId: string, current: number) => {
    setResources((prev) =>
      prev.map((r) => (r.definitionId === definitionId ? {...r, current} : r))
    );
  };

  const updateResourceMax = (definitionId: string, max: number) => {
    setResources((prev) =>
      prev.map((r) => (r.definitionId === definitionId ? {...r, max} : r))
    );
  };

  const getStatDefinition = (definitionId: string) =>
    ruleset?.statDefinitions.find((def) => def.id === definitionId);

  const getResourceDefinition = (definitionId: string) =>
    ruleset?.resourceDefinitions.find((def) => def.id === definitionId);

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
  const effectiveLevel = Math.max(1, level + runtimeModifiers.levelBonus);
  const statusCatalogOptions = useMemo(
    () =>
      compendiumEntries.filter((entry) => {
        const tags = (entry.tags ?? []).map((tag) => tag.toLowerCase());
        return entry.domain === 'custom' || tags.includes('status');
      }),
    [compendiumEntries]
  );

  const orderedDocuments = useMemo(
    () => sortWritingDocuments(documents),
    [documents]
  );

  const sceneOrderById = useMemo(
    () =>
      new Map(
        orderedDocuments.map((document, index) => [document.id, index + 1] as const)
      ),
    [orderedDocuments]
  );

  const selectedMutationSheet = useMemo(
    () => sheets.find((sheet) => sheet.id === mutationTargetSheetId) ?? null,
    [sheets, mutationTargetSheetId]
  );

  const selectedMutationScene = useMemo(
    () =>
      orderedDocuments.find((document) => document.id === mutationSceneId) ?? null,
    [orderedDocuments, mutationSceneId]
  );

  const selectedMutationStatDefinition = useMemo(
    () =>
      ruleset?.statDefinitions.find(
        (definition) => definition.id === mutationStatDefinitionId
      ) ?? null,
    [ruleset, mutationStatDefinitionId]
  );

  const selectedMutationResourceDefinition = useMemo(
    () =>
      ruleset?.resourceDefinitions.find(
        (definition) => definition.id === mutationResourceDefinitionId
      ) ?? null,
    [ruleset, mutationResourceDefinitionId]
  );

  const selectedMutationActorId =
    selectedMutationSheet?.characterId ?? selectedMutationSheet?.id ?? '';

  const buildDraftMutationCommand = useCallback(
    (params: {
      actorId: string;
      mutationType: MutationFormType;
      statDefinition: StoredRuleset['statDefinitions'][number] | null;
      resourceDefinition: StoredRuleset['resourceDefinitions'][number] | null;
      numberValue: string;
      textValue: string;
      booleanValue: boolean;
      statusName: string;
      itemName: string;
      quantity: string;
      locationName: string;
    }): StateMutationCommand | null => {
      const actorId = params.actorId.trim();
      if (!actorId) return null;
      const numericValue = Number(params.numberValue);
      const quantity = Math.max(1, Number(params.quantity) || 1);
      const itemName = params.itemName.trim();
      const statusName = params.statusName.trim();
      const locationName = params.locationName.trim();

      switch (params.mutationType) {
        case 'resource_change':
          return params.resourceDefinition && Number.isFinite(numericValue)
            ? {
                type: 'resource_change',
                actorId,
                resourceDefinitionId: params.resourceDefinition.id,
                delta: numericValue
              }
            : null;
        case 'resource_set':
          return params.resourceDefinition && Number.isFinite(numericValue)
            ? {
                type: 'resource_set',
                actorId,
                resourceDefinitionId: params.resourceDefinition.id,
                value: numericValue
              }
            : null;
        case 'stat_change':
          if (!params.statDefinition) return null;
          if (
            params.statDefinition.type === 'number' &&
            Number.isFinite(numericValue)
          ) {
            return {
              type: 'stat_change',
              actorId,
              statDefinitionId: params.statDefinition.id,
              delta: numericValue
            };
          }
          if (params.statDefinition.type === 'boolean') {
            return {
              type: 'stat_change',
              actorId,
              statDefinitionId: params.statDefinition.id,
              delta: params.booleanValue
            };
          }
          return {
            type: 'stat_change',
            actorId,
            statDefinitionId: params.statDefinition.id,
            delta: params.textValue
          };
        case 'stat_set':
          if (!params.statDefinition) return null;
          if (
            params.statDefinition.type === 'number' &&
            Number.isFinite(numericValue)
          ) {
            return {
              type: 'stat_set',
              actorId,
              statDefinitionId: params.statDefinition.id,
              value: numericValue
            };
          }
          if (params.statDefinition.type === 'boolean') {
            return {
              type: 'stat_set',
              actorId,
              statDefinitionId: params.statDefinition.id,
              value: params.booleanValue
            };
          }
          return {
            type: 'stat_set',
            actorId,
            statDefinitionId: params.statDefinition.id,
            value: params.textValue
          };
        case 'status_apply':
        case 'status_remove':
          return statusName
            ? {
                type: params.mutationType,
                actorId,
                statusName
              }
            : null;
        case 'inventory_add':
        case 'inventory_remove':
        case 'inventory_consume':
          return itemName
            ? {
                type: params.mutationType,
                actorId,
                itemName,
                quantity
              }
            : null;
        case 'inventory_equip':
        case 'inventory_unequip':
          return itemName
            ? {
                type: params.mutationType,
                actorId,
                itemName
              }
            : null;
        case 'location_set':
          return locationName
            ? {
                type: 'location_set',
                actorId,
                locationName
              }
            : null;
      }
    },
    []
  );

  const mutationPreview = useMemo(() => {
    if (!selectedMutationSheet || !ruleset) {
      return null;
    }

    const selectedSceneOrder = selectedMutationScene
      ? (sceneOrderById.get(selectedMutationScene.id) ?? Number.MAX_SAFE_INTEGER)
      : undefined;
    const before = replayCharacterState({
      sheet: selectedMutationSheet,
      ruleset,
      events: stateMutationEvents,
      target: {
        actorId: selectedMutationActorId,
        characterId: selectedMutationSheet.characterId,
        sheetId: selectedMutationSheet.id,
        actorName: selectedMutationSheet.name
      },
      upToSceneOrder: selectedSceneOrder
    });
    const command = buildDraftMutationCommand({
      actorId: selectedMutationActorId,
      mutationType,
      statDefinition: selectedMutationStatDefinition,
      resourceDefinition: selectedMutationResourceDefinition,
      numberValue: mutationNumberValue,
      textValue: mutationTextValue,
      booleanValue: mutationBooleanValue,
      statusName: mutationStatusName,
      itemName: mutationItemName,
      quantity: mutationQuantity,
      locationName: mutationLocationName
    });

    if (!command) {
      return {
        before,
        command: null,
        validationIssues: [],
        after: null,
        effectLines: [] as string[]
      };
    }

    const preview = buildStateMutationPreview({
      sheet: selectedMutationSheet,
      ruleset,
      events: stateMutationEvents,
      target: {
        actorId: selectedMutationActorId,
        characterId: selectedMutationSheet.characterId,
        sheetId: selectedMutationSheet.id,
        actorName: selectedMutationSheet.name
      },
      command,
      upToSceneOrder: selectedSceneOrder
    });

    return {
      ...preview,
      command
    };
  }, [
    buildDraftMutationCommand,
    mutationBooleanValue,
    mutationItemName,
    mutationLocationName,
    mutationNumberValue,
    mutationQuantity,
    mutationStatusName,
    mutationTextValue,
    mutationType,
    ruleset,
    sceneOrderById,
    selectedMutationActorId,
    selectedMutationResourceDefinition,
    selectedMutationScene,
    selectedMutationSheet,
    selectedMutationStatDefinition,
    stateMutationEvents
  ]);

  const replayedStateAtSelectedScene = useMemo(() => {
    if (!selectedMutationSheet || !selectedMutationScene || !ruleset) {
      return null;
    }
    const selectedSceneOrder =
      sceneOrderById.get(selectedMutationScene.id) ?? Number.MAX_SAFE_INTEGER;
    return replayCharacterState({
      sheet: selectedMutationSheet,
      ruleset,
      events: stateMutationEvents,
      target: {
        actorId: selectedMutationActorId,
        characterId: selectedMutationSheet.characterId,
        sheetId: selectedMutationSheet.id,
        actorName: selectedMutationSheet.name
      },
      upToSceneOrder: selectedSceneOrder
    });
  }, [
    ruleset,
    sceneOrderById,
    selectedMutationActorId,
    selectedMutationScene,
    selectedMutationSheet,
    stateMutationEvents
  ]);

  const selectedMutationValueSummary = useMemo(() => {
    if (!mutationPreview?.after) {
      return null;
    }
    return mutationPreview.effectLines[0] ?? null;
  }, [mutationPreview]);

  const mutationPreviewIssues = mutationPreview?.validationIssues ?? [];

  const selectedSheetMutationEvents = useMemo(() => {
    if (!selectedMutationSheet) {
      return [];
    }
    const candidateIds = new Set(
      [selectedMutationSheet.id, selectedMutationSheet.characterId].filter(Boolean)
    );
    return stateMutationEvents.filter(
      (event) =>
        event.status !== 'proposed' &&
        event.commands.some((command) => candidateIds.has(command.actorId))
    );
  }, [selectedMutationSheet, stateMutationEvents]);

  const selectedSheetMutationHistory = useMemo(
    () =>
      selectedSheetMutationEvents.map((event) => {
        const sameSceneOrdered = selectedSheetMutationEvents
          .filter(
            (entry) =>
              entry.sceneId === event.sceneId && entry.status !== 'invalidated'
          )
          .sort(
            (a, b) =>
              (a.sceneSequence ?? Number.MAX_SAFE_INTEGER) -
              (b.sceneSequence ?? Number.MAX_SAFE_INTEGER)
          );
        const sceneIndex = sameSceneOrdered.findIndex((entry) => entry.id === event.id);
        const staleness = getStateMutationEventStaleness({
          event,
          documents: orderedDocuments
        });
        return {
          event,
          canMoveUp: sceneIndex > 0,
          canMoveDown:
            sceneIndex !== -1 && sceneIndex < sameSceneOrdered.length - 1,
          staleness,
          stalenessLabel: describeStateMutationEventStaleness(staleness)
        };
      }),
    [orderedDocuments, selectedSheetMutationEvents]
  );

  const resetMutationForm = useCallback(() => {
    setEditingMutationEventId(null);
    setMutationType('resource_change');
    setMutationStatDefinitionId('');
    setMutationResourceDefinitionId('');
    setMutationNumberValue('0');
    setMutationTextValue('');
    setMutationBooleanValue(false);
    setMutationStatusName('');
    setMutationItemName('');
    setMutationQuantity('1');
    setMutationLocationName('');
  }, []);

  const loadMutationEventIntoForm = useCallback(
    (event: StateMutationEvent) => {
      setTaskView('scene-history');
      const command = event.commands[0];
      if (!command) {
        return;
      }
      const matchingSheet =
        sheets.find(
          (sheet) =>
            sheet.id === command.actorId || sheet.characterId === command.actorId
        ) ?? null;
      setEditingMutationEventId(event.id);
      if (matchingSheet) {
        setMutationTargetSheetId(matchingSheet.id);
      }
      setMutationSceneId(event.sceneId);
      switch (command.type) {
        case 'resource_change':
          setMutationType('resource_change');
          setMutationResourceDefinitionId(command.resourceDefinitionId);
          setMutationNumberValue(String(command.delta));
          break;
        case 'resource_set':
          setMutationType('resource_set');
          setMutationResourceDefinitionId(command.resourceDefinitionId);
          setMutationNumberValue(String(command.value));
          break;
        case 'stat_change':
          setMutationType('stat_change');
          setMutationStatDefinitionId(command.statDefinitionId);
          if (typeof command.delta === 'boolean') {
            setMutationBooleanValue(command.delta);
            setMutationTextValue('');
            setMutationNumberValue('0');
          } else if (typeof command.delta === 'number') {
            setMutationNumberValue(String(command.delta));
            setMutationTextValue('');
          } else {
            setMutationTextValue(command.delta);
            setMutationNumberValue('0');
          }
          break;
        case 'stat_set':
          setMutationType('stat_set');
          setMutationStatDefinitionId(command.statDefinitionId);
          if (typeof command.value === 'boolean') {
            setMutationBooleanValue(command.value);
            setMutationTextValue('');
            setMutationNumberValue('0');
          } else if (typeof command.value === 'number') {
            setMutationNumberValue(String(command.value));
            setMutationTextValue('');
          } else {
            setMutationTextValue(command.value);
            setMutationNumberValue('0');
          }
          break;
        case 'status_apply':
        case 'status_remove':
          setMutationType(command.type);
          setMutationStatusName(command.statusName);
          break;
        case 'inventory_add':
        case 'inventory_remove':
        case 'inventory_consume':
          setMutationType(command.type);
          setMutationItemName(command.itemName);
          setMutationQuantity(String(command.quantity ?? 1));
          break;
        case 'inventory_equip':
        case 'inventory_unequip':
          setMutationType(command.type);
          setMutationItemName(command.itemName);
          break;
        case 'location_set':
          setMutationType('location_set');
          setMutationLocationName(command.locationName);
          break;
      }
    },
    [sheets]
  );

  const handleSaveMutation = useCallback(async () => {
    if (!activeProject || !selectedMutationSheet || !selectedMutationScene) {
      setFeedback({
        tone: 'error',
        message: 'Choose a character sheet and source scene first.'
      });
      return;
    }

    const command = buildDraftMutationCommand({
      actorId: selectedMutationActorId,
      mutationType,
      statDefinition: selectedMutationStatDefinition,
      resourceDefinition: selectedMutationResourceDefinition,
      numberValue: mutationNumberValue,
      textValue: mutationTextValue,
      booleanValue: mutationBooleanValue,
      statusName: mutationStatusName,
      itemName: mutationItemName,
      quantity: mutationQuantity,
      locationName: mutationLocationName
    });

    if (!command) {
      setFeedback({
        tone: 'error',
        message: 'Complete the mutation fields before saving.'
      });
      return;
    }

    const existingMutationEvent = editingMutationEventId
      ? stateMutationEvents.find((entry) => entry.id === editingMutationEventId) ?? null
      : null;

    const event: StateMutationEvent = {
      id: existingMutationEvent?.id ?? crypto.randomUUID(),
      projectId: activeProject.id,
      sceneId: selectedMutationScene.id,
      sceneTitle: selectedMutationScene.title,
      sceneOrder:
        sceneOrderById.get(selectedMutationScene.id) ?? orderedDocuments.length + 1,
      sceneSequence:
        existingMutationEvent?.sceneSequence ??
        stateMutationEvents
          .filter((entry) => entry.sceneId === selectedMutationScene.id)
          .reduce((max, entry) => Math.max(max, entry.sceneSequence ?? 0), 0) + 1,
      sourceType: existingMutationEvent?.sourceType ?? 'manual',
      sourceRevision: selectedMutationScene.updatedAt,
      sourceHash: hashString(selectedMutationScene.content),
      status: 'accepted',
      commands: [command],
      createdAt: existingMutationEvent?.createdAt ?? Date.now()
    };

    setIsSavingMutation(true);
    setFeedback(null);
    try {
      validateStateMutationEvent(event);
      const validationErrors = validateStateMutationEventForRuleset({
        event,
        ruleset
      });
      const stateValidationErrors = validateStateMutationCommandAgainstState({
        state: mutationPreview?.before ?? replayCharacterState({
          sheet: selectedMutationSheet,
          ruleset,
          events: stateMutationEvents,
          target: {
            actorId: selectedMutationActorId,
            characterId: selectedMutationSheet.characterId,
            sheetId: selectedMutationSheet.id,
            actorName: selectedMutationSheet.name
          },
          upToSceneOrder:
            sceneOrderById.get(selectedMutationScene.id) ?? Number.MAX_SAFE_INTEGER
        }),
        command
      });
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(' '));
      }
      if (stateValidationErrors.length > 0) {
        throw new Error(stateValidationErrors.join(' '));
      }
      await saveStateMutationEvent(event);
      setStateMutationEvents((prev) => {
        const existingIndex = prev.findIndex((entry) => entry.id === event.id);
        if (existingIndex === -1) {
          return [...prev, event];
        }
        return prev.map((entry) => (entry.id === event.id ? event : entry));
      });
      resetMutationForm();
      setFeedback({
        tone: 'success',
        message: editingMutationEventId
          ? `State change updated for "${selectedMutationScene.title}".`
          : `State change recorded for "${selectedMutationScene.title}".`
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to record state change.'
      });
    } finally {
      setIsSavingMutation(false);
    }
  }, [
    activeProject,
    buildDraftMutationCommand,
    mutationBooleanValue,
    editingMutationEventId,
    mutationItemName,
    mutationLocationName,
    mutationNumberValue,
    mutationQuantity,
    mutationStatusName,
    mutationTextValue,
    mutationType,
    orderedDocuments.length,
    resetMutationForm,
    ruleset,
    sceneOrderById,
    selectedMutationActorId,
    selectedMutationResourceDefinition,
    selectedMutationScene,
    selectedMutationSheet,
    selectedMutationStatDefinition,
    stateMutationEvents,
    mutationPreview
  ]);

  const handleInvalidateMutationEvent = useCallback(
    async (event: StateMutationEvent) => {
      setInvalidatingMutationEventId(event.id);
      setFeedback(null);
      try {
        const updated = await invalidateStateMutationEventById({
          eventId: event.id,
          reason: 'Invalidated from Character Sheets history.'
        });
        if (!updated) {
          throw new Error('Mutation event not found.');
        }
        setStateMutationEvents((prev) =>
          prev.map((entry) => (entry.id === updated.id ? updated : entry))
        );
        setFeedback({
          tone: 'success',
          message: `Invalidated state change from "${event.sceneTitle || 'scene'}".`
        });
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to invalidate state change.'
        });
      } finally {
        setInvalidatingMutationEventId(null);
      }
    },
    []
  );

  const handleMoveMutationEvent = useCallback(
    async (event: StateMutationEvent, direction: -1 | 1) => {
      const sceneEvents = selectedSheetMutationHistory
        .map((entry) => entry.event)
        .filter(
          (entry) =>
            entry.sceneId === event.sceneId && entry.status !== 'invalidated'
        )
        .sort(
          (a, b) =>
            (a.sceneSequence ?? Number.MAX_SAFE_INTEGER) -
            (b.sceneSequence ?? Number.MAX_SAFE_INTEGER)
        );
      const index = sceneEvents.findIndex((entry) => entry.id === event.id);
      const swapIndex = index + direction;
      if (index === -1 || swapIndex < 0 || swapIndex >= sceneEvents.length) {
        return;
      }
      const current = sceneEvents[index];
      const adjacent = sceneEvents[swapIndex];
      const currentSequence = current.sceneSequence ?? index + 1;
      const adjacentSequence = adjacent.sceneSequence ?? swapIndex + 1;

      setReorderingMutationEventId(event.id);
      setFeedback(null);
      try {
        const updatedCurrent: StateMutationEvent = {
          ...current,
          sceneSequence: adjacentSequence
        };
        const updatedAdjacent: StateMutationEvent = {
          ...adjacent,
          sceneSequence: currentSequence
        };
        await saveStateMutationEvent(updatedCurrent);
        await saveStateMutationEvent(updatedAdjacent);
        setStateMutationEvents((prev) =>
          prev.map((entry) => {
            if (entry.id === updatedCurrent.id) return updatedCurrent;
            if (entry.id === updatedAdjacent.id) return updatedAdjacent;
            return entry;
          })
        );
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to reorder state change.'
        });
      } finally {
        setReorderingMutationEventId(null);
      }
    },
    [selectedSheetMutationHistory]
  );

  const handlePromoteRuleset = useCallback(async () => {
    if (!ruleset || !activeProject?.parentProjectId) return;
    const ruleText = ruleset.rules
      .map((rule) => `${rule.name}: ${rule.description || ''}`)
      .join('\n');
    await promoteDocumentToParent({
      parentProjectId: activeProject.parentProjectId,
      documentId: ruleset.id,
      title: ruleset.name || 'Ruleset',
      content: `${ruleset.description ?? ''}\n${ruleText}`,
      type: 'rule',
      tags: ['ruleset']
    });
  }, [ruleset, activeProject?.parentProjectId]);

  if (!activeProject) {
    return (
      <p>
        Go to <strong>Projects</strong> to create or open a project first.
      </p>
    );
  }

  if (!ruleset) {
    return (
      <div>
        {!embedded && <h1>Character Sheets</h1>}
        {capabilities.canUseRuleAuthoring ? (
          <>
            <p>
              This project doesn't have a ruleset yet. Character sheets require a
              ruleset to define stats and resources.
            </p>
            <p>
              Without a ruleset, you will not see base stats like Strength or
              dynamic resources like Mana.
            </p>
            <button type='button' onClick={() => navigate('/ruleset')}>
              Open Ruleset
            </button>
          </>
        ) : (
          <p>
            Character sheets are disabled for this project mode. Use the roster
            for story-facing character profiles.
          </p>
        )}
      </div>
    );
  }

  const content = (
    <>
      {!embedded && <h1>Character Sheets</h1>}
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

      {ruleset && (
        <details className={styles.rulesReference}>
          <summary>Ruleset reference and memory</summary>
          <ShodhMemoryPanel
          title={`${ruleset.name || 'World ruleset'} summary`}
          memories={rulesetMemory ? [rulesetMemory] : []}
          filterValue={rulesetMemoryFilter}
          onFilterChange={setRulesetMemoryFilter}
          highlightDocumentId={ruleset.id}
          onRefresh={() => void refreshRulesetMemory()}
          pageSize={1}
          scopeSummaryLabel='this ruleset'
          emptyState='No Shodh memory found yet. Save the ruleset (Ruleset tab) to generate one.'
          renderSourceLabel={(memory) =>
            memory.projectId === activeProject.id ? 'Local' : 'Parent'
          }
          renderMemoryActions={(memory) => {
            if (
              activeProject.parentProjectId &&
              memory.projectId === activeProject.id
            ) {
              return (
                <button
                  type='button'
                  onClick={() => {
                    const parentId = activeProject.parentProjectId;
                    if (!parentId) return;
                    void promoteMemoryToParent(memory, parentId).then(() =>
                      refreshRulesetMemory()
                    );
                  }}
                  style={{fontSize: '0.8rem'}}
                >
                  Promote
                </button>
              );
            }
            return null;
          }}
          />
        </details>
      )}
      {ruleset && activeProject?.parentProjectId && (
        <button
          type='button'
          style={{marginBottom: '1rem'}}
          onClick={() => void handlePromoteRuleset()}
        >
          Promote ruleset to parent
        </button>
      )}

      <div className={styles.taskSwitch} aria-label='Character sheet task'>
        <button
          type='button'
          onClick={() => setTaskView('setup')}
          className={taskView === 'setup' ? styles.taskSwitchActive : ''}
        >
          Build character sheet
        </button>
        <button
          type='button'
          onClick={() => setTaskView('scene-history')}
          className={taskView === 'scene-history' ? styles.taskSwitchActive : ''}
        >
          Record scene changes
        </button>
      </div>
      <p className={styles.taskHint}>
        {taskView === 'setup'
          ? 'Set the character’s baseline level, attributes, resources, and optional equipment.'
          : 'Advanced: record an accepted change that occurs during a specific manuscript scene.'}
      </p>

      <div className={styles.workspace}>
        {/* Character Sheet Editor */}
        <form
          onSubmit={handleSubmit}
          className={styles.sheetForm}
          style={{display: taskView === 'setup' ? 'block' : 'none'}}
        >
          <h2>{editingId ? 'Edit Character Sheet' : 'New Character Sheet'}</h2>
          <div
            style={{
              marginBottom: '0.85rem',
              padding: '0.75rem',
              border: '1px solid var(--color-accent-soft-bg)',
              borderRadius: '8px',
              backgroundColor: 'var(--color-bg-secondary)',
              fontSize: '0.86rem',
              color: 'var(--color-text-primary)'
            }}
          >
            This is the main place to track level, stats, resources like mana,
            inventory, equipment, and statuses for a character.
          </div>

          <div style={{marginBottom: '0.75rem'}}>
            <label>
              Name *
              <br />
              <input
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{width: '100%'}}
              />
            </label>
          </div>

          <div style={{marginBottom: '0.75rem'}}>
            <label>
              Link to Character
              <br />
              <select
                value={selectedCharacterId}
                onChange={(e) => handleCharacterSelect(e.target.value)}
                style={{width: '100%'}}
              >
                <option value=''>-- None (create new) --</option>
                {characters.map((char) => (
                  <option key={char.id} value={char.id}>
                    {char.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem'}}>
              Link a roster character first, then adjust the sheet-specific stats
              and resources here.
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              marginBottom: '0.75rem'
            }}
          >
            <label>
              Level *
              <br />
              <input
                type='number'
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                min={1}
                required
                style={{width: '100%'}}
              />
            </label>

            <label>
              Experience *
              <br />
              <input
                type='number'
                value={experience}
                onChange={(e) => setExperience(Number(e.target.value))}
                min={0}
                required
                style={{width: '100%'}}
              />
            </label>
          </div>

          <div
            style={{
              marginBottom: '0.9rem',
              padding: '0.6rem 0.75rem',
              border: '1px solid var(--color-accent-soft-bg)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg-secondary)',
              fontSize: '0.85rem'
            }}
          >
            <strong>Runtime Effects (Preview)</strong>
            <div style={{marginTop: '0.25rem'}}>
              Effective level: {effectiveLevel}
              {runtimeModifiers.levelBonus > 0
                ? ` (base ${level} + ${runtimeModifiers.levelBonus})`
                : ` (base ${level})`}
            </div>
            {runtimeModifiers.notes.length > 0 && (
              <div style={{marginTop: '0.25rem', color: 'var(--color-text-secondary)'}}>
                {runtimeModifiers.notes.join(' ')}
              </div>
            )}
          </div>

          {/* Stats */}
          {stats.length > 0 ? (
            <div style={{marginBottom: '1rem'}}>
              <h3>Attributes</h3>
              <p className={styles.sectionHint}>
                Starting values from {ruleset.name || 'the active ruleset'}. Adjust them
                for this character before saving.
              </p>
              <div className={styles.statEditorGrid}>
              {stats.map((stat) => {
                const def = getStatDefinition(stat.definitionId);
                if (!def) return null;
                const effectiveValue = getEffectiveStatValue({
                  definitionId: stat.definitionId,
                  baseValue: stat.value,
                  runtime: runtimeModifiers
                });
                return (
                  <div key={stat.definitionId} className={styles.statEditorCard}>
                    <label>
                      {def.name}
                      {def.description && (
                        <span
                          style={{
                            fontSize: '0.85em',
                            color: 'var(--color-text-tertiary)',
                            marginLeft: '0.5rem'
                          }}
                        >
                          ({def.description})
                        </span>
                      )}
                      <br />
                      <input
                        type='number'
                        value={stat.value}
                        onChange={(e) =>
                          updateStatValue(
                            stat.definitionId,
                            Number(e.target.value)
                          )
                        }
                        min={def.min}
                        max={def.max}
                        style={{width: '100%'}}
                      />
                    </label>
                    <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                      Effective: {effectiveValue}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          ) : (
            <div style={{marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
              No stat definitions are available in this ruleset yet.
            </div>
          )}

          {/* Resources */}
          {resources.length > 0 ? (
            <div style={{marginBottom: '1rem'}}>
              <h3>Resources</h3>
              <p className={styles.sectionHint}>
                Set the character’s starting and maximum values.
              </p>
              {resources.map((resource) => {
                const def = getResourceDefinition(resource.definitionId);
                if (!def) return null;
                const effective = getEffectiveResourceValues({
                  definitionId: resource.definitionId,
                  current: resource.current,
                  max: resource.max,
                  runtime: runtimeModifiers
                });
                return (
                  <div
                    key={resource.definitionId}
                    style={{marginBottom: '0.75rem'}}
                  >
                    <label>
                      {def.name}
                      {def.description && (
                        <span
                          style={{
                            fontSize: '0.85em',
                            color: 'var(--color-text-tertiary)',
                            marginLeft: '0.5rem'
                          }}
                        >
                          ({def.description})
                        </span>
                      )}
                    </label>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.5rem'
                      }}
                    >
                      <label>
                        Current
                        <br />
                        <input
                          type='number'
                          value={resource.current}
                          onChange={(e) =>
                            updateResourceCurrent(
                              resource.definitionId,
                              Number(e.target.value)
                            )
                          }
                          min={0}
                          style={{width: '100%'}}
                        />
                      </label>
                      <label>
                        Max
                        <br />
                        <input
                          type='number'
                          value={resource.max}
                          onChange={(e) =>
                            updateResourceMax(
                              resource.definitionId,
                              Number(e.target.value)
                            )
                          }
                          min={0}
                          style={{width: '100%'}}
                        />
                      </label>
                    </div>
                    <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                      Effective: {effective.current}/{effective.max}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
              No resource definitions are available yet. Add things like Mana,
              Stamina, or Health in the ruleset to track them here.
            </div>
          )}

          <details className={styles.optionalState}>
            <summary>Inventory, equipment & statuses</summary>
            <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
              Optional starting state. Type a simple entry, or choose a catalog record
              when it should stay linked to Mechanics.
            </p>

            <div style={{marginBottom: '0.8rem'}}>
              <strong style={{display: 'block', marginBottom: '0.35rem'}}>
                Inventory
              </strong>
              <div style={{display: 'flex', gap: '0.4rem', marginBottom: '0.35rem'}}>
                <input
                  type='text'
                  value={quickInventoryName}
                  onChange={(e) => setQuickInventoryName(e.target.value)}
                  placeholder='Quick add item'
                  style={{flex: 1}}
                />
                <input
                  type='number'
                  min={1}
                  value={quickInventoryQty}
                  onChange={(e) => setQuickInventoryQty(Math.max(1, Number(e.target.value) || 1))}
                  style={{width: '5rem'}}
                />
                <button
                  type='button'
                  onClick={() =>
                    appendQuickEntry('inventory', quickInventoryName, quickInventoryQty)
                  }
                >
                  Add item
                </button>
              </div>
              <div style={{display: 'flex', gap: '0.4rem', marginBottom: '0.35rem'}}>
                <select
                  value={catalogInventoryId}
                  onChange={(e) => setCatalogInventoryId(e.target.value)}
                  style={{flex: 1}}
                >
                  <option value=''>Add from Mechanics...</option>
                  {compendiumEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
                <button
                  type='button'
                  onClick={() => appendCatalogEntry('inventory', catalogInventoryId)}
                >
                  Add catalog item
                </button>
              </div>
              {inventoryEntries.length > 0 && (
                <ul style={{margin: 0, paddingLeft: '1rem'}}>
                  {inventoryEntries.map((entry) => (
                    <li key={entry.id}>
                      {entry.name}
                      {entry.quantity && entry.quantity > 1 ? ` x${entry.quantity}` : ''}
                      {entry.mode === 'cataloged' ? ' (catalog)' : ''}
                      <button
                        type='button'
                        onClick={() => removeTrackedEntry('inventory', entry.id)}
                        style={{marginLeft: '0.45rem', fontSize: '0.75rem'}}
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{marginBottom: '0.8rem'}}>
              <strong style={{display: 'block', marginBottom: '0.35rem'}}>
                Equipment
              </strong>
              <div style={{display: 'flex', gap: '0.4rem', marginBottom: '0.35rem'}}>
                <input
                  type='text'
                  value={quickEquipmentName}
                  onChange={(e) => setQuickEquipmentName(e.target.value)}
                  placeholder='Quick add equipment'
                  style={{flex: 1}}
                />
                <button
                  type='button'
                  onClick={() => appendQuickEntry('equipment', quickEquipmentName)}
                >
                  Add equipment
                </button>
              </div>
              <div style={{display: 'flex', gap: '0.4rem', marginBottom: '0.35rem'}}>
                <select
                  value={catalogEquipmentId}
                  onChange={(e) => setCatalogEquipmentId(e.target.value)}
                  style={{flex: 1}}
                >
                  <option value=''>Add from Mechanics...</option>
                  {compendiumEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
                <button
                  type='button'
                  onClick={() => appendCatalogEntry('equipment', catalogEquipmentId)}
                >
                  Add catalog equipment
                </button>
              </div>
              {equipmentEntries.length > 0 && (
                <ul style={{margin: 0, paddingLeft: '1rem'}}>
                  {equipmentEntries.map((entry) => (
                    <li key={entry.id}>
                      {entry.name}
                      {entry.mode === 'cataloged' ? ' (catalog)' : ''}
                      <button
                        type='button'
                        onClick={() => removeTrackedEntry('equipment', entry.id)}
                        style={{marginLeft: '0.45rem', fontSize: '0.75rem'}}
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <strong style={{display: 'block', marginBottom: '0.35rem'}}>
                Statuses
              </strong>
              <div style={{display: 'flex', gap: '0.4rem', marginBottom: '0.35rem'}}>
                <input
                  type='text'
                  value={quickStatusName}
                  onChange={(e) => setQuickStatusName(e.target.value)}
                  placeholder='Quick add status'
                  style={{flex: 1}}
                />
                <button
                  type='button'
                  onClick={() => appendQuickEntry('status', quickStatusName)}
                >
                  Add status
                </button>
              </div>
              <div style={{display: 'flex', gap: '0.4rem', marginBottom: '0.35rem'}}>
                <select
                  value={catalogStatusId}
                  onChange={(e) => setCatalogStatusId(e.target.value)}
                  style={{flex: 1}}
                >
                  <option value=''>Add status from Mechanics...</option>
                  {statusCatalogOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
                <button
                  type='button'
                  onClick={() => appendCatalogEntry('status', catalogStatusId)}
                >
                  Add catalog status
                </button>
              </div>
              {statusEntries.length > 0 && (
                <ul style={{margin: 0, paddingLeft: '1rem'}}>
                  {statusEntries.map((entry) => (
                    <li key={entry.id}>
                      {entry.name}
                      {entry.mode === 'cataloged' ? ' (catalog)' : ''}
                      <button
                        type='button'
                        onClick={() => removeTrackedEntry('status', entry.id)}
                        style={{marginLeft: '0.45rem', fontSize: '0.75rem'}}
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>

          <div style={{marginBottom: '0.75rem'}}>
            <label>
              Notes
              <br />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                style={{width: '100%'}}
              />
            </label>
          </div>

          <div style={{display: 'flex', gap: '0.5rem'}}>
            <button type='submit' disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving...'
                : editingId
                  ? 'Save Changes'
                  : 'Create Character Sheet'}
            </button>
            {editingId && (
              <button type='button' onClick={resetForm} disabled={isSubmitting}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <section
          className={styles.historyPanel}
          style={{
            display: taskView === 'scene-history' ? 'block' : 'none'
          }}
        >
          <MutationForm
            editingMutationEventId={editingMutationEventId}
            mutationTargetSheetId={mutationTargetSheetId}
            setMutationTargetSheetId={setMutationTargetSheetId}
            sheets={sheets}
            mutationSceneId={mutationSceneId}
            setMutationSceneId={setMutationSceneId}
            orderedDocuments={orderedDocuments}
            mutationType={mutationType}
            setMutationType={setMutationType}
            mutationResourceDefinitionId={mutationResourceDefinitionId}
            setMutationResourceDefinitionId={setMutationResourceDefinitionId}
            mutationStatDefinitionId={mutationStatDefinitionId}
            setMutationStatDefinitionId={setMutationStatDefinitionId}
            mutationNumberValue={mutationNumberValue}
            setMutationNumberValue={setMutationNumberValue}
            mutationTextValue={mutationTextValue}
            setMutationTextValue={setMutationTextValue}
            mutationBooleanValue={mutationBooleanValue}
            setMutationBooleanValue={setMutationBooleanValue}
            mutationStatusName={mutationStatusName}
            setMutationStatusName={setMutationStatusName}
            mutationItemName={mutationItemName}
            setMutationItemName={setMutationItemName}
            mutationQuantity={mutationQuantity}
            setMutationQuantity={setMutationQuantity}
            mutationLocationName={mutationLocationName}
            setMutationLocationName={setMutationLocationName}
            ruleset={ruleset}
            selectedMutationStatDefinition={selectedMutationStatDefinition}
          />
          <div
            style={{
              marginBottom: '0.9rem',
              padding: '0.75rem',
              borderRadius: '8px',
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              fontSize: '0.9rem'
            }}
          >
            <strong>Preview</strong>
            <div style={{marginTop: '0.35rem', color: 'var(--color-text-secondary)'}}>
              {selectedMutationValueSummary ||
                'Select a sheet, scene, and change details to preview the mutation.'}
            </div>
            {selectedMutationScene && (
              <div
                style={{
                  marginTop: '0.35rem',
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.82rem'
                }}
              >
                Scene revision source: {selectedMutationScene.updatedAt} · hash{' '}
                {hashString(selectedMutationScene.content)}
              </div>
            )}
          </div>

          {mutationPreviewIssues.length > 0 && (
            <div
              role='alert'
              style={{
                marginBottom: '0.9rem',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--color-error-soft-border)',
                backgroundColor: 'var(--color-error-soft-bg)',
                color: 'var(--color-error)',
                fontSize: '0.9rem'
              }}
            >
              <strong>Mutation warning</strong>
              <ul style={{margin: '0.5rem 0 0 1rem', padding: 0}}>
                {mutationPreviewIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          <div
            style={{
              marginBottom: '0.9rem',
              padding: '0.75rem',
              borderRadius: '8px',
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              fontSize: '0.9rem'
            }}
          >
            <strong>State At Selected Scene</strong>
            {!replayedStateAtSelectedScene ? (
              <div style={{marginTop: '0.35rem', color: 'var(--color-text-secondary)'}}>
                Select a sheet and scene to inspect the replayed state timeline.
              </div>
            ) : (
              <>
                <div style={{marginTop: '0.4rem'}}>
                  <strong>Stats:</strong>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '0.25rem',
                      marginTop: '0.25rem'
                    }}
                  >
                    {Object.entries(replayedStateAtSelectedScene.stats).map(
                      ([key, value]) => (
                        <span key={key}>
                          {key}: {String(value)}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div style={{marginTop: '0.6rem'}}>
                  <strong>Resources:</strong>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '0.25rem',
                      marginTop: '0.25rem'
                    }}
                  >
                    {Object.entries(replayedStateAtSelectedScene.resources.current).map(
                      ([key, current]) => (
                        <span key={key}>
                          {key}: {current}/
                          {replayedStateAtSelectedScene.resources.max[key] ?? current}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div style={{marginTop: '0.6rem'}}>
                  <strong>Statuses:</strong>{' '}
                  {replayedStateAtSelectedScene.statuses.join(', ') || 'none'}
                </div>

                <div style={{marginTop: '0.6rem'}}>
                  <strong>Inventory:</strong>{' '}
                  {replayedStateAtSelectedScene.inventory.items.length > 0
                    ? replayedStateAtSelectedScene.inventory.items
                        .map((item) =>
                          item.quantity > 1
                            ? `${item.name} x${item.quantity}`
                            : item.name
                        )
                        .join(', ')
                    : 'none'}
                </div>

                <div style={{marginTop: '0.6rem'}}>
                  <strong>Equipped:</strong>{' '}
                  {replayedStateAtSelectedScene.inventory.equipped.join(', ') ||
                    'none'}
                </div>

                <div style={{marginTop: '0.6rem'}}>
                  <strong>Location:</strong>{' '}
                  {replayedStateAtSelectedScene.locationName || 'unset'}
                </div>
              </>
            )}
          </div>

          <div style={{display: 'flex', gap: '0.75rem'}}>
            <button
              type='button'
              onClick={() => void handleSaveMutation()}
              disabled={
                isSavingMutation || !mutationTargetSheetId || !mutationSceneId
              }
            >
              {isSavingMutation
                ? 'Saving…'
                : editingMutationEventId
                  ? 'Update State Change'
                  : 'Record State Change'}
            </button>
            <button type='button' onClick={() => resetMutationForm()}>
              {editingMutationEventId ? 'Cancel Edit' : 'Reset Change'}
            </button>
          </div>

          <div style={{marginTop: '1rem'}}>
            <h3 style={{marginBottom: '0.5rem'}}>Recorded State History</h3>
            {!mutationTargetSheetId ? (
              <p style={{fontSize: '0.9rem', color: 'var(--color-text-secondary)'}}>
                Select a character sheet to inspect its recorded mutation history.
              </p>
            ) : selectedSheetMutationHistory.length === 0 ? (
              <p style={{fontSize: '0.9rem', color: 'var(--color-text-secondary)'}}>
                No recorded state changes yet for this character sheet.
              </p>
            ) : (
              <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                {selectedSheetMutationHistory.map(
                  ({event, canMoveUp, canMoveDown, staleness, stalenessLabel}) => (
                  <li
                    key={event.id}
                    style={{
                      marginBottom: '0.75rem',
                      padding: '0.75rem',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      backgroundColor:
                        event.status === 'invalidated' ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        alignItems: 'flex-start'
                      }}
                    >
                      <div style={{flex: 1}}>
                        <div style={{fontSize: '0.92rem', fontWeight: 600}}>
                          {event.sceneOrder ? `${event.sceneOrder}. ` : ''}
                          {event.sceneTitle || 'Untitled scene'}
                          {event.sceneSequence ? ` · Step ${event.sceneSequence}` : ''}
                        </div>
                        <div
                          style={{
                            marginTop: '0.25rem',
                            fontSize: '0.82rem',
                            color: 'var(--color-text-secondary)'
                          }}
                        >
                          Status: {event.status}
                          {event.invalidationReason
                            ? ` · ${event.invalidationReason}`
                            : ''}
                        </div>
                        {stalenessLabel && event.status !== 'invalidated' && (
                          <div
                            style={{
                              marginTop: '0.3rem',
                              display: 'inline-block',
                              fontSize: '0.78rem',
                              color: 'var(--color-warning)',
                              backgroundColor: 'var(--color-warning-soft-bg)',
                              border: '1px solid var(--color-warning-soft-border)',
                              borderRadius: '999px',
                              padding: '0.1rem 0.45rem'
                            }}
                          >
                            Stale: {stalenessLabel}
                          </div>
                        )}
                        <ul
                          style={{
                            margin: '0.5rem 0 0 0',
                            paddingLeft: '1rem',
                            fontSize: '0.9rem'
                          }}
                        >
                          {event.commands.map((command, index) => (
                            <li key={`${event.id}-${index}`}>
                              {summarizeMutationCommand(command)}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <button
                          type='button'
                          onClick={() => loadMutationEventIntoForm(event)}
                          style={{fontSize: '0.8rem', marginRight: '0.35rem'}}
                          disabled={event.status === 'invalidated'}
                        >
                          Edit
                        </button>
                        <button
                          type='button'
                          onClick={() => void handleMoveMutationEvent(event, -1)}
                          style={{fontSize: '0.8rem', marginRight: '0.35rem'}}
                          disabled={
                            !canMoveUp ||
                            event.status === 'invalidated' ||
                            reorderingMutationEventId === event.id
                          }
                        >
                          Up
                        </button>
                        <button
                          type='button'
                          onClick={() => void handleMoveMutationEvent(event, 1)}
                          style={{fontSize: '0.8rem', marginRight: '0.35rem'}}
                          disabled={
                            !canMoveDown ||
                            event.status === 'invalidated' ||
                            reorderingMutationEventId === event.id
                          }
                        >
                          Down
                        </button>
                        <button
                          type='button'
                          onClick={() => void handleInvalidateMutationEvent(event)}
                          disabled={
                            event.status === 'invalidated' ||
                            invalidatingMutationEventId === event.id
                          }
                          style={{fontSize: '0.8rem'}}
                        >
                          {invalidatingMutationEventId === event.id
                            ? 'Invalidating...'
                            : event.status === 'invalidated'
                              ? 'Invalidated'
                              : staleness.isStale
                                ? 'Invalidate stale'
                                : 'Invalidate'}
                        </button>
                      </div>
                    </div>
                  </li>
                )
                )}
              </ul>
            )}
          </div>
        </section>

        {/* Character Sheet List */}
        <CharacterSheetList
          taskView={taskView}
          sheets={sheets}
          ruleset={ruleset}
          runtimeModifiers={runtimeModifiers}
          deletingSheetId={deletingSheetId}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </>
  );

  return embedded ? <>{content}</> : <section>{content}</section>;
}

export default CharacterSheetsRoute;
