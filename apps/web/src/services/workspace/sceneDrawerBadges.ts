import type {StateMutationEvent, WritingDocument} from '../../entityTypes';
import {getStateMutationEventStaleness} from '../state/stateMutationStaleness';

/** Open review items per scene, for the scene drawer's badges. */
export function countReviewItemsByScene(
  items: ReadonlyArray<{sceneId: string}>
): Record<string, number> {
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    counts[item.sceneId] = (counts[item.sceneId] ?? 0) + 1;
  });
  return counts;
}

/**
 * Accepted state changes per scene whose source text has changed since they
 * were recorded, for the scene drawer's badges.
 */
export function countStaleStateEventsByScene(
  events: ReadonlyArray<StateMutationEvent>,
  documents: WritingDocument[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  events.forEach((event) => {
    if (event.status !== 'accepted') {
      return;
    }
    if (!getStateMutationEventStaleness({event, documents}).isStale) {
      return;
    }
    counts[event.sceneId] = (counts[event.sceneId] ?? 0) + 1;
  });
  return counts;
}
