import {describe, expect, it} from 'vitest';
import type {
  EntityCategory,
  PlaceConnection,
  StateMutationEvent,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import {buildStateSubjects} from '../state/stateSubjects';
import {buildPlaceNameIndex} from './placePositions';
import {
  characterPath,
  groupPositionsByPlace,
  placeReach,
  positionsAtScene
} from './placeMovement';

const categories: EntityCategory[] = [
  {id: 'cat-loc', projectId: 'p', kind: 'general', name: 'Locations', slug: 'locations', fieldSchema: [], createdAt: 0}
];

const place = (
  id: string,
  name: string,
  extra: {parentId?: string; connections?: PlaceConnection[]} = {}
): WorldEntity => ({
  id, projectId: 'p', categoryId: 'cat-loc', name, fields: {}, links: [],
  place: extra.parentId || extra.connections ? extra : undefined,
  createdAt: 0, updatedAt: 0
});

const road = (toId: string, oneWay = false): PlaceConnection =>
  ({id: `road-${toId}`, toId, kind: 'road', ...(oneWay ? {oneWay: true} : {})});

/*
 * World
 *   Varn ── road ── Kell        Isle (no connections)
 *     Gilded Gull (tavern)        Kell Gate
 *     Varn Market
 */
const entities = [
  place('world', 'World'),
  place('varn', 'Varn', {parentId: 'world', connections: [road('kell')]}),
  place('tavern', 'Gilded Gull', {parentId: 'varn'}),
  place('market', 'Varn Market', {parentId: 'varn'}),
  place('kell', 'Kell', {parentId: 'world'}),
  place('kell-gate', 'Kell Gate', {parentId: 'kell'}),
  place('isle', 'Isle', {parentId: 'world'}),
  place('cove', 'Cove', {parentId: 'world', connections: [road('isle', true)]})
];
const index = buildPlaceNameIndex({categories, entities, aliases: []});

const scenes: WritingDocument[] = [1, 2, 3, 4].map((order) => ({
  id: `scene-${order}`, projectId: 'p', title: `Scene ${order}`, content: '', order,
  createdAt: order, updatedAt: order
}));

const move = (order: number, actorId: string, locationName: string, placeId?: string): StateMutationEvent => ({
  id: `move-${order}-${actorId}`,
  projectId: 'p',
  sceneId: `scene-${order}`,
  sceneOrder: order,
  scenePosition: 0,
  sourceRevision: 1,
  sourceHash: 'h',
  status: 'accepted',
  commands: [{type: 'location_set', actorId, locationName, placeId}],
  createdAt: order
});

const subjects = buildStateSubjects({
  characterSheets: [],
  characterEntities: [{id: 'sera', name: 'Sera'}, {id: 'tam', name: 'Tam'}, {id: 'ivo', name: 'Ivo'}]
});
const sera = subjects[0]!;

const events = [
  move(1, 'sera', 'the tavern', 'tavern'),
  move(1, 'tam', 'Varn Market'),
  move(2, 'sera', 'Gilded Gull', 'tavern'),
  move(3, 'sera', 'Kell'),
  move(3, 'tam', 'Old Mill'),
  move(4, 'sera', 'Kell Gate', 'kell-gate')
];

describe('positions at a scene', () => {
  it('replays each character to the end of the chosen scene', () => {
    const atTwo = positionsAtScene({subjects, events, index, sceneOrder: 2});
    expect(atTwo.map((p) => [p.subject.name, p.placeId, p.label])).toEqual([
      ['Sera', 'tavern', 'Gilded Gull'],
      ['Tam', 'market', 'Varn Market']
    ]);
    const latest = positionsAtScene({subjects, events, index});
    expect(latest.map((p) => [p.subject.name, p.placeId, p.label])).toEqual([
      ['Sera', 'kell-gate', 'Kell Gate'],
      ['Tam', null, 'Old Mill']
    ]);
  });

  it('groups by place with the places around it, unlinked names last', () => {
    const groups = groupPositionsByPlace(positionsAtScene({subjects, events, index}), index.places);
    expect(groups.map((g) => [g.label, g.containers, g.characters.map((c) => c.subject.name)])).toEqual([
      ['Kell Gate', ['Kell', 'World'], ['Sera']],
      ['Old Mill', [], ['Tam']]
    ]);
  });
});

describe('a character path', () => {
  it('lists moves in order, skipping a repeat of the same place', () => {
    const path = characterPath({subject: sera, subjects, events, documents: scenes, index});
    expect(path.map((stop) => [stop.sceneOrder, stop.label, stop.placeId])).toEqual([
      [1, 'Gilded Gull', 'tavern'],
      [3, 'Kell', 'kell'],
      [4, 'Kell Gate', 'kell-gate']
    ]);
  });

  it('limits the path to a range of scenes', () => {
    const path = characterPath({subject: sera, subjects, events, documents: scenes, index, fromOrder: 2, toOrder: 3});
    expect(path.map((stop) => stop.label)).toEqual(['Kell']);
  });
});

describe('how a move is explained by place data', () => {
  it('treats a place and anything inside it as the same trip', () => {
    expect(placeReach('tavern', 'varn', index.places)).toBe('within');
    expect(placeReach('varn', 'tavern', index.places)).toBe('within');
  });

  it('lets a road from a city serve the places inside it', () => {
    expect(placeReach('tavern', 'kell-gate', index.places)).toBe('route');
    expect(placeReach('kell-gate', 'market', index.places)).toBe('route');
  });

  it('does not count the world both places are inside as a route', () => {
    expect(placeReach('varn', 'isle', index.places)).toBe('no-route');
  });

  it('follows one-way connections in their direction only', () => {
    expect(placeReach('cove', 'isle', index.places)).toBe('route');
    expect(placeReach('isle', 'cove', index.places)).toBe('no-route');
  });

  it('has nothing to check when no connection is anywhere near either place', () => {
    expect(placeReach('tavern', 'market', index.places)).toBe('no-travel-data');
  });
});
