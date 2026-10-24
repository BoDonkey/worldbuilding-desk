import type {UseWorkspaceSceneRosterOptions} from './workspaceSceneRosterTypes';
import {resolveRosterAnchors} from '../services/workspace/sceneRosterAnchors';
import {
  buildPositionedChangeBefore,
  planPositionedChange,
  planRosterReanchor,
  planRosterInvalidation
} from '../services/workspace/sceneRosterPositionPlans';
import {
  planRosterConsumption,
  planRosterExpiration,
  planRosterTimelineEdit,
  buildRosterTimeline
} from '../services/workspace/sceneRosterTimelinePlans';
import {
  planSelectionInventoryCapture,
  planSelectionConsumptionCapture
} from '../services/workspace/sceneRosterItemPlans';
import {hashSceneContent} from '../services/workspace/sceneRosterMutationTypes';
import {useCallback, useDeferredValue, useMemo} from 'react';
import type {StateMutationEvent, CompendiumEntry, InventoryQuantityStateMutationCommand} from '../entityTypes';
import type {
  SceneRosterCharacterCard,
  SceneRosterInventoryLine
} from '../services/workspace/sceneRosterTypes';
import {applyItemStateAuthoringPlan} from '../services/state/itemStateAuthoringService';
import {detectProseItemAction} from '../services/state/proseItemStateDetection';
import {
  captureStateMutationAnchor,
  normalizeStateMutationPosition
} from '../services/state/stateMutationAnchor';
import {
  invalidateStateMutationEventById,
  saveStateMutationEvent,
  sortWritingDocuments
} from '../services/storage';
import {
  replayCharacterState,
  validateStateMutationEventForRuleset
} from '../services/state/stateReplay';
import {validateStateMutationEvent} from '../services/state/stateMutationSchemas';
import {
  buildCharacterSnapshot,
  getSceneOrder,
  type CharacterSnapshotPosition
} from '../services/state/characterSnapshot';
import {
  buildSceneRosterModel,
  buildSelectedSceneTimeline
} from '../services/workspace/workspaceView';
import {describeError} from '../services/errors';

export type {PendingPositionedChange, PendingInventoryCapture} from '../services/workspace/sceneRosterMutationTypes';

