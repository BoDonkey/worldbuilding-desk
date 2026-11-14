import {describe, expect, it} from 'vitest';
import type {EntityCategory, PlaceData, WorldEntity} from '../../entityTypes';
import {
  childPlaces,
  connectionsForPlace,
  describeConnectionMeasures,
  isPlaceWithin,
  normalizePlaceData,
  parentPlaceOptions,
  placeAncestors,
  placeParentProblem,
  placePathLabel,
  placesById
} from './places';

const categories: EntityCategory[] = [
  {id: 'cat-loc', projectId: 'p', kind: 'general', name: 'Locations', slug: 'locations', fieldSchema: [], createdAt: 0},
  {id: 'cat-item', projectId: 'p', kind: 'general', name: 'Items', slug: 'items', fieldSchema: [], createdAt: 0}
];

const place = (id: string, name: string, data?: PlaceData, categoryId = 'cat-loc'): WorldEntity => ({
  id,
  projectId: 'p',
  categoryId,
  name,
  fields: {},
  place: data,
  links: [],
  createdAt: 0,
  updatedAt: 0
});

const world = (...entities: WorldEntity[]) => placesById(categories, entities);

describe('placesById', () => {
  it('keeps only location records', () => {
    const map = world(place('a', 'Ash'), place('sword', 'Sword', undefined, 'cat-item'));
    expect([...map.keys()]).toEqual(['a']);
  });
});

describe('containment', () => {
  const places = world(
    place('tavern', 'Tavern', {parentId: 'district'}),
    place('district', 'Dock District', {parentId: 'city'}),
    place('city', 'Varn', {parentId: 'region'}),
    place('region', 'The Reach'),
    place('farm', 'Farm', {parentId: 'region'})
  );

  it('lists ancestors nearest first, to any depth', () => {
    expect(placeAncestors('tavern', places).map((entry) => entry.id)).toEqual(['district', 'city', 'region']);
    expect(placeAncestors('region', places)).toEqual([]);
  });

  it('treats being in a place as being in everything that contains it', () => {
    expect(isPlaceWithin('tavern', 'city', places)).toBe(true);
    expect(isPlaceWithin('tavern', 'tavern', places)).toBe(true);
    expect(isPlaceWithin('city', 'tavern', places)).toBe(false);
    expect(isPlaceWithin('farm', 'city', places)).toBe(false);
  });

  it('lists direct children by name and builds a path label', () => {
    expect(childPlaces('region', places).map((entry) => entry.id)).toEqual(['farm', 'city']);
    expect(placePathLabel('tavern', places)).toBe('Tavern › Dock District › Varn › The Reach');
  });

  it('stops at missing parents and stored cycles instead of looping', () => {
    const broken = world(
      place('a', 'A', {parentId: 'b'}),
      place('b', 'B', {parentId: 'a'}),
      place('c', 'C', {parentId: 'deleted'})
    );
    expect(placeAncestors('a', broken).map((entry) => entry.id)).toEqual(['b']);
    expect(placeAncestors('c', broken)).toEqual([]);
  });
});

describe('cycle refusal', () => {
  const places = world(
    place('tavern', 'Tavern', {parentId: 'city'}),
    place('city', 'Varn', {parentId: 'region'}),
    place('region', 'The Reach'),
    place('other', 'Elsewhere')
  );

  it('refuses the place itself and any place already inside it', () => {
    expect(placeParentProblem('city', 'city', places)).toBe('A place cannot be inside itself.');
    expect(placeParentProblem('region', 'tavern', places)).toBe(
      'The Reach cannot be inside Tavern: Tavern is already inside The Reach.'
    );
    expect(placeParentProblem('region', 'city', places)).not.toBeNull();
    expect(placeParentProblem('region', 'other', places)).toBeNull();
    expect(placeParentProblem('tavern', 'region', places)).toBeNull();
  });

  it('refuses parents that are not places', () => {
    expect(placeParentProblem('tavern', 'missing', places)).toBe('That parent place no longer exists.');
  });

  it('offers only parents that cannot make a cycle', () => {
    expect(parentPlaceOptions('region', places).map((entry) => entry.id)).toEqual(['other']);
    expect(parentPlaceOptions(null, places).map((entry) => entry.id)).toEqual(['other', 'tavern', 'region', 'city']);
  });

  it('throws on save when the parent would make a cycle', () => {
    expect(() => normalizePlaceData('region', {parentId: 'tavern'}, places)).toThrow(
      'Tavern is already inside The Reach'
    );
  });
});

