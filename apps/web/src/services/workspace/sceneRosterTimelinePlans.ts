import type {CompendiumEntry, StateMutationEvent, WritingDocument} from '../../entityTypes';
import type {SceneRosterCharacterCard, SceneRosterInventoryLine, SceneRosterTimelineEvent} from './sceneRosterTypes';
import {type PendingPositionedChange, type RosterPlanResult} from './sceneRosterMutationTypes';
import {buildConsumableCommands, buildConsumableExpirationCommands} from '../state/consumableEffects';
import {
  captureStateMutationAnchor,
  type EditorTextSnapshot,
  type StateMutationTextAnchor,
  type resolveStateMutationAnchor
} from '../state/stateMutationAnchor';
import {compareStateMutationEvents} from '../state/stateReplay';
import {summarizeStateMutationCommand} from '../state/stateMutationPresentation';
import {buildStateSubjectLookup, findStateSubject, type StateSubject} from '../state/stateSubjects';
import type {ActorResolution} from '../characters/characterIdentity';
/** The roster card showing this subject, if the character is in the scene. */
export function findRosterCardForSubject(
  characters: SceneRosterCharacterCard[],
  subject: StateSubject | null
): SceneRosterCharacterCard | null {
  if (!subject) return null;
  return characters.find((card) =>
    (card.actorId !== undefined && card.actorId === subject.actorId) ||
    (subject.sheet !== null && card.sheetId === subject.sheet.id)
  ) ?? null;
}

type AnchorResolutions = Map<string, ReturnType<typeof resolveStateMutationAnchor> | null>;
interface TimelineContext {
  stateSubjects: StateSubject[];
  compendiumEntries: CompendiumEntry[];
  content: string;
  sceneCursorAnchor: StateMutationTextAnchor;
  characters: SceneRosterCharacterCard[];
  selectedDocument: WritingDocument | null;
  stateMutationEvents: StateMutationEvent[];
}

export function planRosterConsumption({
  character,
  item,
  stateSubjects,
  compendiumEntries,
  content,
  sceneCursorAnchor,
  selectedDocument
}: Omit<TimelineContext, 'characters' | 'stateMutationEvents'> & {
  character: SceneRosterCharacterCard;
  item: SceneRosterInventoryLine;
}): RosterPlanResult<PendingPositionedChange> | null {
  if (!character.sheetId || !item.consumable || !selectedDocument)
    return null;
  if (selectedDocument.content !== content) {
    return {error: 'Save this scene before consuming an item at the cursor.'};
  }
  if (!sceneCursorAnchor.before && !sceneCursorAnchor.after) {
    return {error: 'Place the cursor after the character consumes the item.'};
  }
  const entry = compendiumEntries.find((candidate) => candidate.id === item.consumable?.definitionId);
  if (!entry?.consumable)
    return null;
  const subject = findStateSubject(character.sheetId, stateSubjects);
  if (!subject?.sheet)
    return null;
  if (subject.legacy) {
    return {error: 'Resolve this legacy sheet to a World Bible character before recording state.'};
  }
  const actorId = subject.actorId;
  return {
    value: {
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
    }
  };
}

export function planRosterExpiration({
  eventId,
  stateSubjects,
  compendiumEntries,
  content,
  sceneCursorAnchor,
  characters,
  selectedDocument,
  stateMutationEvents
}: TimelineContext & {
  eventId: string;
}): RosterPlanResult<PendingPositionedChange> | null {
  const sourceEvent = stateMutationEvents.find((event) => event.id === eventId);
  if (!sourceEvent?.consumableEffect || !selectedDocument)
    return null;
  if (selectedDocument.content !== content) {
    return {error: 'Save this scene before placing the expiration.'};
  }
  if (!sceneCursorAnchor.before && !sceneCursorAnchor.after) {
    return {error: 'Place the cursor where the effect expires.'};
  }
  const entry = compendiumEntries.find((candidate) => candidate.id === sourceEvent.consumableEffect?.definitionId);
  const actorId = sourceEvent.commands[0]?.actorId;
  const character = findRosterCardForSubject(characters, findStateSubject(actorId, stateSubjects));
  if (!entry?.consumable || !actorId || !character) {
    return {error: 'Add the affected character to the scene roster before placing the expiration.'};
  }
  return {
    value: {
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
    }
  };
}

