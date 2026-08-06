import {useEffect, useState, useCallback, useMemo} from 'react';
import type {FormEvent} from 'react';
import {useNavigate} from 'react-router';
import type {
  Character,
  CharacterSheet,
  CharacterTrackedEntry,
  CompendiumEntry,
  CharacterStat,
  CharacterResource,
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
import {getDocumentsByProject} from '../writingStorage';
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
import {validateStateMutationEvent} from '../services/state/stateMutationSchemas';

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
  MutationForm
} from '../components/CharacterSheets/MutationForm';
import {CharacterSheetList} from '../components/CharacterSheets/CharacterSheetList';
import styles from '../styles/CharacterSheetsRoute.module.css';
import {useConfirmDialog} from '../hooks/useConfirmDialog';
import {useCharacterSheetMutationPreview} from '../hooks/useCharacterSheetMutationPreview';

interface CharacterSheetsRouteProps {
  embedded?: boolean;
  prefillCharacterId?: string | null;
  onPrefillConsumed?: () => void;
  autoCreateSheetCharacterId?: string | null;
  onAutoCreateConsumed?: () => void;
}

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
  const {requestConfirm, confirmDialog} = useConfirmDialog();
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
  const {
    mutationTargetSheetId, setMutationTargetSheetId,
    mutationSceneId, setMutationSceneId, mutationType, setMutationType,
    mutationStatDefinitionId, setMutationStatDefinitionId,
    mutationResourceDefinitionId, setMutationResourceDefinitionId,
    mutationNumberValue, setMutationNumberValue, mutationTextValue, setMutationTextValue,
    mutationBooleanValue, setMutationBooleanValue, mutationStatusName, setMutationStatusName,
    mutationItemName, setMutationItemName, mutationQuantity, setMutationQuantity,
    mutationLocationName, setMutationLocationName, isSavingMutation, setIsSavingMutation,
    invalidatingMutationEventId, setInvalidatingMutationEventId,
    editingMutationEventId, setEditingMutationEventId,
    reorderingMutationEventId, setReorderingMutationEventId,
    orderedDocuments, sceneOrderById, selectedMutationSheet, selectedMutationScene,
    selectedMutationStatDefinition, selectedMutationResourceDefinition,
    selectedMutationActorId, buildDraftMutationCommand, mutationPreview,
    replayedStateAtSelectedScene, selectedMutationValueSummary, mutationPreviewIssues,
    selectedSheetMutationHistory
  } = useCharacterSheetMutationPreview({
    sheets, ruleset, documents, stateMutationEvents
  });

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
        const shodh = await getShodhService(shodhOptions);
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
      setFeedback({tone: 'error', message: 'Select or create a project first.'});
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

  const handleDelete = (id: string) => {
    requestConfirm({
      title: 'Delete this character sheet?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
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
      }
    });
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
  }, [
    setEditingMutationEventId, setMutationBooleanValue, setMutationItemName,
    setMutationLocationName, setMutationNumberValue, setMutationQuantity,
    setMutationResourceDefinitionId, setMutationStatDefinitionId,
    setMutationStatusName, setMutationTextValue, setMutationType
  ]);

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
    [
      sheets, setEditingMutationEventId, setMutationBooleanValue,
      setMutationItemName, setMutationLocationName, setMutationNumberValue,
      setMutationQuantity, setMutationResourceDefinitionId, setMutationSceneId,
      setMutationStatDefinitionId, setMutationStatusName,
      setMutationTargetSheetId, setMutationTextValue, setMutationType
    ]
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
    mutationPreview,
    setIsSavingMutation
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
    [setInvalidatingMutationEventId]
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
    [selectedSheetMutationHistory, setReorderingMutationEventId]
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
          className={`${styles.feedback} ${
            feedback.tone === 'error'
              ? styles.feedbackError
              : styles.feedbackSuccess
          }`}
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
                  className={styles.inlineFontSize08rem}
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
          className={styles.inlineMarginBottom1rem}
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
          className={`${styles.sheetForm} ${
            taskView === 'setup' ? '' : styles.hidden
          }`}
        >
          <h2>{editingId ? 'Edit Character Sheet' : 'New Character Sheet'}</h2>
          <div
            className={`${styles.inlineMarginBottom085rem} ${styles.inlinePadding075rem} ${styles.inlineBorder1pxSolidVarColorAccentSoftBg} ${styles.inlineBorderRadius8px} ${styles.inlineBackgroundColorVarColorBgSecondary} ${styles.inlineFontSize086rem} ${styles.inlineColorVarColorTextPrimary}`}
          >
            This is the main place to track level, stats, resources like mana,
            inventory, equipment, and statuses for a character.
          </div>

          <div className={styles.inlineMarginBottom075rem}>
            <label>
              Name *
              <br />
              <input
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={styles.inlineWidth100}
              />
            </label>
          </div>

          <div className={styles.inlineMarginBottom075rem}>
            <label>
              Link to Character
              <br />
              <select
                value={selectedCharacterId}
                onChange={(e) => handleCharacterSelect(e.target.value)}
                className={styles.inlineWidth100}
              >
                <option value=''>-- None (create new) --</option>
                {characters.map((char) => (
                  <option key={char.id} value={char.id}>
                    {char.name}
                  </option>
                ))}
              </select>
            </label>
            <div className={`${styles.inlineFontSize08rem} ${styles.inlineColorVarColorTextSecondary} ${styles.inlineMarginTop025rem}`}>
              Link a roster character first, then adjust the sheet-specific stats
              and resources here.
            </div>
          </div>

          <div
            className={`${styles.inlineDisplayGrid} ${styles.inlineGridTemplateColumns1fr1fr} ${styles.inlineGap075rem} ${styles.inlineMarginBottom075rem}`}
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
                className={styles.inlineWidth100}
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
                className={styles.inlineWidth100}
              />
            </label>
          </div>

          <div
            className={`${styles.inlineMarginBottom09rem} ${styles.inlinePadding06rem075rem} ${styles.inlineBorder1pxSolidVarColorAccentSoftBg} ${styles.inlineBorderRadius6px} ${styles.inlineBackgroundColorVarColorBgSecondary} ${styles.inlineFontSize085rem}`}
          >
            <strong>Runtime Effects (Preview)</strong>
            <div className={styles.inlineMarginTop025rem}>
              Effective level: {effectiveLevel}
              {runtimeModifiers.levelBonus > 0
                ? ` (base ${level} + ${runtimeModifiers.levelBonus})`
                : ` (base ${level})`}
            </div>
            {runtimeModifiers.notes.length > 0 && (
              <div className={`${styles.inlineMarginTop025rem} ${styles.inlineColorVarColorTextSecondary}`}>
                {runtimeModifiers.notes.join(' ')}
              </div>
            )}
          </div>

          {/* Stats */}
          {stats.length > 0 ? (
            <div className={styles.inlineMarginBottom1rem}>
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
                          className={`${styles.inlineFontSize085em} ${styles.inlineColorVarColorTextTertiary} ${styles.inlineMarginLeft05rem}`}
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
                        className={styles.inlineWidth100}
                      />
                    </label>
                    <div className={`${styles.inlineFontSize08rem} ${styles.inlineColorVarColorTextSecondary}`}>
                      Effective: {effectiveValue}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          ) : (
            <div className={`${styles.inlineMarginBottom1rem} ${styles.inlineFontSize085rem} ${styles.inlineColorVarColorTextSecondary}`}>
              No stat definitions are available in this ruleset yet.
            </div>
          )}

          {/* Resources */}
          {resources.length > 0 ? (
            <div className={styles.inlineMarginBottom1rem}>
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
                    className={styles.inlineMarginBottom075rem}
                  >
                    <label>
                      {def.name}
                      {def.description && (
                        <span
                          className={`${styles.inlineFontSize085em} ${styles.inlineColorVarColorTextTertiary} ${styles.inlineMarginLeft05rem}`}
                        >
                          ({def.description})
                        </span>
                      )}
                    </label>
                    <div
                      className={`${styles.inlineDisplayGrid} ${styles.inlineGridTemplateColumns1fr1fr} ${styles.inlineGap05rem}`}
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
                          className={styles.inlineWidth100}
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
                          className={styles.inlineWidth100}
                        />
                      </label>
                    </div>
                    <div className={`${styles.inlineFontSize08rem} ${styles.inlineColorVarColorTextSecondary}`}>
                      Effective: {effective.current}/{effective.max}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${styles.inlineMarginBottom1rem} ${styles.inlineFontSize085rem} ${styles.inlineColorVarColorTextSecondary}`}>
              No resource definitions are available yet. Add things like Mana,
              Stamina, or Health in the ruleset to track them here.
            </div>
          )}

          <details className={styles.optionalState}>
            <summary>Inventory, equipment & statuses</summary>
            <p className={`${styles.inlineMarginTop0} ${styles.inlineFontSize085rem} ${styles.inlineColorVarColorTextSecondary}`}>
              Optional starting state. Type a simple entry, or choose a catalog record
              when it should stay linked to Mechanics.
            </p>

            <div className={styles.inlineMarginBottom08rem}>
              <strong className={`${styles.inlineDisplayBlock} ${styles.inlineMarginBottom035rem}`}>
                Inventory
              </strong>
              <div className={`${styles.inlineDisplayFlex} ${styles.inlineGap04rem} ${styles.inlineMarginBottom035rem}`}>
                <input
                  type='text'
                  value={quickInventoryName}
                  onChange={(e) => setQuickInventoryName(e.target.value)}
                  placeholder='Quick add item'
                  className={styles.inlineFlex1}
                />
                <input
                  type='number'
                  min={1}
                  value={quickInventoryQty}
                  onChange={(e) => setQuickInventoryQty(Math.max(1, Number(e.target.value) || 1))}
                  className={styles.inlineWidth5rem}
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
              <div className={`${styles.inlineDisplayFlex} ${styles.inlineGap04rem} ${styles.inlineMarginBottom035rem}`}>
                <select
                  value={catalogInventoryId}
                  onChange={(e) => setCatalogInventoryId(e.target.value)}
                  className={styles.inlineFlex1}
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
                <ul className={`${styles.inlineMargin0} ${styles.inlinePaddingLeft1rem}`}>
                  {inventoryEntries.map((entry) => (
                    <li key={entry.id}>
                      {entry.name}
                      {entry.quantity && entry.quantity > 1 ? ` x${entry.quantity}` : ''}
                      {entry.mode === 'cataloged' ? ' (catalog)' : ''}
                      <button
                        type='button'
                        onClick={() => removeTrackedEntry('inventory', entry.id)}
                        className={`${styles.inlineMarginLeft045rem} ${styles.inlineFontSize075rem}`}
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.inlineMarginBottom08rem}>
              <strong className={`${styles.inlineDisplayBlock} ${styles.inlineMarginBottom035rem}`}>
                Equipment
              </strong>
              <div className={`${styles.inlineDisplayFlex} ${styles.inlineGap04rem} ${styles.inlineMarginBottom035rem}`}>
                <input
                  type='text'
                  value={quickEquipmentName}
                  onChange={(e) => setQuickEquipmentName(e.target.value)}
                  placeholder='Quick add equipment'
                  className={styles.inlineFlex1}
                />
                <button
                  type='button'
                  onClick={() => appendQuickEntry('equipment', quickEquipmentName)}
                >
                  Add equipment
                </button>
              </div>
              <div className={`${styles.inlineDisplayFlex} ${styles.inlineGap04rem} ${styles.inlineMarginBottom035rem}`}>
                <select
                  value={catalogEquipmentId}
                  onChange={(e) => setCatalogEquipmentId(e.target.value)}
                  className={styles.inlineFlex1}
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
                <ul className={`${styles.inlineMargin0} ${styles.inlinePaddingLeft1rem}`}>
                  {equipmentEntries.map((entry) => (
                    <li key={entry.id}>
                      {entry.name}
                      {entry.mode === 'cataloged' ? ' (catalog)' : ''}
                      <button
                        type='button'
                        onClick={() => removeTrackedEntry('equipment', entry.id)}
                        className={`${styles.inlineMarginLeft045rem} ${styles.inlineFontSize075rem}`}
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <strong className={`${styles.inlineDisplayBlock} ${styles.inlineMarginBottom035rem}`}>
                Statuses
              </strong>
              <div className={`${styles.inlineDisplayFlex} ${styles.inlineGap04rem} ${styles.inlineMarginBottom035rem}`}>
                <input
                  type='text'
                  value={quickStatusName}
                  onChange={(e) => setQuickStatusName(e.target.value)}
                  placeholder='Quick add status'
                  className={styles.inlineFlex1}
                />
                <button
                  type='button'
                  onClick={() => appendQuickEntry('status', quickStatusName)}
                >
                  Add status
                </button>
              </div>
              <div className={`${styles.inlineDisplayFlex} ${styles.inlineGap04rem} ${styles.inlineMarginBottom035rem}`}>
                <select
                  value={catalogStatusId}
                  onChange={(e) => setCatalogStatusId(e.target.value)}
                  className={styles.inlineFlex1}
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
                <ul className={`${styles.inlineMargin0} ${styles.inlinePaddingLeft1rem}`}>
                  {statusEntries.map((entry) => (
                    <li key={entry.id}>
                      {entry.name}
                      {entry.mode === 'cataloged' ? ' (catalog)' : ''}
                      <button
                        type='button'
                        onClick={() => removeTrackedEntry('status', entry.id)}
                        className={`${styles.inlineMarginLeft045rem} ${styles.inlineFontSize075rem}`}
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>

          <div className={styles.inlineMarginBottom075rem}>
            <label>
              Notes
              <br />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className={styles.inlineWidth100}
              />
            </label>
          </div>

          <div className={`${styles.inlineDisplayFlex} ${styles.inlineGap05rem}`}>
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
          className={`${styles.historyPanel} ${
            taskView === 'scene-history' ? '' : styles.hidden
          }`}
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
            className={`${styles.inlineMarginBottom09rem} ${styles.inlinePadding075rem} ${styles.inlineBorderRadius8px} ${styles.inlineBackgroundColorVarColorBgPrimary} ${styles.inlineBorder1pxSolidVarColorBorder} ${styles.inlineFontSize09rem}`}
          >
            <strong>Preview</strong>
            <div className={`${styles.inlineMarginTop035rem} ${styles.inlineColorVarColorTextSecondary}`}>
              {selectedMutationValueSummary ||
                'Select a sheet, scene, and change details to preview the mutation.'}
            </div>
            {selectedMutationScene && (
              <div
                className={`${styles.inlineMarginTop035rem} ${styles.inlineColorVarColorTextSecondary} ${styles.inlineFontSize082rem}`}
              >
                Scene revision source: {selectedMutationScene.updatedAt} · hash{' '}
                {hashString(selectedMutationScene.content)}
              </div>
            )}
          </div>

          {mutationPreviewIssues.length > 0 && (
            <div
              role='alert'
              className={`${styles.inlineMarginBottom09rem} ${styles.inlinePadding075rem} ${styles.inlineBorderRadius8px} ${styles.inlineBorder1pxSolidVarColorErrorSoftBorder} ${styles.inlineBackgroundColorVarColorErrorSoftBg} ${styles.inlineColorVarColorError} ${styles.inlineFontSize09rem}`}
            >
              <strong>Mutation warning</strong>
              <ul className={`${styles.inlineMargin05rem001rem} ${styles.inlinePadding0}`}>
                {mutationPreviewIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          <div
            className={`${styles.inlineMarginBottom09rem} ${styles.inlinePadding075rem} ${styles.inlineBorderRadius8px} ${styles.inlineBackgroundColorVarColorBgPrimary} ${styles.inlineBorder1pxSolidVarColorBorder} ${styles.inlineFontSize09rem}`}
          >
            <strong>State At Selected Scene</strong>
            {!replayedStateAtSelectedScene ? (
              <div className={`${styles.inlineMarginTop035rem} ${styles.inlineColorVarColorTextSecondary}`}>
                Select a sheet and scene to inspect the replayed state timeline.
              </div>
            ) : (
              <>
                <div className={styles.inlineMarginTop04rem}>
                  <strong>Stats:</strong>
                  <div
                    className={`${styles.inlineDisplayGrid} ${styles.inlineGridTemplateColumnsRepeat2Minmax01fr} ${styles.inlineGap025rem} ${styles.inlineMarginTop025rem}`}
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

                <div className={styles.inlineMarginTop06rem}>
                  <strong>Resources:</strong>
                  <div
                    className={`${styles.inlineDisplayGrid} ${styles.inlineGridTemplateColumnsRepeat2Minmax01fr} ${styles.inlineGap025rem} ${styles.inlineMarginTop025rem}`}
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

                <div className={styles.inlineMarginTop06rem}>
                  <strong>Statuses:</strong>{' '}
                  {replayedStateAtSelectedScene.statuses.join(', ') || 'none'}
                </div>

                <div className={styles.inlineMarginTop06rem}>
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

                <div className={styles.inlineMarginTop06rem}>
                  <strong>Equipped:</strong>{' '}
                  {replayedStateAtSelectedScene.inventory.equipped.join(', ') ||
                    'none'}
                </div>

                <div className={styles.inlineMarginTop06rem}>
                  <strong>Location:</strong>{' '}
                  {replayedStateAtSelectedScene.locationName || 'unset'}
                </div>
              </>
            )}
          </div>

          <div className={`${styles.inlineDisplayFlex} ${styles.inlineGap075rem}`}>
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

          <div className={styles.inlineMarginTop1rem}>
            <h3 className={styles.inlineMarginBottom05rem}>Recorded State History</h3>
            {!mutationTargetSheetId ? (
              <p className={`${styles.inlineFontSize09rem} ${styles.inlineColorVarColorTextSecondary}`}>
                Select a character sheet to inspect its recorded mutation history.
              </p>
            ) : selectedSheetMutationHistory.length === 0 ? (
              <p className={`${styles.inlineFontSize09rem} ${styles.inlineColorVarColorTextSecondary}`}>
                No recorded state changes yet for this character sheet.
              </p>
            ) : (
              <ul className={`${styles.inlineListStyleNone} ${styles.inlinePadding0} ${styles.inlineMargin0}`}>
                {selectedSheetMutationHistory.map(
                  ({event, canMoveUp, canMoveDown, staleness, stalenessLabel}) => (
                  <li
                    key={event.id}
                    className={`${styles.mutationEvent} ${
                      event.status === 'invalidated'
                        ? styles.mutationEventInvalidated
                        : ''
                    }`}
                  >
                    <div
                      className={`${styles.inlineDisplayFlex} ${styles.inlineJustifyContentSpaceBetween} ${styles.inlineGap075rem} ${styles.inlineAlignItemsFlexStart}`}
                    >
                      <div className={styles.inlineFlex1}>
                        <div className={`${styles.inlineFontSize092rem} ${styles.inlineFontWeight600}`}>
                          {event.sceneOrder ? `${event.sceneOrder}. ` : ''}
                          {event.sceneTitle || 'Untitled scene'}
                          {event.sceneSequence ? ` · Step ${event.sceneSequence}` : ''}
                        </div>
                        <div
                          className={`${styles.inlineMarginTop025rem} ${styles.inlineFontSize082rem} ${styles.inlineColorVarColorTextSecondary}`}
                        >
                          Status: {event.status}
                          {event.invalidationReason
                            ? ` · ${event.invalidationReason}`
                            : ''}
                        </div>
                        {stalenessLabel && event.status !== 'invalidated' && (
                          <div
                            className={`${styles.inlineMarginTop03rem} ${styles.inlineDisplayInlineBlock} ${styles.inlineFontSize078rem} ${styles.inlineColorVarColorWarning} ${styles.inlineBackgroundColorVarColorWarningSoftBg} ${styles.inlineBorder1pxSolidVarColorWarningSoftBorder} ${styles.inlineBorderRadius999px} ${styles.inlinePadding01rem045rem}`}
                          >
                            Stale: {stalenessLabel}
                          </div>
                        )}
                        <ul
                          className={`${styles.inlineMargin05rem000} ${styles.inlinePaddingLeft1rem} ${styles.inlineFontSize09rem}`}
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
                          className={`${styles.inlineFontSize08rem} ${styles.inlineMarginRight035rem}`}
                          disabled={event.status === 'invalidated'}
                        >
                          Edit
                        </button>
                        <button
                          type='button'
                          onClick={() => void handleMoveMutationEvent(event, -1)}
                          className={`${styles.inlineFontSize08rem} ${styles.inlineMarginRight035rem}`}
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
                          className={`${styles.inlineFontSize08rem} ${styles.inlineMarginRight035rem}`}
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
                          className={styles.inlineFontSize08rem}
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

  return embedded ? (
    <>
      {content}
      {confirmDialog}
    </>
  ) : (
    <section>
      {content}
      {confirmDialog}
    </section>
  );
}

export default CharacterSheetsRoute;
