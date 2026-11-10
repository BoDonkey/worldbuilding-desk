import type {
  AuthoredMeasure,
  EntityCategory,
  PlaceConnection,
  PlaceData,
  PlaceTravelTime,
  WorldEntity
} from '../../entityTypes';
import {isLocationLikeEntity} from './worldBibleEntityPlans';

/*
 * Places: containment and connections (slice 4.76, places brief § 3).
 *
 * A location record may name one parent place; parents nest to any depth and
 * cycles are refused. Connections are stored once, on the record where they
 * were added, and read from both ends. References to deleted records are
 * ignored when read, as World Bible `links` are.
 */

export type PlacesById = ReadonlyMap<string, WorldEntity>;

/** Location records only, by id. */
export const placesById = (categories: EntityCategory[], entities: WorldEntity[]): Map<string, WorldEntity> =>
  new Map(
    entities
      .filter((entity) => isLocationLikeEntity(categories, entity))
      .map((entity) => [entity.id, entity])
  );

/**
 * The places `placeId` sits inside, nearest first. Stops at a missing parent
 * or a cycle in stored data, so a bad record can never hang a lookup.
 */
export const placeAncestors = (placeId: string, places: PlacesById): WorldEntity[] => {
  const ancestors: WorldEntity[] = [];
  const seen = new Set([placeId]);
  let parentId = places.get(placeId)?.place?.parentId;
  while (parentId && !seen.has(parentId)) {
    const parent = places.get(parentId);
    if (!parent) break;
    ancestors.push(parent);
    seen.add(parentId);
    parentId = parent.place?.parentId;
  }
  return ancestors;
};

/** True when `placeId` is `containerId` or anywhere inside it. Being in the tavern is being in the city. */
export const isPlaceWithin = (placeId: string, containerId: string, places: PlacesById): boolean =>
  placeId === containerId || placeAncestors(placeId, places).some((place) => place.id === containerId);

/**
 * Why `parentId` cannot be the parent of `placeId`, or null when it can.
 * Refuses the place itself, a missing or non-location record, and any place
 * already inside `placeId` (which would make a cycle).
 */
export const placeParentProblem = (
  placeId: string,
  parentId: string,
  places: PlacesById
): string | null => {
  const place = places.get(placeId);
  const parent = places.get(parentId);
  if (parentId === placeId) return 'A place cannot be inside itself.';
  if (!parent) return 'That parent place no longer exists.';
  if (isPlaceWithin(parentId, placeId, places)) {
    const name = place?.name ?? 'This place';
    return `${name} cannot be inside ${parent.name}: ${parent.name} is already inside ${name}.`;
  }
  return null;
};

/** Places that can be chosen as the parent of `placeId` (all of them for a new record). */
export const parentPlaceOptions = (placeId: string | null, places: PlacesById): WorldEntity[] =>
  [...places.values()]
    .filter((candidate) => !placeId || placeParentProblem(placeId, candidate.id, places) === null)
    .sort((a, b) => a.name.localeCompare(b.name));

/** Places directly inside `placeId`, by name. */
export const childPlaces = (placeId: string, places: PlacesById): WorldEntity[] =>
  [...places.values()]
    .filter((candidate) => candidate.place?.parentId === placeId && candidate.id !== placeId)
    .sort((a, b) => a.name.localeCompare(b.name));

/** "Tavern › District › City": the place and its ancestors, outermost last. */
export const placePathLabel = (placeId: string, places: PlacesById): string =>
  [places.get(placeId), ...placeAncestors(placeId, places)]
    .filter((place): place is WorldEntity => Boolean(place))
    .map((place) => place.name)
    .join(' › ');

export interface PlaceConnectionView {
  connection: PlaceConnection;
  /** The record that stores the connection. */
  ownerId: string;
  /** The place at the other end, seen from the place being looked at. */
  otherId: string;
  /** `to`: you can travel from this place to the other. `from`: one-way, arriving here only. */
  direction: 'both' | 'to' | 'from';
}

