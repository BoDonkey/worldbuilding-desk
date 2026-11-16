import type {
  EntityCategory,
  PlaceData,
  StateMutationEvent,
  WorldEntity
} from '../../entityTypes';
import {isPlaceWithin, normalizePlaceData, placesById, withPlaceData} from './places';

/**
 * Merging one place into another (3.45, review P2). Every reference to the
 * merged-away place moves to the kept one, so nothing is dropped:
 *
 * - places inside the source move inside the target (`parentId`);
 * - connections to the source lead to the target (`toId`);
 * - character positions linked to the source link to the target (`placeId`);
 * - the target gains the source's own connections, its map points on maps the
 *   target is not on, and its parent when the target has none.
 *
 * When the target sits inside the source, the target takes the source's
 * place in the tree. The result passes the place rules; a cycle throws before
 * anything is written. Only a merge between two places changes anything.
 */
export function planPlaceMerge(params: {
  source: WorldEntity;
  /** The merged record about to save. */
  target: WorldEntity;
  categories: EntityCategory[];
  entities: WorldEntity[];
  events: StateMutationEvent[];
}): {target: WorldEntity; entities: WorldEntity[]; events: StateMutationEvent[]} {
  const {source, categories} = params;
  const before = placesById(categories, params.entities);
  const unchanged = {target: params.target, entities: [], events: []};
  if (!before.has(source.id) || !placesById(categories, [params.target]).has(params.target.id)) {
    return unchanged;
  }
  const repoint = (id: string | undefined) => (id === source.id ? params.target.id : id);
  const repointPlace = (place: PlaceData | undefined): PlaceData | undefined =>
    place && {
      ...place,
      parentId: repoint(place.parentId),
      connections: place.connections?.map((connection) => ({
        ...connection,
        toId: repoint(connection.toId) ?? connection.toId
      }))
    };

  const sourcePlace = source.place ?? {};
  const targetPlace = params.target.place ?? {};
  const targetInsideSource = isPlaceWithin(params.target.id, source.id, before);
  const sourceInsideTarget = isPlaceWithin(source.id, params.target.id, before);
  const parentId = targetInsideSource
    ? sourcePlace.parentId
    : targetPlace.parentId ?? (sourceInsideTarget ? undefined : sourcePlace.parentId);
  const mergedTarget: WorldEntity = {
    ...params.target,
    place: repointPlace({
      parentId,
      connections: [...(targetPlace.connections ?? []), ...(sourcePlace.connections ?? [])],
      // The last point per map wins, so the target's own points come last.
      placements: [...(sourcePlace.placements ?? []), ...(targetPlace.placements ?? [])]
    })
  };

  const refersToSource = (entity: WorldEntity) =>
    entity.place?.parentId === source.id ||
    Boolean(entity.place?.connections?.some((connection) => connection.toId === source.id));
  const repointed = params.entities
    .filter((entity) => entity.id !== source.id && entity.id !== params.target.id)
    .filter((entity) => before.has(entity.id) && refersToSource(entity))
    .map((entity) => ({...entity, place: repointPlace(entity.place)}));

  const after = new Map(before);
  after.delete(source.id);
  [mergedTarget, ...repointed].forEach((entity) => after.set(entity.id, entity));
  const withRules = (entity: WorldEntity): WorldEntity =>
    withPlaceData(entity, normalizePlaceData(entity.id, entity.place, after));

  const events = params.events.flatMap((event) => {
    let changed = false;
    const commands = event.commands.map((command) => {
      if (command.type !== 'location_set' || command.placeId !== source.id) return command;
      changed = true;
      return {...command, placeId: params.target.id};
    });
    return changed ? [{...event, commands}] : [];
  });

  return {target: withRules(mergedTarget), entities: repointed.map(withRules), events};
}
