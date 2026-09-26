import {
  useCallback,
  useDeferredValue,
  useMemo,
  type Dispatch,
  type SetStateAction
} from 'react';
import type {
  Character,
  CharacterSheet,
  CompendiumEntry,
  EntityCategory,
  InventoryQuantityStateMutationCommand,
  Project,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import type {ActorResolution} from '../services/characters/characterIdentity';
import type {
  SceneRosterCharacterCard,
  SceneRosterInventoryLine,
  SceneRosterTimelineEvent
} from '../components/Workspace/SceneRosterPanel';
import type {ConsistencyAlias} from '../services/consistency';
import type {CharacterRuntimeModifiers} from '../services/compendium';
import {
  buildConsumableCommands,
  buildConsumableExpirationCommands
} from '../services/state/consumableEffects';
import {
  applyItemStateAuthoringPlan,
  resolveReusableItem
} from '../services/state/itemStateAuthoringService';
import {detectProseItemAction} from '../services/state/proseItemStateDetection';
import {
  captureStateMutationAnchor,
  normalizeStateMutationPosition,
  resolveStateMutationAnchor,
  textSnapshotFromPlainText,
  type EditorTextSnapshot,
  type StateMutationTextAnchor
} from '../services/state/stateMutationAnchor';
import {
  invalidateStateMutationEventById,
  saveStateMutationEvent
} from '../services/state/stateMutationLedger';
import {summarizeStateMutationCommand} from '../services/state/stateMutationPresentation';
import {
  compareStateMutationEvents,
  replayCharacterState,
  validateStateMutationEventForRuleset
} from '../services/state/stateReplay';
import {validateStateMutationEvent} from '../services/state/stateMutationSchemas';
import {
  buildCharacterSnapshot,
  getSceneOrder
} from '../services/state/characterSnapshot';
import {
  buildSceneRosterModel,
  buildSelectedSceneTimeline
} from '../services/workspace/workspaceView';
import type {SceneRosterOverrides} from '../services/workspace/sceneRoster';
import {sortWritingDocuments} from '../writingStorage';
import type {ConfirmRequest} from './useConfirmDialog';
import {isItemCategory} from '../services/worldBible/worldBibleSummary';
import {describeError} from '../services/errors';

export interface PendingPositionedChange {
  character: SceneRosterCharacterCard;
  event?: StateMutationEvent | null;
  initialLabel?: string;
  initialCommands?: StateMutationEvent['commands'];
  consumableEffect?: StateMutationEvent['consumableEffect'];
}

export interface PendingInventoryCapture {
  sceneId: string;
  sourceHash: string;
  itemName: string;
  evidenceText: string;
  suggestedSheetId?: string;
  action: 'acquire' | 'consume';
  proposalEventId?: string;
  position: number;
  anchor: StateMutationTextAnchor;
}

interface WorkspaceSceneFeedback {
  tone: 'success' | 'error';
  message: string;
}

interface UseWorkspaceSceneRosterOptions {
  activeProject: Project | null;
  selectedDocument: WritingDocument | null;
  documents: WritingDocument[];
  content: string;
  categories: EntityCategory[];
  characters: Character[];
  entities: WorldEntity[];
  characterSheets: CharacterSheet[];
  actorResolutions: ActorResolution[];
  aliases: ConsistencyAlias[];
  ruleset: StoredRuleset | null;
  stateMutationEvents: StateMutationEvent[];
  runtimeModifiers: CharacterRuntimeModifiers;
  statDefinitionNameById: Map<string, string>;
  resourceDefinitionNameById: Map<string, string>;
  compendiumEntries: CompendiumEntry[];
  getSceneRosterOverrides: (sceneId: string | null) => SceneRosterOverrides;
  updateSceneRosterOverride: (
    sceneId: string,
    candidateKey: string,
    action: 'pin' | 'hide' | 'reset'
  ) => void;
  sceneRosterStateMoment: 'opening' | 'cursor' | 'ending';
  setSceneRosterStateMoment: Dispatch<
    SetStateAction<'opening' | 'cursor' | 'ending'>
  >;
  sceneCursorPosition: number;
  setSceneCursorPosition: Dispatch<SetStateAction<number>>;
  sceneCursorSnapshot: EditorTextSnapshot;
  setSceneCursorAnchor: Dispatch<SetStateAction<StateMutationTextAnchor>>;
  sceneCursorAnchor: StateMutationTextAnchor;
  pendingPositionedChange: PendingPositionedChange | null;
  setPendingPositionedChange: Dispatch<
    SetStateAction<PendingPositionedChange | null>
  >;
  setSavingPositionedChange: Dispatch<SetStateAction<boolean>>;
  pendingInventoryCapture: PendingInventoryCapture | null;
  setPendingInventoryCapture: Dispatch<
    SetStateAction<PendingInventoryCapture | null>
  >;
  setSavingInventoryCapture: Dispatch<SetStateAction<boolean>>;
  setFeedback: (feedback: WorkspaceSceneFeedback) => void;
  requestConfirm: (request: ConfirmRequest) => void;
}

const hashSceneContent = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `h${(hash >>> 0).toString(16)}`;
};

