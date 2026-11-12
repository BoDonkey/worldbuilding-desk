import {useCallback, useEffect} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {
  CharacterSheet,
  Project,
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../entityTypes';
import {
  invalidateStateMutationEventById,
  saveStateMutationEvent
} from '../services/storage';
import type {ActorResolution} from '../services/characters/characterIdentity';
import {hashString} from '../services/characters/characterSheetDefaults';
import {
  replayCharacterState,
  validateStateMutationCommandAgainstState,
  validateStateMutationEventForRuleset
} from '../services/state/stateReplay';
import {validateStateMutationEvent} from '../services/state/stateMutationSchemas';
import {getAppStateKind} from '../services/state/kinds';
import {describeError} from '../services/errors';
import type {MutationFormType} from '../components/CharacterSheets/MutationForm';
import {useCharacterSheetMutationPreview} from './useCharacterSheetMutationPreview';
import type {CharacterSheetsFeedback} from './useCharacterSheetsData';

/**
 * "Record scene changes": the change being drafted against a sheet and scene,
 * and recording, editing, reordering, or invalidating accepted changes.
 */
export const useCharacterSheetSceneChanges = (params: {
  activeProject: Project | null;
  isLoaded: boolean;
  sheets: CharacterSheet[];
  ruleset: StoredRuleset | null;
  documents: WritingDocument[];
  stateMutationEvents: StateMutationEvent[];
  setStateMutationEvents: Dispatch<SetStateAction<StateMutationEvent[]>>;
  actorResolutions: ActorResolution[];
  setFeedback: (feedback: CharacterSheetsFeedback) => void;
  /** Called when a recorded change opens for editing. */
  showSceneHistory: () => void;
  prefillSheetId?: string | null;
  prefillSceneId?: string | null;
}) => {
  const {
    activeProject, isLoaded, sheets, ruleset, documents, stateMutationEvents,
    setStateMutationEvents, actorResolutions, setFeedback, showSceneHistory,
    prefillSheetId, prefillSceneId
  } = params;
  const preview = useCharacterSheetMutationPreview({
    sheets, ruleset, documents, stateMutationEvents, actorResolutions
  });
  const {
    setMutationTargetSheetId, setMutationSceneId, mutationType, setMutationType,
    mutationStatDefinitionId, setMutationStatDefinitionId,
    mutationResourceDefinitionId, setMutationResourceDefinitionId,
    mutationNumberValue, setMutationNumberValue, mutationTextValue, setMutationTextValue,
    mutationBooleanValue, setMutationBooleanValue, mutationStatusName, setMutationStatusName,
    mutationItemName, setMutationItemName, mutationQuantity, setMutationQuantity,
    mutationLocationName, setMutationLocationName, loadSheetFormValues,
    setIsSavingMutation, setInvalidatingMutationEventId,
    editingMutationEventId, setEditingMutationEventId, setReorderingMutationEventId,
    orderedDocuments, sceneOrderById, selectedMutationSheet, selectedMutationScene,
    selectedMutationStatDefinition, selectedMutationResourceDefinition,
    selectedMutationActorId, buildDraftMutationCommand, mutationPreview,
    selectedSheetMutationHistory
  } = preview;

  useEffect(() => {
    if (!isLoaded || !ruleset) return;
    if (prefillSheetId && sheets.some((sheet) => sheet.id === prefillSheetId)) {
      setMutationTargetSheetId(prefillSheetId);
    }
    if (prefillSceneId && documents.some((document) => document.id === prefillSceneId)) {
      setMutationSceneId(prefillSceneId);
    }
    if (!mutationStatDefinitionId && !mutationResourceDefinitionId) {
      if (ruleset.resourceDefinitions[0]) {
        setMutationType('resource_change');
        setMutationResourceDefinitionId(ruleset.resourceDefinitions[0].id);
      } else if (ruleset.statDefinitions.find((definition) => definition.type === 'number')) {
        const firstStat = ruleset.statDefinitions.find((definition) => definition.type === 'number');
        setMutationType('stat_change');
        setMutationStatDefinitionId(firstStat?.id ?? '');
      }
    }
  }, [
    documents, isLoaded, mutationResourceDefinitionId, mutationStatDefinitionId,
    prefillSceneId, prefillSheetId, ruleset, setMutationResourceDefinitionId,
    setMutationSceneId, setMutationStatDefinitionId, setMutationTargetSheetId,
    setMutationType, sheets
  ]);

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

  /** The simple panel's "what changed" picker: `stat:<id>` or `resource:<id>`. */
  const selectTrackedValue = (value: string) => {
    const [kind, definitionId] = value.split(':');
    if (kind === 'stat') {
      setMutationStatDefinitionId(definitionId ?? '');
      setMutationResourceDefinitionId('');
      setMutationType(mutationType.endsWith('_set') ? 'stat_set' : 'stat_change');
    } else {
      setMutationResourceDefinitionId(definitionId ?? '');
      setMutationStatDefinitionId('');
      setMutationType(mutationType.endsWith('_set') ? 'resource_set' : 'resource_change');
    }
  };

  /** The simple panel's operation picker: change by an amount, or set a value. */
  const selectOperation = (operation: 'change' | 'set') => {
    const kind = mutationStatDefinitionId ? 'stat' : 'resource';
    setMutationType(`${kind}_${operation}` as MutationFormType);
  };

  const loadMutationEventIntoForm = useCallback(
    (event: StateMutationEvent) => {
      showSceneHistory();
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
      setMutationType(command.type);
      loadSheetFormValues(getAppStateKind(command.type).sheetForm.load(command));
    },
    [
      sheets, loadSheetFormValues, setEditingMutationEventId, setMutationSceneId,
      setMutationTargetSheetId, setMutationType, showSceneHistory
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
    if (!selectedMutationActorId) {
      setFeedback({
        tone: 'error',
        message: 'Resolve this legacy sheet to a World Bible character before recording state.'
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
          actorResolutions,
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
          describeError(error, 'Unable to record state change.')
      });
    } finally {
      setIsSavingMutation(false);
    }
  }, [
    activeProject,
    actorResolutions,
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
    setFeedback,
    setStateMutationEvents,
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
            describeError(error, 'Unable to invalidate state change.')
        });
      } finally {
        setInvalidatingMutationEventId(null);
      }
    },
    [setFeedback, setInvalidatingMutationEventId, setStateMutationEvents]
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
            describeError(error, 'Unable to reorder state change.')
        });
      } finally {
        setReorderingMutationEventId(null);
      }
    },
    [
      selectedSheetMutationHistory, setFeedback, setReorderingMutationEventId,
      setStateMutationEvents
    ]
  );

  return {
    ...preview,
    resetMutationForm, selectTrackedValue, selectOperation, loadMutationEventIntoForm,
    handleSaveMutation, handleInvalidateMutationEvent, handleMoveMutationEvent
  };
};

export type CharacterSheetSceneChanges = ReturnType<typeof useCharacterSheetSceneChanges>;