/**
 * Every connection touching `placeId`: the ones it stores and the ones other
 * places store that point at it. Connections to missing places are skipped.
 */
export const connectionsForPlace = (placeId: string, places: PlacesById): PlaceConnectionView[] => {
  const views: PlaceConnectionView[] = [];
  for (const owner of places.values()) {
    for (const connection of owner.place?.connections ?? []) {
      if (owner.id === placeId && places.has(connection.toId) && connection.toId !== placeId) {
        views.push({
          connection,
          ownerId: owner.id,
          otherId: connection.toId,
          direction: connection.oneWay ? 'to' : 'both'
        });
      } else if (connection.toId === placeId && owner.id !== placeId) {
        views.push({
          connection,
          ownerId: owner.id,
          otherId: owner.id,
          direction: connection.oneWay ? 'from' : 'both'
        });
      }
    }
  }
  return views;
};

const cleanText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const cleanMeasure = (value: AuthoredMeasure | undefined): AuthoredMeasure | undefined => {
  if (!value) return undefined;
  const words = cleanText(value.words);
  const amount = typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount >= 0
    ? value.amount
    : undefined;
  const unit = cleanText(value.unit);
  const measure: AuthoredMeasure = {};
  if (words) measure.words = words;
  if (amount !== undefined) measure.amount = amount;
  if (unit && amount !== undefined) measure.unit = unit;
  return measure.words || measure.amount !== undefined ? measure : undefined;
};

const cleanTravelTime = (value: PlaceTravelTime): PlaceTravelTime | null => {
  const mode = cleanText(value.mode);
  const measure = cleanMeasure(value);
  if (!mode || !measure) return null;
  return {mode, ...measure};
};

/**
 * Place data as it should save for `placeId`: trims text, drops empty
 * measures and travel times, connections to itself or to records that are
 * not places, and repeats of the same link. Throws when the parent would make
 * a cycle; the editor only offers valid parents, so this guards stale state.
 * Returns undefined when nothing is left.
 */
export const normalizePlaceData = (
  placeId: string,
  value: PlaceData | undefined,
  places: PlacesById
): PlaceData | undefined => {
  if (!value) return undefined;
  const result: PlaceData = {};
  const parentId = cleanText(value.parentId);
  if (parentId) {
    const problem = placeParentProblem(placeId, parentId, places);
    if (problem) throw new Error(problem);
    result.parentId = parentId;
  }
  const seen = new Set<string>();
  const connections = (value.connections ?? []).flatMap((connection): PlaceConnection[] => {
    const toId = cleanText(connection.toId);
    if (!toId || toId === placeId || !places.has(toId)) return [];
    const kind = cleanText(connection.kind) || 'connection';
    const key = `${toId}\u0000${kind.toLowerCase()}\u0000${connection.oneWay ? 1 : 0}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const next: PlaceConnection = {id: connection.id || crypto.randomUUID(), toId, kind};
    if (connection.oneWay) next.oneWay = true;
    const distance = cleanMeasure(connection.distance);
    if (distance) next.distance = distance;
    const travelTimes = (connection.travelTimes ?? [])
      .map(cleanTravelTime)
      .filter((time): time is PlaceTravelTime => time !== null);
    if (travelTimes.length > 0) next.travelTimes = travelTimes;
    return [next];
  });
  if (connections.length > 0) result.connections = connections;
  return result.parentId || result.connections ? result : undefined;
};

/** "3 days" from a measure: the author's words first, else number and unit. */
export const formatMeasure = (measure: AuthoredMeasure | undefined): string => {
  if (!measure) return '';
  if (measure.words) return measure.words;
  if (measure.amount === undefined) return '';
  return measure.unit ? `${measure.amount} ${measure.unit}` : String(measure.amount);
};

/** One line describing a connection's distance and travel times, or ''. */
export const describeConnectionMeasures = (connection: PlaceConnection): string =>
  [
    formatMeasure(connection.distance),
    ...(connection.travelTimes ?? []).map((time) => `${time.mode}: ${formatMeasure(time)}`)
  ]
    .filter(Boolean)
    .join('; ');