describe('connections', () => {
  const places = world(
    place('varn', 'Varn', {
      connections: [
        {id: 'c1', toId: 'ford', kind: 'road', distance: {words: 'three days', amount: 40, unit: 'miles'}},
        {id: 'c2', toId: 'pit', kind: 'chute', oneWay: true},
        {id: 'c3', toId: 'deleted', kind: 'road'}
      ]
    }),
    place('ford', 'Ford'),
    place('pit', 'Pit', {connections: [{id: 'c4', toId: 'ford', kind: 'tunnel'}]})
  );

  it('reads stored and incoming connections from both ends', () => {
    expect(connectionsForPlace('varn', places).map((view) => [view.otherId, view.direction])).toEqual([
      ['ford', 'both'],
      ['pit', 'to']
    ]);
    expect(connectionsForPlace('pit', places).map((view) => [view.otherId, view.direction, view.ownerId])).toEqual([
      ['varn', 'from', 'varn'],
      ['ford', 'both', 'pit']
    ]);
    expect(connectionsForPlace('ford', places).map((view) => view.otherId)).toEqual(['varn', 'pit']);
  });

  it('describes distance and travel times in the author’s words first', () => {
    expect(describeConnectionMeasures({
      id: 'x',
      toId: 'y',
      kind: 'road',
      distance: {amount: 40, unit: 'miles'},
      travelTimes: [{mode: 'on foot', words: '3 days'}, {mode: 'by horse', amount: 1, unit: 'day'}]
    })).toBe('40 miles; on foot: 3 days; by horse: 1 day');
  });
});

describe('normalizePlaceData', () => {
  const places = world(place('a', 'A'), place('b', 'B'), place('c', 'C'));

  it('keeps one placement per map with numeric coordinates (4.79)', () => {
    expect(normalizePlaceData('a', {
      placements: [
        {mapId: 'region', x: 1, y: 2},
        {mapId: ' region ', x: 5, y: 6},
        {mapId: 'city', x: Number.NaN, y: 1},
        {mapId: '', x: 0, y: 0}
      ]
    }, places)).toEqual({placements: [{mapId: 'region', x: 5, y: 6}]});
    expect(normalizePlaceData('a', {placements: [{mapId: 'city', x: Number.NaN, y: 1}]}, places)).toBeUndefined();
  });

  it('trims, drops empty measures, and drops links to itself, non-places, and repeats', () => {
    const result = normalizePlaceData('a', {
      parentId: '  b ',
      connections: [
        {id: 'k1', toId: 'c', kind: ' river ', distance: {words: ' ', unit: 'miles'}, travelTimes: [
          {mode: 'by boat', words: ' two days '},
          {mode: '', words: 'never'},
          {mode: 'on foot'}
        ]},
        {id: 'k2', toId: 'c', kind: 'River'},
        {id: 'k3', toId: 'a', kind: 'loop'},
        {id: 'k4', toId: 'nowhere', kind: 'road'},
        {id: '', toId: 'b', kind: '', oneWay: true, distance: {amount: 2, unit: ' leagues '}}
      ]
    }, places);
    expect(result?.parentId).toBe('b');
    expect(result?.connections).toHaveLength(2);
    expect(result?.connections?.[0]).toEqual({
      id: 'k1', toId: 'c', kind: 'river', travelTimes: [{mode: 'by boat', words: 'two days'}]
    });
    expect(result?.connections?.[1]).toMatchObject({
      toId: 'b', kind: 'connection', oneWay: true, distance: {amount: 2, unit: 'leagues'}
    });
    expect(result?.connections?.[1].id).toMatch(/.+/);
  });

  it('returns undefined when nothing is left', () => {
    expect(normalizePlaceData('a', {parentId: '', connections: [{id: 'x', toId: 'a', kind: 'road'}]}, places))
      .toBeUndefined();
    expect(normalizePlaceData('a', undefined, places)).toBeUndefined();
  });
});
