import type {AuthoredMeasure, PlaceConnection, UnitConversion} from '../../entityTypes';
import {normalizeNameExact} from '../names/nameMatching';
import {mapAncestors, unitFactor, unitKey, type MapsById} from './maps';
import {connectionsForPlace, formatMeasure, type PlacesById} from './places';

/*
 * Distance between two places (slice 4.79, places brief § 5). The most
 * trusted source wins, and every figure says where it came from:
 *
 * 1. Authored: a distance or travel time on a connection between the two.
 * 2. Route: the shortest chain of connections, adding up authored legs.
 * 3. Straight line: placements on a shared map, times the map's scale.
 *
 * A straight-line figure never replaces an authored or route one. Figures in
 * units the author has not linked with a conversion are returned side by
 * side and never compared or added together.
 */

export type DistanceSource =
  | {kind: 'authored'; connectionId: string; ownerId: string; connectionKind: string}
  | {kind: 'route'; placeIds: string[]}
  | {kind: 'straight-line'; mapId: string};

export interface DistanceFigure {
  measure: AuthoredMeasure;
  source: DistanceSource;
}

export interface TravelTimeFigure extends DistanceFigure {
  mode: string;
}

export interface PlaceDistance {
  distances: DistanceFigure[];
  travelTimes: TravelTimeFigure[];
}

interface Leg {
  fromId: string;
  toId: string;
  amount: number;
  unit: string;
}

/** Connections as one-way legs: two-way connections give a leg each way. */
const legsFor = (
  places: PlacesById,
  measureOf: (connection: PlaceConnection) => AuthoredMeasure | undefined
): Leg[] => {
  const legs: Leg[] = [];
  for (const owner of places.values()) {
    for (const connection of owner.place?.connections ?? []) {
      if (!places.has(connection.toId) || connection.toId === owner.id) continue;
      const measure = measureOf(connection);
      if (measure?.amount === undefined) continue;
      const leg = {amount: measure.amount, unit: measure.unit ?? ''};
      legs.push({fromId: owner.id, toId: connection.toId, ...leg});
      if (!connection.oneWay) legs.push({fromId: connection.toId, toId: owner.id, ...leg});
    }
  }
  return legs;
};

/**
 * Groups units that the author's conversions link, each with the unit its
 * route totals are given in: the one most legs use (then alphabetical).
 */
const unitFamilies = (legs: Leg[], conversions: UnitConversion[]) => {
  const counts = new Map<string, {unit: string; count: number}>();
  for (const leg of legs) {
    const key = unitKey(leg.unit);
    const entry = counts.get(key) ?? {unit: leg.unit, count: 0};
    counts.set(key, {...entry, count: entry.count + 1});
  }
  const families: Array<{reference: string; members: Map<string, number>}> = [];
  for (const [key, {unit}] of counts) {
    const family = families.find((candidate) =>
      unitFactor(unit, candidate.reference, conversions) !== undefined
    );
    if (family) family.members.set(key, unitFactor(unit, family.reference, conversions)!);
    else families.push({reference: unit, members: new Map([[key, 1]])});
  }
  return families.map((family) => {
    const reference = [...family.members.keys()]
      .map((key) => counts.get(key)!)
      .sort((a, b) => b.count - a.count || a.unit.localeCompare(b.unit))[0].unit;
    const toReference = new Map(
      [...family.members.keys()].map((key) => [key, unitFactor(counts.get(key)!.unit, reference, conversions)!])
    );
    return {reference, toReference};
  });
};

/** The shortest chain of legs from → to (Dijkstra), as place ids, with its total. */
const shortestPath = (
  legs: Leg[],
  weight: (leg: Leg) => number | undefined,
  fromId: string,
  toId: string
): {placeIds: string[]; total: number} | null => {
  const outgoing = new Map<string, Array<{toId: string; weight: number}>>();
  for (const leg of legs) {
    const value = weight(leg);
    if (value === undefined) continue;
    outgoing.set(leg.fromId, [...(outgoing.get(leg.fromId) ?? []), {toId: leg.toId, weight: value}]);
  }
  const best = new Map<string, number>([[fromId, 0]]);
  const previous = new Map<string, string>();
  const done = new Set<string>();
  while (true) {
    let current: string | null = null;
    for (const [id, distance] of best) {
      if (!done.has(id) && (current === null || distance < best.get(current)!)) current = id;
    }
    if (current === null) return null;
    if (current === toId) break;
    done.add(current);
    for (const edge of outgoing.get(current) ?? []) {
      const next = best.get(current)! + edge.weight;
      if (next < (best.get(edge.toId) ?? Infinity)) {
        best.set(edge.toId, next);
        previous.set(edge.toId, current);
      }
    }
  }
  const placeIds = [toId];
  while (placeIds[0] !== fromId) placeIds.unshift(previous.get(placeIds[0])!);
  return {placeIds, total: best.get(toId)!};
};

/** One route figure per family of linked units that connects the two places. */
const routeFigures = (
  legs: Leg[],
  fromId: string,
  toId: string,
  conversions: UnitConversion[]
): DistanceFigure[] =>
  unitFamilies(legs, conversions).flatMap((family) => {
    const path = shortestPath(
      legs,
      (leg) => {
        const factor = family.toReference.get(unitKey(leg.unit));
        return factor === undefined ? undefined : leg.amount * factor;
      },
      fromId,
      toId
    );
    if (!path || path.placeIds.length < 3) return [];
    return [{
      measure: {amount: path.total, ...(family.reference ? {unit: family.reference} : {})},
      source: {kind: 'route' as const, placeIds: path.placeIds}
    }];
  });