export function useWorkspaceSceneRoster({
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
}: UseWorkspaceSceneRosterOptions) {
  const deferredRosterContent = useDeferredValue(content);
  const stateMutationAnchorResolutionById = useMemo(() => resolveRosterAnchors({
    stateMutationEvents, documents, selectedDocument, sceneCursorSnapshot
  }), [documents, sceneCursorSnapshot, selectedDocument, stateMutationEvents]);

  const resolvedStateMutationEvents = useMemo(
    () =>
      stateMutationEvents.flatMap((event) => {
        const resolution = stateMutationAnchorResolutionById.get(event.id);
        if (resolution?.status === 'unresolved') return [];
        return [resolution ? {...event, scenePosition: resolution.position} : event];
      }),
    [stateMutationAnchorResolutionById, stateMutationEvents]
  );

  const sceneRosterModel = useMemo(
    () =>
      buildSceneRosterModel({
        selectedDocument,
        categories,
        characters,
        entities,
        characterSheets,
        actorResolutions,
        aliases,
        content: deferredRosterContent,
        overrides: getSceneRosterOverrides(selectedDocument?.id ?? null),
        documents,
        ruleset,
        stateMutationEvents: resolvedStateMutationEvents,
        stateMoment: sceneRosterStateMoment,
        cursorPosition: sceneCursorPosition,
        runtimeModifiers,
        statDefinitionNameById,
        resourceDefinitionNameById,
        compendiumEntries
      }),
    [
      aliases,
      categories,
      characterSheets,
      actorResolutions,
      characters,
      compendiumEntries,
      deferredRosterContent,
      documents,
      entities,
      getSceneRosterOverrides,
      resourceDefinitionNameById,
      ruleset,
      runtimeModifiers,
      sceneCursorPosition,
      sceneRosterStateMoment,
      selectedDocument,
      statDefinitionNameById,
      resolvedStateMutationEvents
    ]
  );

  const addSceneRosterEntry = useCallback(
    (candidateKey: string) => {
      if (!selectedDocument) return;
      updateSceneRosterOverride(selectedDocument.id, candidateKey, 'pin');
    },
    [selectedDocument, updateSceneRosterOverride]
  );

  const inventoryCaptureCharacters = useMemo(
    () =>
      sceneRosterModel.characters.flatMap((character) =>
        character.sheetId
          ? [{sheetId: character.sheetId, name: character.name}]
          : []
      ),
    [sceneRosterModel.characters]
  );

  const inventoryCaptureContexts = useMemo(() => {
    if (!selectedDocument) return [];
    const sceneOrder =
      sortWritingDocuments(documents).findIndex(
        (document) => document.id === selectedDocument.id
      ) + 1;
    if (sceneOrder <= 0) return [];
    return inventoryCaptureCharacters.flatMap((character) => {
      const sheet = characterSheets.find((entry) => entry.id === character.sheetId);
      if (!sheet?.characterEntityId) return [];
      return [{
        ...character,
        actorId: sheet.characterEntityId,
        before: replayCharacterState({
          sheet,
          ruleset,
          events: resolvedStateMutationEvents,
          target: {
            actorId: sheet.characterEntityId,
            characterId: sheet.characterId,
            sheetId: sheet.id,
            actorName: sheet.name
          },
          actorResolutions,
          upToSceneOrder: sceneOrder,
          upToScenePosition: pendingInventoryCapture?.position ?? sceneCursorPosition
        })
      }];
    });
  }, [
    actorResolutions,
    characterSheets,
    documents,
    inventoryCaptureCharacters,
    pendingInventoryCapture?.position,
    resolvedStateMutationEvents,
    ruleset,
    sceneCursorPosition,
    selectedDocument
  ]);

  const openSelectionInventoryCapture = useCallback(
    (input: {itemName: string; from: number; to: number}) => {
      if (!selectedDocument) return;
      if (selectedDocument.content !== content) {
        setFeedback({
          tone: 'error',
          message: 'Save this scene before anchoring an inventory pickup to selected text.'
        });
        return;
      }
      if (inventoryCaptureCharacters.length === 0) {
        setFeedback({
          tone: 'error',
          message: 'Add a character with a mechanics sheet to the scene before recording inventory.'
        });
        return;
      }
      const position = normalizeStateMutationPosition(sceneCursorSnapshot, input.to);
      const anchor = captureStateMutationAnchor(sceneCursorSnapshot, position);
      if (!anchor.before && !anchor.after) {
        setFeedback({
          tone: 'error',
          message: 'Select item text inside the saved scene first.'
        });
        return;
      }
      const detected = detectProseItemAction({
        text: input.itemName,
        characters: inventoryCaptureCharacters
      });
      setPendingInventoryCapture({
        sceneId: selectedDocument.id,
        sourceHash: hashSceneContent(selectedDocument.content),
        itemName: detected?.itemName ?? input.itemName.trim(),
        evidenceText: input.itemName.trim(),
        suggestedSheetId: detected?.sheetId,
        action: detected?.action ?? 'acquire',
        position,
        anchor
      });
    },
    [
      content,
      inventoryCaptureCharacters,
      sceneCursorSnapshot,
      selectedDocument,
      setFeedback,
      setPendingInventoryCapture
    ]
  );

  const saveSelectionInventoryCapture = useCallback(
    async (input: {
      sheetId: string;
      itemName: string;
      quantity: number;
      saveReusable: boolean;
      reusableEntityId?: string;
      canonicalName: string;
    }) => {
      const result = planSelectionInventoryCapture({
        input, activeProject, selectedDocument,
        pendingInventoryCapture, content, characterSheets, documents, categories,
        entities, compendiumEntries, stateMutationEvents, now: Date.now(),
        ids: {entity: crypto.randomUUID(), definition: crypto.randomUUID(), event: crypto.randomUUID()}
      });
      if (!result) return;
      if (result.error !== undefined) {
        setFeedback({tone: 'error', message: result.error});
        return;
      }
      const {sheet, plan} = result.value;
      setSavingInventoryCapture(true);
      try {
        await applyItemStateAuthoringPlan({plan, ruleset});
        setPendingInventoryCapture(null);
        setFeedback({
          tone: 'success',
          message: `Added ${input.itemName}${input.quantity > 1 ? ` ×${input.quantity}` : ''
            } to ${sheet.name}'s inventory.`
        });
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            describeError(error, 'Unable to add item to inventory.')
        });
      } finally {
        setSavingInventoryCapture(false);
      }
    },
    [
      activeProject,
      categories,
      characterSheets,
      compendiumEntries,
      content,
      documents,
      entities,
      pendingInventoryCapture,
      ruleset,
      selectedDocument,
      setFeedback,
      setPendingInventoryCapture,
      setSavingInventoryCapture,
      stateMutationEvents
    ]
  );

  const saveSelectionConsumptionCapture = useCallback(
    async (input: {
      sheetId: string;
      itemName: string;
      commands: StateMutationEvent['commands'];
      rememberedConsumable?: CompendiumEntry['consumable'];
      saveReusable: boolean;
      reusableEntityId?: string;
      canonicalName: string;
    }) => {
      const result = planSelectionConsumptionCapture({
        input, activeProject, selectedDocument,
        pendingInventoryCapture, content, characterSheets, documents, categories,
        entities, compendiumEntries, stateMutationEvents, now: Date.now(),
        ids: {entity: crypto.randomUUID(), definition: crypto.randomUUID(), event: crypto.randomUUID()}
      });
      if (!result) return;
      if (result.error !== undefined) {
        setFeedback({tone: 'error', message: result.error});
        return;
      }
      const {sheet, plan} = result.value;
      const before = inventoryCaptureContexts.find((entry) => entry.sheetId === input.sheetId)?.before;
      setSavingInventoryCapture(true);
      try {
        await applyItemStateAuthoringPlan({plan, ruleset, before});
        setPendingInventoryCapture(null);
        setFeedback({
          tone: 'success',
          message: `Recorded ${sheet.name} using ${input.itemName}.`
        });
      } catch (error) {
        setFeedback({
          tone: 'error',
          message: describeError(error, 'Unable to record item use.')
        });
      } finally {
        setSavingInventoryCapture(false);
      }
    },
    [
      activeProject,
      categories,
      characterSheets,
      compendiumEntries,
      content,
      documents,
      entities,
      inventoryCaptureContexts,
      pendingInventoryCapture,
      ruleset,
      selectedDocument,
      setFeedback,
      setPendingInventoryCapture,
      setSavingInventoryCapture,
      stateMutationEvents
    ]
  );

  const openDetectedItemStateProposal = useCallback((eventId: string) => {
    const event = stateMutationEvents.find(
      (entry) =>
        entry.id === eventId &&
        entry.status === 'proposed' &&
        entry.sourceType === 'deterministic-review'
    );
    const command = event?.commands[0];
    if (
      !event ||
      !command ||
      !['inventory_add', 'inventory_consume'].includes(command.type)
    ) return;
    const inventoryCommand = command as InventoryQuantityStateMutationCommand;
    const sheet = characterSheets.find(
      (entry) =>
        entry.characterEntityId === inventoryCommand.actorId ||
        entry.characterId === inventoryCommand.actorId ||
        entry.id === inventoryCommand.actorId
    );
    if (!sheet) return;
    setPendingInventoryCapture({
      sceneId: event.sceneId,
      sourceHash: event.sourceHash,
      itemName: inventoryCommand.itemName,
      evidenceText: event.label ?? `${sheet.name} · ${inventoryCommand.itemName}`,
      suggestedSheetId: sheet.id,
      action: inventoryCommand.type === 'inventory_consume' ? 'consume' : 'acquire',
      proposalEventId: event.id,
      position: event.scenePosition ?? 0,
      anchor: event.sceneAnchor ?? {before: '', after: ''}
    });
  }, [characterSheets, setPendingInventoryCapture, stateMutationEvents]);

  const sceneRosterTimeline = useMemo(() => buildRosterTimeline({
    selectedDocument, characterSheets, stateMutationEvents, stateMutationAnchorResolutionById,
    resourceDefinitionNameById, statDefinitionNameById
  }), [
    characterSheets,
    resourceDefinitionNameById,
    selectedDocument,
    stateMutationAnchorResolutionById,
    stateMutationEvents,
    statDefinitionNameById
  ]);

  const hideSceneRosterEntry = useCallback(
    (candidateKey: string) => {
      if (!selectedDocument) return;
      updateSceneRosterOverride(selectedDocument.id, candidateKey, 'hide');
    },
    [selectedDocument, updateSceneRosterOverride]
  );

  const recordSceneRosterChangeHere = useCallback(
    (character: SceneRosterCharacterCard) => {
      if (!character.sheetId || !selectedDocument) return;
      if (selectedDocument.content !== content) {
        setFeedback({
          tone: 'error',
          message: 'Save this scene before anchoring a state change to the cursor.'
        });
        return;
      }
      if (!sceneCursorAnchor.before && !sceneCursorAnchor.after) {
        setFeedback({
          tone: 'error',
          message: 'Place the cursor beside scene text before recording a positioned change.'
        });
        return;
      }
      setPendingPositionedChange({character});
      setSceneRosterStateMoment('cursor');
    },
    [
      content,
      sceneCursorAnchor,
      selectedDocument,
      setFeedback,
      setPendingPositionedChange,
      setSceneRosterStateMoment
    ]
  );

  const consumeSceneRosterItemHere = useCallback(
    (character: SceneRosterCharacterCard, item: SceneRosterInventoryLine) => {
      const result = planRosterConsumption({character, item, characterSheets, compendiumEntries, content, sceneCursorAnchor, selectedDocument});
      if (!result) return;
      if (result.error !== undefined) {
        setFeedback({tone: 'error', message: result.error});
        return;
      }
      setPendingPositionedChange(result.value);
      setSceneRosterStateMoment('cursor');
    },
    [
      characterSheets,
      compendiumEntries,
      content,
      sceneCursorAnchor,
      selectedDocument,
      setFeedback,
      setPendingPositionedChange,
      setSceneRosterStateMoment
    ]
  );

  const expireSceneRosterTimelineEvent = useCallback(
    (eventId: string) => {
      const result = planRosterExpiration({eventId, characterSheets, compendiumEntries, content, sceneCursorAnchor, characters: sceneRosterModel.characters, selectedDocument, stateMutationEvents});
      if (!result) return;
      if (result.error !== undefined) {
        setFeedback({tone: 'error', message: result.error});
        return;
      }
      setPendingPositionedChange(result.value);
      setSceneRosterStateMoment('cursor');
    },
    [
      characterSheets,
      compendiumEntries,
      content,
      sceneCursorAnchor,
      sceneRosterModel.characters,
      selectedDocument,
      setFeedback,
      setPendingPositionedChange,
      setSceneRosterStateMoment,
      stateMutationEvents
    ]
  );

  const editSceneRosterTimelineEvent = useCallback(
    (eventId: string) => {
      const result = planRosterTimelineEdit({eventId, characterSheets, characters: sceneRosterModel.characters, stateMutationEvents, stateMutationAnchorResolutionById, sceneCursorSnapshot});
      if (!result) return;
      if (result.error !== undefined) {
        setFeedback({tone: 'error', message: result.error});
        return;
      }
      const {cursorPosition, anchor, pending} = result.value;
      setSceneCursorPosition(cursorPosition);
      setSceneCursorAnchor(anchor);
      setSceneRosterStateMoment('cursor');
      setPendingPositionedChange(pending);
    },
    [
      characterSheets,
      sceneCursorSnapshot,
      sceneRosterModel.characters,
      setFeedback,
      setPendingPositionedChange,
      setSceneCursorAnchor,
      setSceneCursorPosition,
      setSceneRosterStateMoment,
      stateMutationAnchorResolutionById,
      stateMutationEvents
    ]
  );

  const invalidateSceneRosterTimelineEvent = useCallback(
    (eventId: string) => {
      const event = stateMutationEvents.find((entry) => entry.id === eventId);
      if (!event) return;
      requestConfirm({
        title: `Invalidate “${event.label || 'this scene change'}”?`,
        message: 'This state change will be marked invalid and excluded from replay.',
        confirmLabel: 'Invalidate',
        variant: 'danger',
        onConfirm: async () => {
          const updated = await invalidateStateMutationEventById(planRosterInvalidation(eventId));
          if (updated) {
            setFeedback({
              tone: 'success',
              message: `Invalidated “${event.label || 'scene change'}”.`
            });
          }
        }
      });
    },
    [requestConfirm, setFeedback, stateMutationEvents]
  );

  const reanchorSceneRosterTimelineEvent = useCallback(
    async (eventId: string) => {
      const event = stateMutationEvents.find((entry) => entry.id === eventId);
      if (!event || !selectedDocument) return;
      const result = planRosterReanchor({event, selectedDocument, content, sceneCursorPosition, sceneCursorAnchor});
      if (result.error !== undefined) {
        setFeedback({tone: 'error', message: result.error});
        return;
      }
      try {
        await saveStateMutationEvent(result.value);
        setFeedback({
          tone: 'success',
          message: `Re-anchored “${event.label || 'scene change'
            }” at the current cursor.`
        });
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            describeError(error, 'Unable to re-anchor scene change.')
        });
      }
    },
    [
      content,
      sceneCursorAnchor,
      sceneCursorPosition,
      selectedDocument,
      setFeedback,
      stateMutationEvents
    ]
  );

  const pendingPositionedSheet = useMemo(
    () =>
      pendingPositionedChange?.character.sheetId
        ? characterSheets.find(
          (candidate) =>
            candidate.id === pendingPositionedChange.character.sheetId
        ) ?? null
        : null,
    [characterSheets, pendingPositionedChange]
  );

  const positionedChangeBefore = useMemo(() => buildPositionedChangeBefore({
    pendingPositionedSheet, selectedDocument, documents, ruleset, resolvedStateMutationEvents,
    pendingPositionedChange, actorResolutions, sceneCursorPosition
  }), [
    actorResolutions,
    documents,
    pendingPositionedChange,
    pendingPositionedSheet,
    ruleset,
    sceneCursorPosition,
    selectedDocument,
    resolvedStateMutationEvents
  ]);

  const savePositionedChange = useCallback(
    async (input: {label: string; commands: StateMutationEvent['commands']}) => {
      if (
        !activeProject ||
        !selectedDocument ||
        !pendingPositionedSheet ||
        !pendingPositionedChange ||
        input.commands.length === 0
      ) {
        return;
      }
      const result = planPositionedChange({
        input, projectId: activeProject.id, selectedDocument,
        documents, pendingPositionedSheet, pendingPositionedChange, stateMutationEvents,
        sceneCursorPosition, sceneCursorAnchor, eventId: crypto.randomUUID(), now: Date.now()
      });
      if (!result) return;
      if (result.error !== undefined) {
        setFeedback({tone: 'error', message: result.error});
        return;
      }
      const event = result.value;
      const existingEvent = pendingPositionedChange.event;
      setSavingPositionedChange(true);
      try {
        validateStateMutationEvent(event);
        const rulesetIssues = validateStateMutationEventForRuleset({event, ruleset});
        if (rulesetIssues.length > 0) {
          throw new Error(rulesetIssues.join(' '));
        }
        await saveStateMutationEvent(event);
        setPendingPositionedChange(null);
        setFeedback({
          tone: 'success',
          message: existingEvent
            ? `Updated “${input.label || 'scene change'}”.`
            : `Recorded “${input.label || 'scene change'
            }” at cursor position ${sceneCursorPosition}.`
        });
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            describeError(error, 'Unable to record state change.')
        });
      } finally {
        setSavingPositionedChange(false);
      }
    },
    [
      activeProject,
      documents,
      pendingPositionedChange,
      pendingPositionedSheet,
      ruleset,
      sceneCursorAnchor,
      sceneCursorPosition,
      selectedDocument,
      setFeedback,
      setPendingPositionedChange,
      setSavingPositionedChange,
      stateMutationEvents
    ]
  );

  const selectedSceneTimeline = useMemo(
    () =>
      buildSelectedSceneTimeline({
        selectedDocument,
        stateMutationEvents,
        characterSheets,
        actorResolutions,
        ruleset,
        documents,
        resourceDefinitionNameById,
        statDefinitionNameById
      }),
    [
      actorResolutions,
      characterSheets,
      documents,
      resourceDefinitionNameById,
      ruleset,
      selectedDocument,
      statDefinitionNameById,
      stateMutationEvents
    ]
  );

  const entityById = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity])),
    [entities]
  );

  /**
   * Read-only state for the stat peek and pinned panel, with this scene's
   * anchors resolved against the live editor text.
   */
  const getCharacterStatSnapshotAt = useCallback(
    (sheetId: string, position: CharacterSnapshotPosition) => {
      const sheet = characterSheets.find((candidate) => candidate.id === sheetId);
      if (!sheet) return null;
      return buildCharacterSnapshot({
        sheet,
        ruleset,
        events: resolvedStateMutationEvents,
        actorResolutions,
        position,
        runtimeModifiers,
        statDefinitionNameById,
        resourceDefinitionNameById,
        compendiumEntries,
        entityById
      });
    },
    [
      actorResolutions,
      characterSheets,
      compendiumEntries,
      entityById,
      resourceDefinitionNameById,
      resolvedStateMutationEvents,
      ruleset,
      runtimeModifiers,
      statDefinitionNameById
    ]
  );

  /** The same state at an editor position in the selected scene. */
  const getCharacterStatSnapshot = useCallback(
    (sheetId: string, editorPosition: number) => {
      if (!selectedDocument) return null;
      const selectedSceneOrder = getSceneOrder(documents, selectedDocument.id);
      if (selectedSceneOrder <= 0) return null;
      return getCharacterStatSnapshotAt(sheetId, {
        kind: 'scene',
        sceneOrder: selectedSceneOrder,
        moment: 'cursor',
        cursorPosition: editorPosition
      });
    },
    [documents, getCharacterStatSnapshotAt, selectedDocument]
  );

  return {
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
  };
}