const scenePlainText = (html: string): string => {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  }
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
};

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
  const stateMutationAnchorResolutionById = useMemo(() => {
    const resolutions = new Map<
      string,
      ReturnType<typeof resolveStateMutationAnchor> | null
    >();
    stateMutationEvents.forEach((event) => {
      if (!event.sceneAnchor || event.scenePosition === undefined) {
        resolutions.set(event.id, null);
        return;
      }
      const document = documents.find((entry) => entry.id === event.sceneId);
      if (!document) {
        resolutions.set(event.id, {status: 'unresolved'});
        return;
      }
      const snapshot =
        selectedDocument?.id === event.sceneId && sceneCursorSnapshot.spans.length > 0
          ? sceneCursorSnapshot
          : textSnapshotFromPlainText(scenePlainText(document.content));
      resolutions.set(
        event.id,
        resolveStateMutationAnchor({
          snapshot,
          anchor: event.sceneAnchor,
          originalPosition: event.scenePosition
        })
      );
    });
    return resolutions;
  }, [documents, sceneCursorSnapshot, selectedDocument?.id, stateMutationEvents]);

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
      if (!activeProject || !selectedDocument || !pendingInventoryCapture) return;
      if (pendingInventoryCapture.action !== 'acquire') {
        setFeedback({
          tone: 'error',
          message: 'Use the consumption proposal to record this item use.'
        });
        return;
      }
      if (
        pendingInventoryCapture.sceneId !== selectedDocument.id ||
        pendingInventoryCapture.sourceHash !== hashSceneContent(content)
      ) {
        setFeedback({
          tone: 'error',
          message: 'The source prose changed. Close this proposal and reopen it from the current text.'
        });
        return;
      }
      const sheet = characterSheets.find((candidate) => candidate.id === input.sheetId);
      if (!sheet) return;
      if (!sheet.characterEntityId) {
        setFeedback({
          tone: 'error',
          message: 'Resolve this legacy sheet to a World Bible character before recording state.'
        });
        return;
      }
      const sceneOrder =
        sortWritingDocuments(documents).findIndex(
          (document) => document.id === selectedDocument.id
        ) + 1;
      if (sceneOrder <= 0) return;
      const resolution = resolveReusableItem({
        itemName: input.itemName,
        categories,
        entities,
        compendiumEntries
      });
      const itemCategory = categories.find(isItemCategory) ?? null;
      const selectedEntity = input.reusableEntityId
        ? entities.find((entity) => entity.id === input.reusableEntityId) ?? null
        : null;
      if (input.saveReusable && !selectedEntity && !itemCategory) {
        setFeedback({
          tone: 'error',
          message: 'Create an Items category before saving a reusable world item.'
        });
        return;
      }
      const now = Date.now();
      const entityToSave: WorldEntity | undefined =
        input.saveReusable && !selectedEntity && itemCategory
          ? {
              id: crypto.randomUUID(),
              projectId: activeProject.id,
              categoryId: itemCategory.id,
              name: input.canonicalName || input.itemName,
              fields: {description: ''},
              needsCompletion: true,
              links: [],
              createdAt: now,
              updatedAt: now
            }
          : undefined;
      const sourceEntityId =
        selectedEntity?.id ??
        entityToSave?.id ??
        (resolution.status === 'exact' ? resolution.sourceEntityId : undefined);
      const normalizedItemName = input.itemName.trim().toLocaleLowerCase();
      const linkedDefinitions = compendiumEntries.filter(
        (entry) =>
          entry.name.trim().toLocaleLowerCase() === normalizedItemName &&
          (!sourceEntityId || entry.sourceEntityId === sourceEntityId)
      );
      const exactDefinition =
        linkedDefinitions.length === 1
          ? linkedDefinitions[0]
          : resolution.status === 'exact' && resolution.definitionId
            ? compendiumEntries.find((entry) => entry.id === resolution.definitionId) ?? null
            : null;
      const compendiumEntryToSave =
        input.saveReusable && sourceEntityId && exactDefinition && !exactDefinition.sourceEntityId
          ? {...exactDefinition, sourceEntityId, updatedAt: now}
          : undefined;
      const event: StateMutationEvent = {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        sceneId: selectedDocument.id,
        sceneTitle: selectedDocument.title,
        sceneOrder,
        sceneSequence:
          stateMutationEvents
            .filter((entry) => entry.sceneId === selectedDocument.id)
            .reduce((max, entry) => Math.max(max, entry.sceneSequence ?? 0), 0) + 1,
        scenePosition: pendingInventoryCapture.position,
        sceneAnchor: pendingInventoryCapture.anchor,
        label: `Picks up ${input.itemName}`,
        sourceType: 'manual',
        sourceRevision: selectedDocument.updatedAt,
        sourceHash: hashSceneContent(selectedDocument.content),
        status: 'accepted',
        commands: [
          {
            type: 'inventory_add',
            actorId: sheet.characterEntityId,
            itemName: input.itemName,
            quantity: input.quantity,
            sourceEntityId,
            definitionId: exactDefinition?.id
          }
        ],
        createdAt: Date.now()
      };
      setSavingInventoryCapture(true);
      try {
        const proposalEvent = pendingInventoryCapture.proposalEventId
          ? stateMutationEvents.find(
              (entry) => entry.id === pendingInventoryCapture.proposalEventId
            )
          : undefined;
        await applyItemStateAuthoringPlan({
          plan: {
            projectId: activeProject.id,
            event,
            entityToSave,
            compendiumEntryToSave,
            eventToInvalidate: proposalEvent
              ? {
                  ...proposalEvent,
                  status: 'invalidated',
                  invalidatedAt: Date.now(),
                  invalidationReason: 'Replaced by author-confirmed Workspace item proposal.'
                }
              : undefined
          },
          ruleset
        });
        setPendingInventoryCapture(null);
        setFeedback({
          tone: 'success',
          message: `Added ${input.itemName}${
            input.quantity > 1 ? ` ×${input.quantity}` : ''
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
      if (
        !activeProject ||
        !selectedDocument ||
        !pendingInventoryCapture ||
        pendingInventoryCapture.action !== 'consume'
      ) return;
      if (
        pendingInventoryCapture.sceneId !== selectedDocument.id ||
        pendingInventoryCapture.sourceHash !== hashSceneContent(content)
      ) {
        setFeedback({
          tone: 'error',
          message: 'The source prose changed. Close this proposal and reopen it from the current text.'
        });
        return;
      }
      const sheet = characterSheets.find((candidate) => candidate.id === input.sheetId);
      if (!sheet?.characterEntityId) {
        setFeedback({
          tone: 'error',
          message: 'Resolve this character sheet to World Bible canon before recording state.'
        });
        return;
      }
      const sceneOrder =
        sortWritingDocuments(documents).findIndex(
          (document) => document.id === selectedDocument.id
        ) + 1;
      if (sceneOrder <= 0) return;
      const resolution = resolveReusableItem({
        itemName: input.itemName,
        categories,
        entities,
        compendiumEntries
      });
      const itemCategory = categories.find(isItemCategory) ?? null;
      const selectedEntity = input.reusableEntityId
        ? entities.find((entity) => entity.id === input.reusableEntityId) ?? null
        : null;
      if (input.saveReusable && !selectedEntity && !itemCategory) {
        setFeedback({
          tone: 'error',
          message: 'Create an Items category before saving a reusable world item.'
        });
        return;
      }
      const now = Date.now();
      const entityToSave: WorldEntity | undefined =
        input.saveReusable && !selectedEntity && itemCategory
          ? {
              id: crypto.randomUUID(),
              projectId: activeProject.id,
              categoryId: itemCategory.id,
              name: input.canonicalName || input.itemName,
              fields: {description: ''},
              needsCompletion: true,
              links: [],
              createdAt: now,
              updatedAt: now
            }
          : undefined;
      const sourceEntityId =
        selectedEntity?.id ??
        entityToSave?.id ??
        (resolution.status === 'exact' ? resolution.sourceEntityId : undefined);
      const existingDefinition = resolution.status === 'exact' && resolution.definitionId
        ? compendiumEntries.find((entry) => entry.id === resolution.definitionId) ?? null
        : sourceEntityId
          ? compendiumEntries.find((entry) => entry.sourceEntityId === sourceEntityId) ?? null
          : null;
      const definitionId =
        existingDefinition?.id ?? (input.rememberedConsumable ? crypto.randomUUID() : undefined);
      const compendiumEntryToSave: CompendiumEntry | undefined =
        input.rememberedConsumable
          ? {
              id: definitionId as string,
              projectId: activeProject.id,
              name: entityToSave?.name ?? selectedEntity?.name ?? input.itemName,
              domain: existingDefinition?.domain ?? 'artifact',
              sourceEntityId,
              description: existingDefinition?.description,
              tags: existingDefinition?.tags ?? [],
              mechanicKind: existingDefinition?.mechanicKind ?? 'general',
              progressScope: existingDefinition?.progressScope ?? 'character',
              needsCompletion: false,
              consumable: input.rememberedConsumable,
              actions: existingDefinition?.actions ?? [],
              createdAt: existingDefinition?.createdAt ?? now,
              updatedAt: now
            }
          : existingDefinition && sourceEntityId && !existingDefinition.sourceEntityId
            ? {...existingDefinition, sourceEntityId, updatedAt: now}
            : undefined;
      const commands = input.commands.map((command) =>
        command.type.startsWith('inventory_')
          ? {
              ...command,
              actorId: sheet.characterEntityId as string,
              sourceEntityId,
              definitionId
            }
          : {...command, actorId: sheet.characterEntityId as string}
      );
      const event: StateMutationEvent = {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        sceneId: selectedDocument.id,
        sceneTitle: selectedDocument.title,
        sceneOrder,
        sceneSequence:
          stateMutationEvents
            .filter((entry) => entry.sceneId === selectedDocument.id)
            .reduce((max, entry) => Math.max(max, entry.sceneSequence ?? 0), 0) + 1,
        scenePosition: pendingInventoryCapture.position,
        sceneAnchor: pendingInventoryCapture.anchor,
        label: `Consumes ${input.itemName}`,
        sourceType: 'manual',
        sourceRevision: selectedDocument.updatedAt,
        sourceHash: hashSceneContent(selectedDocument.content),
        status: 'accepted',
        commands,
        consumableEffect: definitionId
          ? {
              definitionId,
              itemName: input.itemName,
              phase: 'consume'
            }
          : undefined,
        createdAt: now
      };
      const before = inventoryCaptureContexts.find(
        (entry) => entry.sheetId === input.sheetId
      )?.before;
      setSavingInventoryCapture(true);
      try {
        const proposalEvent = pendingInventoryCapture.proposalEventId
          ? stateMutationEvents.find(
              (entry) => entry.id === pendingInventoryCapture.proposalEventId
            )
          : undefined;
        await applyItemStateAuthoringPlan({
          plan: {
            projectId: activeProject.id,
            event,
            entityToSave,
            compendiumEntryToSave,
            eventToInvalidate: proposalEvent
              ? {
                  ...proposalEvent,
                  status: 'invalidated',
                  invalidatedAt: Date.now(),
                  invalidationReason: 'Replaced by author-confirmed Workspace item proposal.'
                }
              : undefined
          },
          ruleset,
          before
        });
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

  const sceneRosterTimeline = useMemo<SceneRosterTimelineEvent[]>(() => {
    if (!selectedDocument) return [];
    const sheetByActorId = new Map<string, CharacterSheet>();
    characterSheets.forEach((sheet) => {
      sheetByActorId.set(sheet.id, sheet);
      if (sheet.characterId) sheetByActorId.set(sheet.characterId, sheet);
    });
    const expiredSourceIds = new Set(
      stateMutationEvents
        .filter(
          (event) =>
            event.status === 'accepted' && event.consumableEffect?.phase === 'expire'
        )
        .flatMap((event) =>
          event.consumableEffect?.sourceEventId
            ? [event.consumableEffect.sourceEventId]
            : []
        )
    );
    return stateMutationEvents
      .filter(
        (event) => event.sceneId === selectedDocument.id && event.status !== 'proposed'
      )
      .slice()
      .sort(compareStateMutationEvents)
      .map((event) => {
        const anchorResolution = stateMutationAnchorResolutionById.get(event.id);
        const actorId = event.commands[0]?.actorId;
        const sheet = actorId ? sheetByActorId.get(actorId) : null;
        return {
          id: event.id,
          label:
            event.label?.trim() || `Scene change ${event.sceneSequence ?? ''}`.trim(),
          actorLabel: sheet?.name ?? 'Unknown character',
          position:
            anchorResolution && anchorResolution.status !== 'unresolved'
              ? anchorResolution.position
              : event.scenePosition,
          anchorStatus: anchorResolution?.status ?? 'legacy',
          status: event.status as 'accepted' | 'invalidated',
          summaries: event.commands.map((command) =>
            summarizeStateMutationCommand({
              command,
              labels: {resourceDefinitionNameById, statDefinitionNameById}
            })
          ),
          canEdit: event.sourceType === 'manual' && event.scenePosition !== undefined,
          canExpire:
            event.status === 'accepted' &&
            event.consumableEffect?.phase === 'consume' &&
            !expiredSourceIds.has(event.id),
          durationLabel: event.consumableEffect?.durationLabel
        };
      });
  }, [
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
      if (!character.sheetId || !item.consumable || !selectedDocument) return;
      if (selectedDocument.content !== content) {
        setFeedback({
          tone: 'error',
          message: 'Save this scene before consuming an item at the cursor.'
        });
        return;
      }
      if (!sceneCursorAnchor.before && !sceneCursorAnchor.after) {
        setFeedback({
          tone: 'error',
          message: 'Place the cursor after the character consumes the item.'
        });
        return;
      }
      const entry = compendiumEntries.find(
        (candidate) => candidate.id === item.consumable?.definitionId
      );
      if (!entry?.consumable) return;
      const sheet = characterSheets.find(
        (candidate) => candidate.id === character.sheetId
      );
      if (!sheet) return;
      if (!sheet.characterEntityId) {
        setFeedback({
          tone: 'error',
          message: 'Resolve this legacy sheet to a World Bible character before recording state.'
        });
        return;
      }
      const actorId = sheet.characterEntityId;
      setPendingPositionedChange({
        character,
        initialLabel: `Consumes ${item.name}`,
        initialCommands: buildConsumableCommands({
          actorId,
          itemName: item.name,
          definition: entry.consumable
        }),
        consumableEffect: {
          definitionId: entry.id,
          itemName: item.name,
          durationLabel: entry.consumable.durationLabel,
          phase: 'consume'
        }
      });
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
      const sourceEvent = stateMutationEvents.find((event) => event.id === eventId);
      if (!sourceEvent?.consumableEffect || !selectedDocument) return;
      if (selectedDocument.content !== content) {
        setFeedback({
          tone: 'error',
          message: 'Save this scene before placing the expiration.'
        });
        return;
      }
      if (!sceneCursorAnchor.before && !sceneCursorAnchor.after) {
        setFeedback({tone: 'error', message: 'Place the cursor where the effect expires.'});
        return;
      }
      const entry = compendiumEntries.find(
        (candidate) =>
          candidate.id === sourceEvent.consumableEffect?.definitionId
      );
      const actorId = sourceEvent.commands[0]?.actorId;
      const sheet = characterSheets.find(
        (candidate) =>
          candidate.id === actorId || candidate.characterId === actorId
      );
      const character = sceneRosterModel.characters.find(
        (candidate) => candidate.sheetId === sheet?.id
      );
      if (!entry?.consumable || !actorId || !character) {
        setFeedback({
          tone: 'error',
          message:
            'Add the affected character to the scene roster before placing the expiration.'
        });
        return;
      }
      setPendingPositionedChange({
        character,
        initialLabel: `${sourceEvent.consumableEffect.itemName} expires`,
        initialCommands: buildConsumableExpirationCommands({
          actorId,
          definition: entry.consumable
        }),
        consumableEffect: {
          definitionId: entry.id,
          itemName: sourceEvent.consumableEffect.itemName,
          durationLabel: entry.consumable.durationLabel,
          phase: 'expire',
          sourceEventId: sourceEvent.id
        }
      });
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
      const event = stateMutationEvents.find((entry) => entry.id === eventId);
      if (!event || event.scenePosition === undefined) return;
      const actorId = event.commands[0]?.actorId;
      const sheet = characterSheets.find(
        (candidate) => candidate.id === actorId || candidate.characterId === actorId
      );
      const character = sceneRosterModel.characters.find(
        (entry) => entry.sheetId === sheet?.id
      );
      if (!sheet || !character) {
        setFeedback({
          tone: 'error',
          message: 'Add this character to the scene roster before editing the change.'
        });
        return;
      }
      const resolution = stateMutationAnchorResolutionById.get(event.id);
      const resolvedPosition =
        resolution && resolution.status !== 'unresolved'
          ? resolution.position
          : event.scenePosition;
      setSceneCursorPosition(resolvedPosition);
      setSceneCursorAnchor(
        captureStateMutationAnchor(sceneCursorSnapshot, resolvedPosition)
      );
      setSceneRosterStateMoment('cursor');
      setPendingPositionedChange({
        character,
        event: {...event, scenePosition: resolvedPosition}
      });
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
          const updated = await invalidateStateMutationEventById({
            eventId,
            reason: 'Invalidated from the scene roster timeline.'
          });
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
      if (selectedDocument.content !== content) {
        setFeedback({
          tone: 'error',
          message: 'Save the scene before re-anchoring this change.'
        });
        return;
      }
      if (!sceneCursorAnchor.before && !sceneCursorAnchor.after) {
        setFeedback({
          tone: 'error',
          message: 'Place the cursor beside the intended scene text first.'
        });
        return;
      }
      try {
        await saveStateMutationEvent({
          ...event,
          scenePosition: sceneCursorPosition,
          sceneAnchor: sceneCursorAnchor,
          sourceRevision: selectedDocument.updatedAt,
          sourceHash: hashSceneContent(selectedDocument.content),
          invalidatedAt: undefined,
          invalidationReason: undefined
        });
        setFeedback({
          tone: 'success',
          message: `Re-anchored “${
            event.label || 'scene change'
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

  const positionedChangeBefore = useMemo(() => {
    if (!pendingPositionedSheet || !selectedDocument) return null;
    const sceneOrder =
      sortWritingDocuments(documents).findIndex(
        (document) => document.id === selectedDocument.id
      ) + 1;
    if (sceneOrder <= 0) return null;
    return replayCharacterState({
      sheet: pendingPositionedSheet,
      ruleset,
      events: resolvedStateMutationEvents.filter((event) => {
        if (event.id === pendingPositionedChange?.event?.id) return false;
        const editingEvent = pendingPositionedChange?.event;
        if (
          editingEvent?.scenePosition !== undefined &&
          event.sceneId === editingEvent.sceneId &&
          event.scenePosition === editingEvent.scenePosition &&
          (event.sceneSequence ?? Number.MAX_SAFE_INTEGER) >
            (editingEvent.sceneSequence ?? Number.MAX_SAFE_INTEGER)
        ) {
          return false;
        }
        return true;
      }),
      target: {
        actorId: pendingPositionedSheet.characterEntityId,
        characterId: pendingPositionedSheet.characterId,
        sheetId: pendingPositionedSheet.id,
        actorName: pendingPositionedSheet.name
      },
      actorResolutions,
      upToSceneOrder: sceneOrder,
      upToScenePosition:
        pendingPositionedChange?.event?.scenePosition ?? sceneCursorPosition
    });
  }, [
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
      const sceneOrder =
        sortWritingDocuments(documents).findIndex(
          (document) => document.id === selectedDocument.id
        ) + 1;
      if (sceneOrder <= 0) return;
      const canonicalActorId = pendingPositionedSheet.characterEntityId;
      if (!canonicalActorId) {
        setFeedback({
          tone: 'error',
          message: 'Resolve this legacy sheet to a World Bible character before recording state.'
        });
        return;
      }
      const existingEvent = pendingPositionedChange.event ?? null;
      const event: StateMutationEvent = {
        id: existingEvent?.id ?? crypto.randomUUID(),
        projectId: activeProject.id,
        sceneId: selectedDocument.id,
        sceneTitle: selectedDocument.title,
        sceneOrder,
        sceneSequence:
          existingEvent?.sceneSequence ??
          stateMutationEvents
            .filter((entry) => entry.sceneId === selectedDocument.id)
            .reduce((max, entry) => Math.max(max, entry.sceneSequence ?? 0), 0) + 1,
        scenePosition: existingEvent?.scenePosition ?? sceneCursorPosition,
        sceneAnchor: sceneCursorAnchor,
        label: input.label || undefined,
        sourceType: 'manual',
        sourceRevision: selectedDocument.updatedAt,
        sourceHash: hashSceneContent(selectedDocument.content),
        status: 'accepted',
        commands: input.commands.map((command) => ({
          ...command,
          actorId: canonicalActorId
        })),
        consumableEffect:
          pendingPositionedChange.consumableEffect ?? existingEvent?.consumableEffect,
        createdAt: existingEvent?.createdAt ?? Date.now()
      };
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
            : `Recorded “${
                input.label || 'scene change'
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

  /** Read-only state for the stat peek, at an editor position in the selected scene. */
  const getCharacterStatSnapshot = useCallback(
    (sheetId: string, editorPosition: number) => {
      if (!selectedDocument) return null;
      const selectedSceneOrder = getSceneOrder(documents, selectedDocument.id);
      if (selectedSceneOrder <= 0) return null;

      const sheet = characterSheets.find((candidate) => candidate.id === sheetId);
      if (!sheet) return null;

      return buildCharacterSnapshot({
        sheet,
        ruleset,
        events: resolvedStateMutationEvents,
        actorResolutions,
        position: {
          kind: 'scene',
          sceneOrder: selectedSceneOrder,
          moment: 'cursor',
          cursorPosition: editorPosition
        },
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
      documents,
      entityById,
      resourceDefinitionNameById,
      resolvedStateMutationEvents,
      ruleset,
      runtimeModifiers,
      selectedDocument,
      statDefinitionNameById
    ]
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
    getCharacterStatSnapshot
  };
}
