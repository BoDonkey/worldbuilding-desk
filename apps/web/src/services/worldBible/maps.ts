import type {PlacePlacement, UnitConversion, WorldMap} from '../../entityTypes';
import {normalizeNameExact} from '../names/nameMatching';

/*
 * Maps and units (slice 4.79, places brief § 4).
 *
 * Coordinates belong to a map. A map may sit, as one point, on a larger map,
 * and those parents nest; cycles are refused. Each map measures in its own
 * unit; units are only compared through conversions the author sets. Nothing
 * here guesses a conversion.
 */

export type MapsById = ReadonlyMap<string, WorldMap>;

export const mapsById = (maps: WorldMap[]): Map<string, WorldMap> =>
  new Map(maps.map((map) => [map.id, map]));

/** The maps `mapId` sits on, nearest first. Stops at a missing map or a stored cycle. */
export const mapAncestors = (mapId: string, maps: MapsById): WorldMap[] => {
  const chain: WorldMap[] = [];
  const seen = new Set([mapId]);
  let parentId = maps.get(mapId)?.parentPlacement?.mapId;
  while (parentId && !seen.has(parentId)) {
    const parent = maps.get(parentId);
    if (!parent) break;
    chain.push(parent);
    seen.add(parentId);
    parentId = parent.parentPlacement?.mapId;
  }
  return chain;
};

/** Why `parentMapId` cannot hold `mapId`, or null when it can. */
export const mapParentProblem = (
  mapId: string | null,
  parentMapId: string,
  maps: MapsById
): string | null => {
  const parent = maps.get(parentMapId);
  if (!parent) return 'That map no longer exists.';
  if (mapId === null) return null;
  if (parentMapId === mapId) return 'A map cannot sit on itself.';
  if (mapAncestors(parentMapId, maps).some((map) => map.id === mapId)) {
    return `${parent.name} already sits on this map, so this map cannot sit on it.`;
  }
  return null;
};

/** Maps `mapId` could sit on without making a cycle, by name. */
export const parentMapOptions = (mapId: string | null, maps: MapsById): WorldMap[] =>
  [...maps.values()]
    .filter((candidate) => mapParentProblem(mapId, candidate.id, maps) === null)
    .sort((a, b) => a.name.localeCompare(b.name));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export interface MapInput {
  id?: string;
  name: string;
  distanceUnit: string;
  scale: number;
  parentPlacement?: PlacePlacement;
}

/**
 * The map as it should save, or an error message the author can act on.
 * `existing` keeps the image reference and creation time.
 */
export const normalizeMapInput = (params: {
  input: MapInput;
  projectId: string;
  maps: MapsById;
  now: number;
}): {map: WorldMap} | {error: string} => {
  const {input, maps, now} = params;
  const name = input.name.trim();
  const distanceUnit = input.distanceUnit.trim();
  if (!name) return {error: 'Give the map a name.'};
  if (!distanceUnit) return {error: 'Say what distances on this map are measured in, such as miles.'};
  if (!isFiniteNumber(input.scale) || input.scale <= 0) {
    return {error: 'The scale must be a number above zero.'};
  }
  const id = input.id ?? crypto.randomUUID();
  const existing = input.id ? maps.get(input.id) : undefined;
  const duplicate = [...maps.values()].find(
    (map) => map.id !== id && normalizeNameExact(map.name) === normalizeNameExact(name)
  );
  if (duplicate) return {error: `There is already a map called ${duplicate.name}.`};
  let parentPlacement: PlacePlacement | undefined;
  if (input.parentPlacement?.mapId) {
    const problem = mapParentProblem(id, input.parentPlacement.mapId, maps);
    if (problem) return {error: problem};
    if (!isFiniteNumber(input.parentPlacement.x) || !isFiniteNumber(input.parentPlacement.y)) {
      return {error: 'Give the point on the larger map as two numbers.'};
    }
    parentPlacement = {...input.parentPlacement};
  }
  return {
    map: {
      id,
      projectId: params.projectId,
      name,
      ...(existing?.imageRef ? {imageRef: existing.imageRef} : {}),
      distanceUnit,
      scale: input.scale,
      ...(parentPlacement ? {parentPlacement} : {}),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }
  };
};

/**
 * Units compare by name, ignoring case, spacing, and a plural "s":
 * "Miles", "mile", and "miles" are one unit. "feet" and "foot" are not;
 * the author adds a conversion for those.
 */
export const unitKey = (unit: string): string => {
  const key = normalizeNameExact(unit);
  return key.length > 3 && key.endsWith('s') && !key.endsWith('ss') ? key.slice(0, -1) : key;
};

export const sameUnit = (left: string | undefined, right: string | undefined): boolean =>
  unitKey(left ?? '') === unitKey(right ?? '');

/** Conversions as they should save: both units named, a factor above zero, one per pair. */
export const normalizeUnitConversions = (value: UnitConversion[] | undefined): UnitConversion[] => {
  const byPair = new Map<string, UnitConversion>();
  for (const conversion of value ?? []) {
    const from = (conversion?.from ?? '').trim();
    const to = (conversion?.to ?? '').trim();
    if (!from || !to || sameUnit(from, to)) continue;
    if (!isFiniteNumber(conversion.factor) || conversion.factor <= 0) continue;
    byPair.set([unitKey(from), unitKey(to)].sort().join('\u0000'), {from, to, factor: conversion.factor});
  }
  return [...byPair.values()];
};

/**
 * How many `to` one `from` is, following the author's conversions in either
 * direction and through each other (league → mile → furlong). Undefined when
 * no chain of conversions links the two units.
 */
export const unitFactor = (
  from: string,
  to: string,
  conversions: UnitConversion[]
): number | undefined => {
  const start = unitKey(from);
  const goal = unitKey(to);
  if (start === goal) return 1;
  const edges = new Map<string, Array<{unit: string; factor: number}>>();
  const addEdge = (a: string, b: string, factor: number) =>
    edges.set(a, [...(edges.get(a) ?? []), {unit: b, factor}]);
  for (const conversion of normalizeUnitConversions(conversions)) {
    addEdge(unitKey(conversion.from), unitKey(conversion.to), conversion.factor);
    addEdge(unitKey(conversion.to), unitKey(conversion.from), 1 / conversion.factor);
  }
  const factors = new Map([[start, 1]]);
  const queue = [start];
  while (queue.length > 0) {
    const unit = queue.shift()!;
    for (const edge of edges.get(unit) ?? []) {
      if (factors.has(edge.unit)) continue;
      const factor = factors.get(unit)! * edge.factor;
      if (edge.unit === goal) return factor;
      factors.set(edge.unit, factor);
      queue.push(edge.unit);
    }
  }
  return undefined;
};
