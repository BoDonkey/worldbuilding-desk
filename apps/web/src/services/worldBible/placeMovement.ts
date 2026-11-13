import type {StateMutationEvent, WritingDocument} from '../../entityTypes';
import type {ActorResolution} from '../characters/characterIdentity';
import {sortWritingDocuments} from '../storage';
import {getAcceptedStateMutationEvents} from '../state/stateReplay';
import {alignStateMutationEventsToScenes} from '../state/stateSceneOrder';
import {
  buildStateSubjectLookup,
  replayStateSubject,
  type StateSubject
} from '../state/stateSubjects';
import {
  connectionsForPlace,
  isPlaceWithin,
  placeAncestors,
  type PlacesById
} from './places';
import {matchPlaceId, positionLabel, type PlaceNameIndex} from './placePositions';

/*
 * Where is everyone, and how did they get there (slice 4.78, places brief § 7).
 *
 * Positions come from replaying the accepted ledger, never from prose. A
 * position resolves to a place record by its stored id, or by a name that
 * means exactly one place; anything else is shown as the text written.
 */

/** The place a position means: its live record id, else the one place its name matches. */
export const resolvePositionPlaceId = (
  position: {locationName?: string; locationPlaceId?: string},
  index: PlaceNameIndex
): string | null => {
  if (position.locationPlaceId && index.places.has(position.locationPlaceId)) {
    return position.locationPlaceId;
  }
  return position.locationName ? matchPlaceId(position.locationName, index) : null;
};

export interface CharacterPosition {
  subject: StateSubject;
  placeId: string | null;
  /** The place's current name, or the text the author wrote. */
  label: string;
}

/**
 * Each character's position at the end of the scene with 1-based manuscript
 * order `sceneOrder` (all accepted changes when omitted). Characters with no
 * recorded position are left out.
 */
export const positionsAtScene = (params: {
  subjects: StateSubject[];
  events: StateMutationEvent[];
  index: PlaceNameIndex;
  sceneOrder?: number;
  actorResolutions?: ActorResolution[];
}): CharacterPosition[] =>
  params.subjects.flatMap((subject) => {
    const state = replayStateSubject({
      subject,
      ruleset: null,
      events: params.events,
      actorResolutions: params.actorResolutions,
      upToSceneOrder: params.sceneOrder
    });
    const label = positionLabel(state, params.index.places);
    if (!label) return [];
    return [{subject, placeId: resolvePositionPlaceId(state, params.index), label}];
  });

export interface PlaceGroup {
  /** Null for positions that name no place record. */
  placeId: string | null;
  label: string;
  /** Outer places, nearest first, for "inside District › City". */
  containers: string[];
  characters: CharacterPosition[];
}

/** Positions grouped by place, places by name, unlinked names last. */
export const groupPositionsByPlace = (
  positions: CharacterPosition[],
  places: PlacesById
): PlaceGroup[] => {
  const groups = new Map<string, PlaceGroup>();
  positions.forEach((position) => {
    const key = position.placeId ?? `text:${position.label.toLowerCase()}`;
    const group = groups.get(key) ?? {
      placeId: position.placeId,
      label: position.label,
      containers: position.placeId
        ? placeAncestors(position.placeId, places).map((place) => place.name)
        : [],
      characters: []
    };
    group.characters.push(position);
    groups.set(key, group);
  });
  return [...groups.values()]
    .map((group) => ({
      ...group,
      characters: group.characters.sort((a, b) => a.subject.name.localeCompare(b.subject.name))
    }))
    .sort((a, b) =>
      Number(a.placeId === null) - Number(b.placeId === null) || a.label.localeCompare(b.label)
    );
};

export interface PathStop {
  eventId: string;
  sceneId: string;
  sceneTitle: string;
  /** 1-based manuscript order of the scene, or 0 when the scene is gone. */
  sceneOrder: number;
  scenePosition?: number;
  placeId: string | null;
  label: string;
}

/**
 * Every accepted move for one character, in manuscript order. `fromOrder`
 * and `toOrder` (1-based, inclusive) limit the scenes. A move that repeats
 * the place the character is already at is skipped.
 */
