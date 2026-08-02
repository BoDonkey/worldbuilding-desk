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
  Project,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import type {
  SceneRosterCharacterCard,
  SceneRosterInventoryLine,
  SceneRosterTimelineEvent
} from '../components/Workspace/SceneRosterPanel';
import type {ConsistencyAlias} from '../services/consistency';
import {
  getEffectiveResourceValues,
  getEffectiveStatValue,
  type CharacterRuntimeModifiers
} from '../services/compendium';
import {
  buildConsumableCommands,
  buildConsumableExpirationCommands
} from '../services/state/consumableEffects';
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
  buildSceneRosterModel,
  buildSelectedSceneTimeline
} from '../services/workspace/workspaceView';
import type {SceneRosterOverrides} from '../services/workspace/sceneRoster';
import {sortWritingDocuments} from '../writingStorage';
import type {ConfirmRequest} from './useConfirmDialog';

export interface PendingPositionedChange {
  character: SceneRosterCharacterCard;
  event?: StateMutationEvent | null;
  initialLabel?: string;
  initialCommands?: StateMutationEvent['commands'];
  consumableEffect?: StateMutationEvent['consumableEffect'];
}

export interface PendingInventoryCapture {
  itemName: string;
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
      setPendingInventoryCapture({
        itemName: input.itemName.trim(),
        position,
        anchor
      });
    },
    [
      content,
      inventoryCaptureCharacters.length,
      sceneCursorSnapshot,
      selectedDocument,
      setFeedback,
      setPendingInventoryCapture
    ]
  );

  const saveSelectionInventoryCapture = useCallback(
    async (input: {sheetId: string; itemName: string; quantity: number}) => {
      if (!activeProject || !selectedDocument || !pendingInventoryCapture) return;
      const sheet = characterSheets.find((candidate) => candidate.id === input.sheetId);
      if (!sheet) return;
      const sceneOrder =
        sortWritingDocuments(documents).findIndex(
          (document) => document.id === selectedDocument.id
        ) + 1;
      if (sceneOrder <= 0) return;
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
            actorId: sheet.characterId ?? sheet.id,
            itemName: input.itemName,
            quantity: input.quantity
          }
        ],
        createdAt: Date.now()
      };
      setSavingInventoryCapture(true);
      try {
        validateStateMutationEvent(event);
        await saveStateMutationEvent(event);
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
            error instanceof Error ? error.message : 'Unable to add item to inventory.'
        });
      } finally {
        setSavingInventoryCapture(false);
      }
    },
    [
      activeProject,
      characterSheets,
      documents,
      pendingInventoryCapture,
      selectedDocument,
      setFeedback,
      setPendingInventoryCapture,
      setSavingInventoryCapture,
      stateMutationEvents
    ]
  );

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
      const actorId = sheet.characterId ?? sheet.id;
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
            error instanceof Error
              ? error.message
              : 'Unable to re-anchor scene change.'
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
        actorId: pendingPositionedSheet.id,
        characterId: pendingPositionedSheet.characterId,
        sheetId: pendingPositionedSheet.id,
        actorName: pendingPositionedSheet.name
      },
      upToSceneOrder: sceneOrder,
      upToScenePosition:
        pendingPositionedChange?.event?.scenePosition ?? sceneCursorPosition
    });
  }, [
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
        commands: input.commands,
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
            error instanceof Error ? error.message : 'Unable to record state change.'
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
        ruleset,
        documents,
        resourceDefinitionNameById,
        statDefinitionNameById
      }),
    [
      characterSheets,
      documents,
      resourceDefinitionNameById,
      ruleset,
      selectedDocument,
      statDefinitionNameById,
      stateMutationEvents
    ]
  );

  const getCharacterStateHoverCard = useCallback(
    (loreId: string, editorPosition: number) => {
      if (!selectedDocument) return null;
      const orderedSceneIds = sortWritingDocuments(documents).map((doc) => doc.id);
      const selectedSceneOrder =
        orderedSceneIds.findIndex((id) => id === selectedDocument.id) + 1;
      if (selectedSceneOrder <= 0) return null;

      const sheet = characterSheets.find(
        (candidate) => candidate.id === loreId || candidate.characterId === loreId
      );
      if (!sheet) return null;

      const replayed = replayCharacterState({
        sheet,
        ruleset,
        events: resolvedStateMutationEvents,
        target: {
          actorId: sheet.id,
          characterId: sheet.characterId,
          sheetId: sheet.id,
          actorName: sheet.name
        },
        upToSceneOrder: selectedSceneOrder,
        upToScenePosition: editorPosition
      });
      const resources = Object.entries(replayed.resources.current)
        .slice(0, 4)
        .map(([resourceId, current]) => {
          const label = resourceDefinitionNameById.get(resourceId) ?? resourceId;
          const effective = getEffectiveResourceValues({
            definitionId: resourceId,
            current,
            max: replayed.resources.max[resourceId] ?? current,
            runtime: runtimeModifiers
          });
          return `${label} ${effective.current}/${effective.max}`;
        });
      const stats = Object.entries(replayed.stats)
        .slice(0, 4)
        .map(([statId, value]) => {
          const label = statDefinitionNameById.get(statId) ?? statId;
          const effective =
            typeof value === 'number'
              ? getEffectiveStatValue({
                  definitionId: statId,
                  baseValue: value,
                  runtime: runtimeModifiers
                })
              : value;
          return `${label} ${String(effective)}`;
        });
      return {
        title: sheet.name,
        sceneLabel: 'this mention',
        resources,
        stats,
        statuses: Array.from(
          new Set([...replayed.statuses, ...runtimeModifiers.notes])
        ),
        location: replayed.locationName
      };
    },
    [
      characterSheets,
      documents,
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
    openSelectionInventoryCapture,
    saveSelectionInventoryCapture,
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
    getCharacterStateHoverCard
  };
}