/** Every point `placeId` has on any map, lifted onto the maps those maps sit on. */
const liftedPositions = (placeId: string, places: PlacesById, maps: MapsById) => {
  const positions = new Map<string, {x: number; y: number; depth: number}>();
  for (const placement of places.get(placeId)?.place?.placements ?? []) {
    const map = maps.get(placement.mapId);
    if (!map) continue;
    const chain = [{mapId: map.id, x: placement.x, y: placement.y}];
    let child = map;
    for (const parent of mapAncestors(map.id, maps)) {
      const point = child.parentPlacement!;
      chain.push({mapId: parent.id, x: point.x, y: point.y});
      child = parent;
    }
    chain.forEach((point, depth) => {
      const known = positions.get(point.mapId);
      if (!known || depth < known.depth) positions.set(point.mapId, {x: point.x, y: point.y, depth});
    });
  }
  return positions;
};

/**
 * Straight-line figures on the most detailed maps both places share. Two
 * places on the city map are measured there, not on the region map where
 * the whole city is one point.
 */
const straightLineFigures = (
  fromId: string,
  toId: string,
  places: PlacesById,
  maps: MapsById
): DistanceFigure[] => {
  const from = liftedPositions(fromId, places, maps);
  const to = liftedPositions(toId, places, maps);
  const shared = [...from.keys()]
    .filter((mapId) => to.has(mapId))
    .map((mapId) => ({mapId, a: from.get(mapId)!, b: to.get(mapId)!}))
    .map((entry) => ({...entry, depth: entry.a.depth + entry.b.depth}));
  if (shared.length === 0) return [];
  const finest = Math.min(...shared.map((entry) => entry.depth));
  return shared
    .filter((entry) => entry.depth === finest)
    .sort((left, right) => maps.get(left.mapId)!.name.localeCompare(maps.get(right.mapId)!.name))
    .map((entry) => {
      const map = maps.get(entry.mapId)!;
      const amount = Math.hypot(entry.a.x - entry.b.x, entry.a.y - entry.b.y) * map.scale;
      return {
        measure: {amount, unit: map.distanceUnit},
        source: {kind: 'straight-line' as const, mapId: map.id}
      };
    });
};

export const placeDistance = (params: {
  fromId: string;
  toId: string;
  places: PlacesById;
  maps: MapsById;
  conversions?: UnitConversion[];
}): PlaceDistance => {
  const {fromId, toId, places, maps} = params;
  const conversions = params.conversions ?? [];
  if (fromId === toId || !places.has(fromId) || !places.has(toId)) {
    return {distances: [], travelTimes: []};
  }

  const direct = connectionsForPlace(fromId, places).filter(
    (view) => view.otherId === toId && view.direction !== 'from'
  );
  const authoredSource = (view: (typeof direct)[number]): DistanceSource => ({
    kind: 'authored',
    connectionId: view.connection.id,
    ownerId: view.ownerId,
    connectionKind: view.connection.kind
  });

  const authoredDistances = direct.flatMap((view) =>
    view.connection.distance ? [{measure: view.connection.distance, source: authoredSource(view)}] : []
  );
  const distances = authoredDistances.length > 0
    ? authoredDistances
    : (() => {
        const routes = routeFigures(legsFor(places, (connection) => connection.distance), fromId, toId, conversions);
        return routes.length > 0 ? routes : straightLineFigures(fromId, toId, places, maps);
      })();

  const authoredTimes: TravelTimeFigure[] = direct.flatMap((view) =>
    (view.connection.travelTimes ?? []).map((time) => {
      const {mode, ...measure} = time;
      return {mode, measure, source: authoredSource(view)};
    })
  );
  const authoredModes = new Set(authoredTimes.map((time) => normalizeNameExact(time.mode)));
  const otherModes = new Map<string, string>();
  for (const place of places.values()) {
    for (const connection of place.place?.connections ?? []) {
      for (const time of connection.travelTimes ?? []) {
        const key = normalizeNameExact(time.mode);
        if (key && !authoredModes.has(key) && !otherModes.has(key)) otherModes.set(key, time.mode);
      }
    }
  }
  const routeTimes: TravelTimeFigure[] = [...otherModes].flatMap(([key, mode]) =>
    routeFigures(
      legsFor(places, (connection) =>
        connection.travelTimes?.find((time) => normalizeNameExact(time.mode) === key)
      ),
      fromId,
      toId,
      conversions
    ).map((figure) => ({...figure, mode}))
  );

  return {distances, travelTimes: [...authoredTimes, ...routeTimes]};
};

/** "40" or "2.5": whole numbers from 10 up, one decimal below. */
const roundAmount = (amount: number): string =>
  String(amount >= 10 ? Math.round(amount) : Math.round(amount * 10) / 10);

/**
 * One line for a figure, naming its source: "3 days — authored on the road",
 * "12 leagues — route via Ford, Mill", "about 40 miles — straight line on
 * Region".
 */
export const describeDistanceFigure = (
  figure: DistanceFigure,
  places: PlacesById,
  maps: MapsById
): string => {
  const {measure, source} = figure;
  if (source.kind === 'authored') {
    return `${formatMeasure(measure)} — authored on the ${source.connectionKind}`;
  }
  const amount = measure.amount === undefined ? '' : roundAmount(measure.amount);
  const value = [amount, measure.unit].filter(Boolean).join(' ');
  if (source.kind === 'route') {
    const via = source.placeIds.slice(1, -1).map((id) => places.get(id)?.name ?? 'a missing place');
    return `${value} — route via ${via.join(', ')}`;
  }
  return `about ${value} — straight line on ${maps.get(source.mapId)?.name ?? 'a missing map'}`;
};
