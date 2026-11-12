import {useCallback, useEffect, useMemo, useState} from 'react';
import type {Dispatch, FormEvent, SetStateAction} from 'react';
import type {
  Character,
  CharacterResource,
  CharacterSheet,
  CharacterStat,
  CharacterTrackedEntry,
  CompendiumEntry,
  Project,
  StoredRuleset
} from '../entityTypes';
import {deleteCharacterSheet, saveCharacterSheet} from '../services/storage';
import {
  reconcileCharacterResources,
  reconcileCharacterStats
} from '../services/characters/characterSheetRuleset';
import {
  buildDefaultResources,
  buildDefaultStats
} from '../services/characters/characterSheetDefaults';
import {describeError} from '../services/errors';
import type {useConfirmDialog} from './useConfirmDialog';
import type {CharacterSheetsFeedback} from './useCharacterSheetsData';

export type TrackedEntryTarget = 'inventory' | 'equipment' | 'status';

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

const toLegacyList = (entries: CharacterTrackedEntry[]): string[] =>
  entries.map((entry) =>
    entry.quantity && entry.quantity > 1
      ? `${entry.name} x${entry.quantity}`
      : entry.name
  );

/**
 * The "Build character sheet" form: the sheet being edited, its baseline
 * values and starting items, and saving or deleting sheets.
 */
export const useCharacterSheetEditor = (params: {
  activeProject: Project | null;
  ruleset: StoredRuleset | null;
  sheets: CharacterSheet[];
  setSheets: Dispatch<SetStateAction<CharacterSheet[]>>;
  characters: Character[];
  compendiumEntries: CompendiumEntry[];
  setFeedback: (feedback: CharacterSheetsFeedback) => void;
  requestConfirm: ReturnType<typeof useConfirmDialog>['requestConfirm'];
}) => {
  const {
    activeProject, ruleset, sheets, setSheets, characters, compendiumEntries,
    setFeedback, requestConfirm
  } = params;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [name, setName] = useState('');
  const [level, setLevel] = useState(1);
  const [experience, setExperience] = useState(0);
  const [stats, setStats] = useState<CharacterStat[]>([]);
  const [resources, setResources] = useState<CharacterResource[]>([]);
  const [notes, setNotes] = useState('');
  const [inventoryEntries, setInventoryEntries] = useState<CharacterTrackedEntry[]>([]);
  const [equipmentEntries, setEquipmentEntries] = useState<CharacterTrackedEntry[]>([]);
  const [statusEntries, setStatusEntries] = useState<CharacterTrackedEntry[]>([]);
  // Bumped when the form starts over, so the add-entry inputs clear too.
  const [entryInputsVersion, setEntryInputsVersion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingSheetId, setDeletingSheetId] = useState<string | null>(null);

  // A newly loaded ruleset supplies the starting stats and resources.
  useEffect(() => {
    setStats(buildDefaultStats(ruleset));
    setResources(buildDefaultResources(ruleset));
  }, [ruleset]);

  const availableCharacters = useMemo(
    () =>
      characters.filter(
        (character) => character.entityId || character.id === selectedCharacterId
      ),
    [characters, selectedCharacterId]
  );

  const resetForm = useCallback(() => {
    setEditingId(null);
    setSelectedCharacterId('');
    setName('');
    setLevel(1);
    setExperience(0);
    setNotes('');
    setInventoryEntries([]);
    setEquipmentEntries([]);
    setStatusEntries([]);
    setEntryInputsVersion((version) => version + 1);
    setStats(buildDefaultStats(ruleset));
    setResources(buildDefaultResources(ruleset));
  }, [ruleset]);

  /** Opens an existing sheet in the form. */
  const openSheet = useCallback(
    (sheet: CharacterSheet) => {
      setEditingId(sheet.id);
      setSelectedCharacterId(sheet.characterId || '');
      setName(sheet.name);
      setLevel(sheet.level);
      setExperience(sheet.experience);
      setStats(reconcileCharacterStats(ruleset, sheet.stats));
      setResources(reconcileCharacterResources(ruleset, sheet.resources));
      setNotes(sheet.notes || '');
      setInventoryEntries(mergeLegacyAndTracked(sheet.inventory, sheet.inventoryEntries));
      setEquipmentEntries(mergeLegacyAndTracked(sheet.equipment, sheet.equipmentEntries));
      setStatusEntries(mergeLegacyAndTracked(sheet.statuses, sheet.statusEntries));
    },
    [ruleset]
  );

  /** Starts a new, unsaved sheet for a World Bible character. */
  const startSheetForCharacter = useCallback(
    (character: Character) => {
      resetForm();
      setSelectedCharacterId(character.id);
      setName(character.name);
    },
    [resetForm]
  );

  const setEntries = (target: TrackedEntryTarget) =>
    target === 'inventory'
      ? setInventoryEntries
      : target === 'equipment'
        ? setEquipmentEntries
        : setStatusEntries;

  /** Adds a typed entry; returns false when there is nothing to add. */
  const addQuickEntry = (target: TrackedEntryTarget, entryName: string, quantity = 1) => {
    const trimmed = entryName.trim();
    if (!trimmed) return false;
    const next: CharacterTrackedEntry = {
      id: crypto.randomUUID(),
      mode: 'quick',
      name: trimmed,
      quantity
    };
    setEntries(target)((prev) => [...prev, next]);
    return true;
  };

  /** Adds an entry linked to a Mechanics record; returns false when none is chosen. */
  const addCatalogEntry = (target: TrackedEntryTarget, entryId: string) => {
    if (!entryId) return false;
    const found = compendiumEntries.find((entry) => entry.id === entryId);
    if (!found) return false;
    const next: CharacterTrackedEntry = {
      id: crypto.randomUUID(),
      mode: 'cataloged',
      name: found.name,
      quantity: 1,
      definitionId: found.id
    };
    setEntries(target)((prev) => [...prev, next]);
    return true;
  };

  const removeTrackedEntry = (target: TrackedEntryTarget, id: string) => {
    setEntries(target)((prev) => prev.filter((entry) => entry.id !== id));
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
    const selectedCharacter = characters.find(
      (character) => character.id === selectedCharacterId
    );
    const characterEntityId = selectedCharacter?.entityId ?? existing?.characterEntityId;
    if (!existing && !characterEntityId) {
      setFeedback({
        tone: 'error',
        message: 'Choose a World Bible character before creating a sheet.'
      });
      return;
    }

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
      characterEntityId,
      characterId: selectedCharacterId || undefined,
      name: selectedCharacter?.name ?? name.trim(),
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
        describeError(error, 'Unable to save character sheet.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsSubmitting(false);
    }
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
            describeError(error, 'Unable to delete character sheet.');
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

  return {
    editingId, selectedCharacterId, availableCharacters,
    name, setName, level, setLevel, experience, setExperience,
    stats, resources, notes, setNotes,
    inventoryEntries, equipmentEntries, statusEntries, entryInputsVersion,
    isSubmitting, deletingSheetId,
    resetForm, openSheet, startSheetForCharacter, handleSubmit, handleCharacterSelect,
    handleDelete, addQuickEntry, addCatalogEntry, removeTrackedEntry,
    updateStatValue, updateResourceCurrent, updateResourceMax
  };
};

export type CharacterSheetEditor = ReturnType<typeof useCharacterSheetEditor>;
