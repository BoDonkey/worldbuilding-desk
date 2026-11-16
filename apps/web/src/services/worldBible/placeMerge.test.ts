import {describe, expect, it} from 'vitest';
import type {
  EntityCategory,
  PlaceData,
  StateMutationEvent,
  WorldEntity
} from '../../entityTypes';
import {planPlaceMerge} from './placeMerge';

const categories: EntityCategory[] = [
  {id: 'cat-loc', projectId: 'p', kind: 'general', name: 'Locations', slug: 'locations', fieldSchema: [], createdAt: 0},
  {id: 'cat-item', projectId: 'p', kind: 'general', name: 'Items', slug: 'items', fieldSchema: [], createdAt: 0}
];

const place = (id: string, data?: PlaceData, categoryId = 'cat-loc'): WorldEntity => ({
  id,
  projectId: 'p',
  categoryId,
  name: id,
  fields: {},
  place: data,
  links: [],
  createdAt: 0,
  updatedAt: 0
});

const position = (id: string, placeId: string): StateMutationEvent => ({
  id,
  projectId: 'p',
  sceneId: 'scene-1',
  sceneTitle: 'Scene',
  sceneOrder: 1,
  scenePosition: 0,
  sourceRevision: 1,
  sourceHash: 'hash',
  status: 'accepted',
  commands: [{type: 'location_set', actorId: 'sera', locationName: 'Old Gate', placeId}],
  createdAt: 1
});

const plan = (source: WorldEntity, target: WorldEntity, others: WorldEntity[], events: StateMutationEvent[] = []) =>
  planPlaceMerge({source, target, categories, entities: [source, target, ...others], events});

describe('planPlaceMerge', () => {
  it('moves children, connections, and positions from the source to the target', () => {
    const source = place('old-gate');
    const target = place('gate');
    const inn = place('inn', {parentId: 'old-gate'});
    const road = place('road', {connections: [{id: 'c1', toId: 'old-gate', kind: 'road'}]});
    const result = plan(source, target, [inn, road], [position('e1', 'old-gate'), position('e2', 'road')]);

    expect(result.entities.map((entity) => [entity.id, entity.place])).toEqual([
      ['inn', {parentId: 'gate'}],
      ['road', {connections: [{id: 'c1', toId: 'gate', kind: 'road'}]}]
    ]);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.commands[0]).toMatchObject({placeId: 'gate'});
  });

  it("gives the target the source's connections, map points, and parent", () => {
    const city = place('city');
    const harbor = place('harbor');
    const source = place('old-gate', {
      parentId: 'city',
      connections: [{id: 'c1', toId: 'harbor', kind: 'road'}, {id: 'c2', toId: 'gate', kind: 'road'}],
      placements: [{mapId: 'm1', x: 1, y: 1}, {mapId: 'm2', x: 2, y: 2}]
    });
    const target = place('gate', {placements: [{mapId: 'm1', x: 9, y: 9}]});
    const result = plan(source, target, [city, harbor]);

    expect(result.target.place).toEqual({
      parentId: 'city',
      connections: [{id: 'c1', toId: 'harbor', kind: 'road'}],
      placements: [{mapId: 'm1', x: 9, y: 9}, {mapId: 'm2', x: 2, y: 2}]
    });
  });

  it('puts a target that sat inside the source in the source’s place in the tree', () => {
    const city = place('city');
    const source = place('district', {parentId: 'city'});
    const ward = place('ward', {parentId: 'district'});
    const target = place('square', {parentId: 'ward'});
    const result = plan(source, target, [city, ward]);

    // The square was inside the ward, which was inside the district: no cycle.
    expect(result.target.place).toEqual({parentId: 'city'});
    expect(result.entities).toEqual([expect.objectContaining({id: 'ward', place: {parentId: 'square'}})]);
  });

  it('keeps the target’s own parent and drops the source’s when the source sat inside the target', () => {
    const source = place('back-room', {parentId: 'inn'});
    const target = place('inn');
    const cellar = place('cellar', {parentId: 'back-room'});
    const result = plan(source, target, [cellar]);

    expect(result.target.place).toBeUndefined();
    expect(result.entities).toEqual([expect.objectContaining({id: 'cellar', place: {parentId: 'inn'}})]);
  });

  it('changes nothing when either record is not a place', () => {
    const source = place('sword', undefined, 'cat-item');
    const target = place('gate');
    const inn = place('inn', {parentId: 'gate'});
    expect(plan(source, target, [inn], [position('e1', 'sword')])).toEqual({
      target,
      entities: [],
      events: []
    });
  });
});