export function planRosterTimelineEdit({
  eventId,
  stateSubjects,
  characters,
  stateMutationEvents,
  stateMutationAnchorResolutionById,
  sceneCursorSnapshot
}: Pick<TimelineContext, 'stateSubjects' | 'characters' | 'stateMutationEvents'> & {
  eventId: string;
  stateMutationAnchorResolutionById: AnchorResolutions;
  sceneCursorSnapshot: EditorTextSnapshot;
}): RosterPlanResult<{
  pending: PendingPositionedChange;
  cursorPosition: number;
  anchor: StateMutationTextAnchor;
}> | null {
  const event = stateMutationEvents.find((entry) => entry.id === eventId);
  if (!event || event.scenePosition === undefined)
    return null;
  const actorId = event.commands[0]?.actorId;
  const character = findRosterCardForSubject(characters, findStateSubject(actorId, stateSubjects));
  if (!character) {
    return {error: 'Add this character to the scene roster before editing the change.'};
  }
  const resolution = stateMutationAnchorResolutionById.get(event.id);
  const resolvedPosition = resolution && resolution.status !== 'unresolved'
    ? resolution.position
    : event.scenePosition;
  return {
    value: {
      cursorPosition: resolvedPosition, anchor: captureStateMutationAnchor(sceneCursorSnapshot, resolvedPosition), pending: {
        character,
        event: {...event, scenePosition: resolvedPosition}
      }
    }
  };
}

export function buildRosterTimeline({
  selectedDocument,
  stateSubjects,
  actorResolutions,
  stateMutationEvents,
  stateMutationAnchorResolutionById,
  resourceDefinitionNameById,
  statDefinitionNameById
}: {
  selectedDocument: WritingDocument | null;
  stateSubjects: StateSubject[];
  actorResolutions?: ActorResolution[];
  stateMutationEvents: StateMutationEvent[];
  stateMutationAnchorResolutionById: AnchorResolutions;
  resourceDefinitionNameById: Map<string, string>;
  statDefinitionNameById: Map<string, string>;
}): SceneRosterTimelineEvent[] {
  if (!selectedDocument)
    return [];
  const subjectByActorId = buildStateSubjectLookup(stateSubjects, actorResolutions);
  const expiredSourceIds = new Set(stateMutationEvents
    .filter((event) => event.status === 'accepted' && event.consumableEffect?.phase === 'expire')
    .flatMap((event) => event.consumableEffect?.sourceEventId
    ? [event.consumableEffect.sourceEventId]
    : []));
  return stateMutationEvents
    .filter((event) => event.sceneId === selectedDocument.id && event.status !== 'proposed')
    .slice()
    .sort(compareStateMutationEvents)
    .map((event) => {
    const anchorResolution = stateMutationAnchorResolutionById.get(event.id);
    const actorId = event.commands[0]?.actorId;
    const subject = actorId ? subjectByActorId.get(actorId) : null;
    return {
      id: event.id,
      label: event.label?.trim() || `Scene change ${event.sceneSequence ?? ''}`.trim(),
      actorLabel: subject?.name ?? 'Unknown character',
      position: anchorResolution && anchorResolution.status !== 'unresolved'
        ? anchorResolution.position
        : event.scenePosition,
      anchorStatus: anchorResolution?.status ?? 'legacy',
      status: event.status as 'accepted' | 'invalidated',
      summaries: event.commands.map((command) => summarizeStateMutationCommand({
        command,
        labels: {resourceDefinitionNameById, statDefinitionNameById}
      })),
      canEdit: event.sourceType === 'manual' && event.scenePosition !== undefined,
      canExpire: event.status === 'accepted' &&
        event.consumableEffect?.phase === 'consume' &&
        !expiredSourceIds.has(event.id),
      durationLabel: event.consumableEffect?.durationLabel
    };
  });
}
