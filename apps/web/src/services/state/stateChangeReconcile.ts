import type {StateMutationEvent} from '../../entityTypes';

function normalizeCommandValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeCommandValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nestedValue]) => [key, normalizeCommandValue(nestedValue)])
    );
  }
  return value;
}

/**
 * What a change does, for matching re-derived changes to accepted ones. A
 * position's place link (slice 4.77) is left out: it is added after the change
 * is derived, so it must not make an accepted move look different.
 */
function getEventCommandFingerprint(event: StateMutationEvent): string {
  return JSON.stringify(event.commands.map((command) =>
    normalizeCommandValue(command.type === 'location_set' ? {...command, placeId: undefined} : command)
  ));
}

/**
 * Decides what survives when a scene is reviewed again. An accepted change
 * that the new review derives again is kept, with the new scene details. Every
 * other existing change is invalidated, and the remaining new ones are added.
 */
export function reconcileSceneStateMutationEvents(params: {
  existingEvents: StateMutationEvent[];
  nextEvents: StateMutationEvent[];
  invalidationReason: string;
  invalidatedAt: number;
}): {
  eventsToSave: StateMutationEvent[];
  eventsToInvalidate: StateMutationEvent[];
} {
  const pendingNextEvents = [...params.nextEvents];
  const eventsToSave: StateMutationEvent[] = [];
  const eventsToInvalidate: StateMutationEvent[] = [];

  params.existingEvents
    .filter((event) => event.status === 'accepted')
    .forEach((existingEvent) => {
      const existingFingerprint = getEventCommandFingerprint(existingEvent);
      const matchingIndex = pendingNextEvents.findIndex(
        (event) => getEventCommandFingerprint(event) === existingFingerprint
      );
      if (matchingIndex === -1) {
        eventsToInvalidate.push({
          ...existingEvent,
          status: 'invalidated',
          invalidatedAt: params.invalidatedAt,
          invalidationReason: params.invalidationReason
        });
        return;
      }

      const nextEvent = pendingNextEvents.splice(matchingIndex, 1)[0];
      eventsToSave.push({
        ...existingEvent,
        sceneTitle: nextEvent.sceneTitle,
        sceneOrder: nextEvent.sceneOrder,
        sceneSequence: nextEvent.sceneSequence,
        scenePosition: nextEvent.scenePosition,
        sceneAnchor: nextEvent.sceneAnchor,
        label: nextEvent.label,
        sourceRevision: nextEvent.sourceRevision,
        sourceHash: nextEvent.sourceHash,
        invalidatedAt: undefined,
        invalidationReason: undefined,
        status: 'accepted'
      });
    });

  params.existingEvents
    .filter((event) => event.status !== 'accepted')
    .forEach((existingEvent) => {
      eventsToInvalidate.push({
        ...existingEvent,
        status: 'invalidated',
        invalidatedAt: params.invalidatedAt,
        invalidationReason: params.invalidationReason
      });
    });

  eventsToSave.push(...pendingNextEvents);

  return {
    eventsToSave,
    eventsToInvalidate
  };
}
