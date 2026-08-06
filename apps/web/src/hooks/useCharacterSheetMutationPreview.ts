import {useMemo, useState} from 'react';
import type {
  CharacterSheet,
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../entityTypes';
import type {MutationFormType} from '../components/CharacterSheets/MutationForm';
import {sortWritingDocuments} from '../writingStorage';
import {buildCharacterSheetMutationCommand} from '../services/characters/characterSheetRuleset';
import {replayCharacterState} from '../services/state/stateReplay';
import {buildStateMutationPreview} from '../services/state/stateMutationPresentation';
import {
  describeStateMutationEventStaleness,
  getStateMutationEventStaleness
} from '../services/state/stateMutationStaleness';

export const useCharacterSheetMutationPreview = (params: {
  sheets: CharacterSheet[];
  ruleset: StoredRuleset | null;
  documents: WritingDocument[];
  stateMutationEvents: StateMutationEvent[];
}) => {
  const {sheets, ruleset, documents, stateMutationEvents} = params;
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

  const buildDraftMutationCommand = buildCharacterSheetMutationCommand;

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
  return {
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
  };
};
