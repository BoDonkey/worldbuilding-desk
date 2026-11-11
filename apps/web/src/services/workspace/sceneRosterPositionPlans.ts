import type {ActorResolution} from '../characters/characterIdentity';
import type {StateMutationEvent, StoredRuleset, WritingDocument} from '../../entityTypes';
import {replayStateSubject, stateSubjectAccepts, type StateSubject} from '../state/stateSubjects';
import {sortWritingDocuments} from '../storage';
import {hashSceneContent, type PendingPositionedChange, type RosterPlanResult} from './sceneRosterMutationTypes';
import type {StateMutationTextAnchor} from '../state/stateMutationAnchor';
export function planPositionedChange({
  input,
  projectId,
  selectedDocument,
  documents,
  pendingPositionedSubject,
  pendingPositionedChange,
  stateMutationEvents,
  sceneCursorPosition,
  sceneCursorAnchor,
  eventId,
  now
}: {
  input: {
    label: string;
    commands: StateMutationEvent['commands'];
  };
  projectId: string;
  selectedDocument: WritingDocument;
  documents: WritingDocument[];
  pendingPositionedSubject: StateSubject;
  pendingPositionedChange: PendingPositionedChange;
  stateMutationEvents: StateMutationEvent[];
  sceneCursorPosition: number;
  sceneCursorAnchor: StateMutationTextAnchor;
  eventId: string;
  now: number;
}): RosterPlanResult<StateMutationEvent> | null {
  const sceneOrder = sortWritingDocuments(documents).findIndex((document) => document.id === selectedDocument.id) + 1;
  if (sceneOrder <= 0)
    return null;
  if (pendingPositionedSubject.legacy) {
    return {error: 'Resolve this legacy sheet to a World Bible character before recording state.'};
  }
  if (!input.commands.every((command) => stateSubjectAccepts(pendingPositionedSubject, command))) {
    return {error: `${pendingPositionedSubject.name} has no character sheet, so only item and place changes can be recorded.`};
  }
  const canonicalActorId = pendingPositionedSubject.actorId;
  const existingEvent = pendingPositionedChange.event ?? null;
  const event: StateMutationEvent = {
    id: existingEvent?.id ?? eventId,
    projectId,
    sceneId: selectedDocument.id,
    sceneTitle: selectedDocument.title,
    sceneOrder,
    sceneSequence: existingEvent?.sceneSequence ??
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
    consumableEffect: pendingPositionedChange.consumableEffect ?? existingEvent?.consumableEffect,
    createdAt: existingEvent?.createdAt ?? now
  };
  return {value: event};
}

export function planRosterReanchor({
  event,
  selectedDocument,
  content,
  sceneCursorPosition,
  sceneCursorAnchor
}: {
  event: StateMutationEvent;
  selectedDocument: WritingDocument;
  content: string;
  sceneCursorPosition: number;
  sceneCursorAnchor: StateMutationTextAnchor;
}): RosterPlanResult<StateMutationEvent> {
  if (selectedDocument.content !== content) {
    return {error: 'Save the scene before re-anchoring this change.'};
  }
  if (!sceneCursorAnchor.before && !sceneCursorAnchor.after) {
    return {error: 'Place the cursor beside the intended scene text first.'};
  }
  return {
    value: {
      ...event,
      scenePosition: sceneCursorPosition,
      sceneAnchor: sceneCursorAnchor,
      sourceRevision: selectedDocument.updatedAt,
      sourceHash: hashSceneContent(selectedDocument.content),
      invalidatedAt: undefined,
      invalidationReason: undefined
    }
  };
}

export function planRosterInvalidation(eventId: string) {
  return {eventId, reason: 'Invalidated from the scene roster timeline.'};
}

export function buildPositionedChangeBefore({
  pendingPositionedSubject,
  selectedDocument,
  documents,
  ruleset,
  resolvedStateMutationEvents,
  pendingPositionedChange,
  actorResolutions,
  sceneCursorPosition
}: {
  pendingPositionedSubject: StateSubject | null;
  selectedDocument: WritingDocument | null;
  documents: WritingDocument[];
  ruleset: StoredRuleset | null;
  resolvedStateMutationEvents: StateMutationEvent[];
  pendingPositionedChange: PendingPositionedChange | null;
  actorResolutions: ActorResolution[];
  sceneCursorPosition: number;
}) {
  if (!pendingPositionedSubject || !selectedDocument)
    return null;
  const sceneOrder = sortWritingDocuments(documents).findIndex((document) => document.id === selectedDocument.id) + 1;
  if (sceneOrder <= 0)
    return null;
  return replayStateSubject({
    subject: pendingPositionedSubject,
    ruleset,
    events: resolvedStateMutationEvents.filter((event) => {
      if (event.id === pendingPositionedChange?.event?.id)
        return false;
      const editingEvent = pendingPositionedChange?.event;
      if (editingEvent?.scenePosition !== undefined &&
        event.sceneId === editingEvent.sceneId &&
        event.scenePosition === editingEvent.scenePosition &&
        (event.sceneSequence ?? Number.MAX_SAFE_INTEGER) >
          (editingEvent.sceneSequence ?? Number.MAX_SAFE_INTEGER)) {
        return false;
      }
      return true;
    }),
    actorResolutions,
    upToSceneOrder: sceneOrder,
    upToScenePosition: pendingPositionedChange?.event?.scenePosition ?? sceneCursorPosition
  });
}