export const characterPath = (params: {
  subject: StateSubject;
  subjects: StateSubject[];
  events: StateMutationEvent[];
  documents: WritingDocument[];
  index: PlaceNameIndex;
  actorResolutions?: ActorResolution[];
  fromOrder?: number;
  toOrder?: number;
}): PathStop[] => {
  const lookup = buildStateSubjectLookup(params.subjects, params.actorResolutions);
  const ordered = sortWritingDocuments(params.documents);
  const orderById = new Map(ordered.map((scene, i) => [scene.id, i + 1]));
  const titleById = new Map(ordered.map((scene) => [scene.id, scene.title]));
  const stops: PathStop[] = [];
  // Walk moves in the current scene order, not the order stored on each change.
  getAcceptedStateMutationEvents(
    alignStateMutationEventsToScenes(params.events, params.documents)
  ).forEach((event) => {
    event.commands.forEach((command) => {
      if (command.type !== 'location_set' || lookup.get(command.actorId) !== params.subject) return;
      const position = {locationName: command.locationName, locationPlaceId: command.placeId};
      const placeId = resolvePositionPlaceId(position, params.index);
      const label = positionLabel(position, params.index.places) ?? command.locationName;
      const last = stops[stops.length - 1];
      if (last && (placeId ? last.placeId === placeId : last.label.toLowerCase() === label.toLowerCase())) return;
      stops.push({
        eventId: event.id,
        sceneId: event.sceneId,
        sceneTitle: titleById.get(event.sceneId) || event.sceneTitle || 'Untitled scene',
        sceneOrder: orderById.get(event.sceneId) ?? 0,
        scenePosition: event.scenePosition,
        placeId,
        label
      });
    });
  });
  return stops.filter((stop) =>
    (params.fromOrder === undefined || stop.sceneOrder >= params.fromOrder) &&
    (params.toOrder === undefined || stop.sceneOrder <= params.toOrder)
  );
};

/**
 * How a move from one place to another is explained by the place data:
 * - `within`: one place is the other or is inside it.
 * - `route`: a chain of connections links them.
 * - `no-route`: connections exist around these places, but none reach.
 * - `no-travel-data`: neither place, nor anything it is inside, has a
 *   connection, so there is nothing to check against.
 *
 * A connection on a place also serves everything inside it: a road from the
 * city serves its tavern. Places both ends are inside (the shared world or
 * region) do not count, or every move inside them would pass.
 */
export type PlaceReach = 'within' | 'route' | 'no-route' | 'no-travel-data';

export const placeReach = (fromId: string, toId: string, places: PlacesById): PlaceReach => {
  if (isPlaceWithin(fromId, toId, places) || isPlaceWithin(toId, fromId, places)) return 'within';
  const chain = (id: string) => [id, ...placeAncestors(id, places).map((place) => place.id)];
  const fromChain = chain(fromId);
  const toChain = chain(toId);
  const shared = new Set(fromChain.filter((id) => toChain.includes(id)));
  const starts = fromChain.filter((id) => !shared.has(id));
  const targets = new Set(toChain.filter((id) => !shared.has(id)));
  const hasConnections = (ids: Iterable<string>) =>
    [...ids].some((id) => connectionsForPlace(id, places).length > 0);
  if (!hasConnections(starts) && !hasConnections(targets)) return 'no-travel-data';

  // A place reached by travel also gives access to everything around and inside it.
  const seen = new Set<string>();
  const queue = [...starts];
  const insideOf = (id: string) =>
    [...places.values()].filter((place) => place.id !== id && isPlaceWithin(place.id, id, places));
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    if (targets.has(id)) return 'route';
    connectionsForPlace(id, places)
      .filter((view) => view.direction !== 'from')
      .forEach((view) => {
        const next = [
          view.otherId,
          ...placeAncestors(view.otherId, places).map((place) => place.id),
          ...insideOf(view.otherId).map((place) => place.id)
        ];
        next.forEach((nextId) => {
          if (!seen.has(nextId) && !shared.has(nextId)) queue.push(nextId);
        });
      });
  }
  return 'no-route';
};
