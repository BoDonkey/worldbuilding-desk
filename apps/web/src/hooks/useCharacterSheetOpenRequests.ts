import {useEffect, useRef} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {Character, CharacterSheet, Project, StoredRuleset} from '../entityTypes';
import {saveCharacterSheet} from '../services/storage';
import {
  buildDefaultResources,
  buildDefaultStats
} from '../services/characters/characterSheetDefaults';
import {describeError} from '../services/errors';
import type {CharacterSheetsFeedback} from './useCharacterSheetsData';

/**
 * Handles requests from other screens (World Bible, Workspace) to open the
 * sheet form for a character: either prefill a new sheet, or open the
 * character's sheet, creating it from the ruleset defaults when missing.
 */
export const useCharacterSheetOpenRequests = (params: {
  activeProject: Project | null;
  isLoaded: boolean;
  ruleset: StoredRuleset | null;
  characters: Character[];
  sheets: CharacterSheet[];
  setSheets: Dispatch<SetStateAction<CharacterSheet[]>>;
  editingId: string | null;
  openSheet: (sheet: CharacterSheet) => void;
  startSheetForCharacter: (character: Character) => void;
  setMutationTargetSheetId: (sheetId: string) => void;
  setFeedback: (feedback: CharacterSheetsFeedback) => void;
  prefillCharacterId?: string | null;
  onPrefillConsumed?: () => void;
  autoCreateSheetCharacterId?: string | null;
  onAutoCreateConsumed?: () => void;
}) => {
  const {
    activeProject, isLoaded, ruleset, characters, sheets, setSheets, editingId,
    openSheet, startSheetForCharacter, setMutationTargetSheetId, setFeedback,
    prefillCharacterId, onPrefillConsumed, autoCreateSheetCharacterId,
    onAutoCreateConsumed
  } = params;
  const autoCreateInFlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (!prefillCharacterId || editingId || !isLoaded) {
      return;
    }
    const character = characters.find((c) => c.id === prefillCharacterId);
    if (character?.entityId) {
      startSheetForCharacter(character);
      setFeedback({
        tone: 'success',
        message: `"${character.name}" is ready for a sheet. Base stats and resources below come from the active ruleset.`
      });
    } else if (character) {
      setFeedback({
        tone: 'error',
        message: `Link "${character.name}" to a World Bible character before creating a sheet.`
      });
    }
    onPrefillConsumed?.();
  }, [
    prefillCharacterId,
    characters,
    editingId,
    isLoaded,
    onPrefillConsumed,
    setFeedback,
    startSheetForCharacter
  ]);

  useEffect(() => {
    if (
      !autoCreateSheetCharacterId ||
      editingId ||
      !isLoaded ||
      !activeProject ||
      autoCreateInFlightRef.current === autoCreateSheetCharacterId
    ) {
      return;
    }
    autoCreateInFlightRef.current = autoCreateSheetCharacterId;
    const character = characters.find((entry) => entry.id === autoCreateSheetCharacterId);
    if (!character) {
      autoCreateInFlightRef.current = null;
      onAutoCreateConsumed?.();
      return;
    }
    if (!character.entityId) {
      setFeedback({
        tone: 'error',
        message: `Link "${character.name}" to a World Bible character before creating a sheet.`
      });
      autoCreateInFlightRef.current = null;
      onAutoCreateConsumed?.();
      return;
    }

    const existingSheet =
      sheets.find(
        (sheet) =>
          sheet.characterEntityId === character.entityId ||
          sheet.characterId === autoCreateSheetCharacterId
      ) ?? null;
    if (existingSheet) {
      setMutationTargetSheetId(existingSheet.id);
      openSheet(existingSheet);
      setFeedback({
        tone: 'success',
        message: `Opened the existing sheet for "${character.name}".`
      });
      autoCreateInFlightRef.current = null;
      onAutoCreateConsumed?.();
      return;
    }

    const now = Date.now();
    const sheet: CharacterSheet = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      characterEntityId: character.entityId,
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
        setMutationTargetSheetId(sheet.id);
        setSheets((prev) => [...prev, sheet]);
        openSheet(sheet);
        setFeedback({
          tone: 'success',
          message: `Created a character sheet for "${character.name}". Stats and resources came from the active ruleset.`
        });
      })
      .catch((error) => {
        const message =
          describeError(error, 'Unable to create a character sheet.');
        setFeedback({tone: 'error', message});
      })
      .finally(() => {
        autoCreateInFlightRef.current = null;
        onAutoCreateConsumed?.();
      });
  }, [
    activeProject,
    autoCreateSheetCharacterId,
    characters,
    editingId,
    isLoaded,
    onAutoCreateConsumed,
    openSheet,
    ruleset,
    setFeedback,
    setMutationTargetSheetId,
    setSheets,
    sheets
  ]);
};
