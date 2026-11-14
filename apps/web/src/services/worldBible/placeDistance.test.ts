import {describe, expect, it} from 'vitest';
import type {EntityCategory, PlaceConnection, PlaceData, WorldEntity, WorldMap} from '../../entityTypes';
import {mapsById} from './maps';
import {describeDistanceFigure, placeDistance} from './placeDistance';
import {placesById} from './places';

const categories: EntityCategory[] = [
  {id: 'cat-loc', projectId: 'p', kind: 'general', name: 'Locations', slug: 'locations', fieldSchema: [], createdAt: 0}
];

const place = (id: string, data?: PlaceData): WorldEntity => ({
  id, projectId: 'p', categoryId: 'cat-loc', name: id[0].toUpperCase() + id.slice(1),
  fields: {}, place: data, links: [], createdAt: 0, updatedAt: 0
});

const road = (toId: string, extra: Partial<PlaceConnection> = {}): PlaceConnection => ({
  id: `road-${toId}-${Math.random()}`, toId, kind: 'road', ...extra
});

const map = (id: string, distanceUnit: string, scale: number, extra: Partial<WorldMap> = {}): WorldMap => ({
  id, projectId: 'p', name: id[0].toUpperCase() + id.slice(1), distanceUnit, scale,
  createdAt: 0, updatedAt: 0, ...extra
});

const distance = (entities: WorldEntity[], fromId: string, toId: string, maps: WorldMap[] = [], conversions = []) =>
  placeDistance({fromId, toId, places: placesById(categories, entities), maps: mapsById(maps), conversions});

describe('authored distance', () => {
  it('uses a distance written on a connection, from either end of a two-way link', () => {
    const entities = [
      place('ash', {connections: [road('ford', {distance: {words: 'a long day', amount: 30, unit: 'miles'}})]}),
      place('ford')
    ];
    const there = distance(entities, 'ash', 'ford');
    const back = distance(entities, 'ford', 'ash');
    expect(there.distances).toHaveLength(1);
    expect(there.distances[0].source).toMatchObject({kind: 'authored', ownerId: 'ash', connectionKind: 'road'});
    expect(back.distances[0].measure.amount).toBe(30);
  });

  it('does not travel a one-way connection backwards', () => {
    const entities = [
      place('ash', {connections: [road('ford', {oneWay: true, distance: {amount: 30, unit: 'miles'}})]}),
      place('ford')
    ];
    expect(distance(entities, 'ford', 'ash').distances).toEqual([]);
  });

  it('wins over a straight line', () => {
    const entities = [
      place('ash', {
        connections: [road('ford', {distance: {amount: 30, unit: 'miles'}})],
        placements: [{mapId: 'region', x: 0, y: 0}]
      }),
      place('ford', {placements: [{mapId: 'region', x: 3, y: 4}]})
    ];
    const result = distance(entities, 'ash', 'ford', [map('region', 'miles', 1)]);
    expect(result.distances.map((figure) => figure.source.kind)).toEqual(['authored']);
  });

  it('returns authored travel times by mode', () => {
    const entities = [
      place('ash', {connections: [road('ford', {travelTimes: [{mode: 'on foot', amount: 3, unit: 'days'}]})]}),
      place('ford')
    ];
    const result = distance(entities, 'ash', 'ford');
    expect(result.travelTimes).toEqual([
      expect.objectContaining({mode: 'on foot', measure: {amount: 3, unit: 'days'}})
    ]);
  });
});

describe('route distance', () => {
  it('adds up the legs of the shortest chain of connections', () => {
    const entities = [
      place('ash', {connections: [
        road('ford', {distance: {amount: 10, unit: 'miles'}}),
        road('hill', {distance: {amount: 2, unit: 'miles'}})
      ]}),
      place('ford', {connections: [road('mill', {distance: {amount: 10, unit: 'miles'}})]}),
      place('hill', {connections: [road('mill', {distance: {amount: 3, unit: 'mile'}})]}),
      place('mill')
    ];
    const [figure] = distance(entities, 'ash', 'mill').distances;
    expect(figure.measure).toEqual({amount: 5, unit: 'miles'});
    expect(figure.source).toEqual({kind: 'route', placeIds: ['ash', 'hill', 'mill']});
  });

  it('adds legs in different units only through the author\'s conversions', () => {
    const entities = [
      place('ash', {connections: [road('ford', {distance: {amount: 2, unit: 'leagues'}})]}),
      place('ford', {connections: [road('mill', {distance: {amount: 4, unit: 'miles'}})]}),
      place('mill')
    ];
    expect(distance(entities, 'ash', 'mill').distances).toEqual([]);
    const converted = distance(entities, 'ash', 'mill', [], [{from: 'league', to: 'mile', factor: 3}] as never);
    expect(converted.distances).toHaveLength(1);
    // One leg in each unit: the total is given in the first unit alphabetically.
    expect(converted.distances[0].measure.unit).toBe('leagues');
    expect(converted.distances[0].measure.amount).toBeCloseTo(2 + 4 / 3);
  });

  it('routes travel times for a mode only along legs that have that mode', () => {
    const entities = [
      place('ash', {connections: [road('ford', {travelTimes: [{mode: 'By horse', amount: 1, unit: 'day'}]})]}),
      place('ford', {connections: [road('mill', {travelTimes: [{mode: 'by horse', amount: 2, unit: 'days'}]})]}),
      place('mill')
    ];
    const result = distance(entities, 'ash', 'mill');
    expect(result.travelTimes).toHaveLength(1);
    expect(result.travelTimes[0].measure.amount).toBe(3);
  });
});

describe('straight-line distance', () => {
  it('measures on a shared map, times its scale', () => {
    const entities = [
      place('ash', {placements: [{mapId: 'region', x: 0, y: 0}]}),
      place('ford', {placements: [{mapId: 'region', x: 30, y: 40}]})
    ];
    const [figure] = distance(entities, 'ash', 'ford', [map('region', 'leagues', 0.5)]).distances;
    expect(figure.measure).toEqual({amount: 25, unit: 'leagues'});
    expect(figure.source).toEqual({kind: 'straight-line', mapId: 'region'});
  });

  it('measures across maps through where a map sits on a larger one', () => {
    const maps = [
      map('region', 'miles', 1),
      map('city', 'feet', 1, {parentPlacement: {mapId: 'region', x: 6, y: 8}})
    ];
    const entities = [
      place('tavern', {placements: [{mapId: 'city', x: 100, y: 100}]}),
      place('ford', {placements: [{mapId: 'region', x: 0, y: 0}]})
    ];
    const [figure] = distance(entities, 'tavern', 'ford', maps).distances;
    expect(figure.measure).toEqual({amount: 10, unit: 'miles'});
    expect(figure.source).toEqual({kind: 'straight-line', mapId: 'region'});
  });

  it('prefers the most detailed map both places are on', () => {
    const maps = [
      map('region', 'miles', 1),
      map('city', 'feet', 2, {parentPlacement: {mapId: 'region', x: 6, y: 8}})
    ];
    const entities = [
      place('tavern', {placements: [{mapId: 'city', x: 0, y: 0}]}),
      place('gate', {placements: [{mapId: 'city', x: 0, y: 50}]})
    ];
    const [figure] = distance(entities, 'tavern', 'gate', maps).distances;
    expect(figure.measure).toEqual({amount: 100, unit: 'feet'});
  });

  it('shows figures from maps in different units side by side', () => {
    const maps = [map('north', 'miles', 1), map('south', 'leagues', 1)];
    const entities = [
      place('ash', {placements: [{mapId: 'north', x: 0, y: 0}, {mapId: 'south', x: 0, y: 0}]}),
      place('ford', {placements: [{mapId: 'north', x: 3, y: 4}, {mapId: 'south', x: 0, y: 1}]})
    ];
    expect(distance(entities, 'ash', 'ford', maps).distances.map((figure) => figure.measure)).toEqual([
      {amount: 5, unit: 'miles'},
      {amount: 1, unit: 'leagues'}
    ]);
  });

  it('ignores placements on deleted maps and stops at a stored map cycle', () => {
    const maps = [
      map('a', 'miles', 1, {parentPlacement: {mapId: 'b', x: 0, y: 0}}),
      map('b', 'miles', 1, {parentPlacement: {mapId: 'a', x: 0, y: 0}})
    ];
    const entities = [
      place('ash', {placements: [{mapId: 'gone', x: 0, y: 0}, {mapId: 'a', x: 0, y: 0}]}),
      place('ford', {placements: [{mapId: 'b', x: 1, y: 0}]})
    ];
    const result = distance(entities, 'ash', 'ford', maps);
    expect(result.distances.length).toBeGreaterThan(0);
  });
});

describe('describeDistanceFigure', () => {
  it('names the source of each figure', () => {
    const entities = [
      place('ash', {connections: [road('ford', {distance: {amount: 2, unit: 'miles'}})], placements: [{mapId: 'region', x: 0, y: 0}]}),
      place('ford', {connections: [road('mill', {distance: {amount: 3, unit: 'miles'}})]}),
      place('mill', {placements: [{mapId: 'region', x: 12.34, y: 0}]})
    ];
    const places = placesById(categories, entities);
    const maps = mapsById([map('region', 'miles', 1)]);
    const route = placeDistance({fromId: 'ash', toId: 'mill', places, maps});
    expect(describeDistanceFigure(route.distances[0], places, maps)).toBe('5 miles — route via Ford');
    expect(describeDistanceFigure(
      {measure: {amount: 12.34, unit: 'miles'}, source: {kind: 'straight-line', mapId: 'region'}}, places, maps
    )).toBe('about 12 miles — straight line on Region');
    const authored = placeDistance({fromId: 'ash', toId: 'ford', places, maps});
    expect(describeDistanceFigure(authored.distances[0], places, maps)).toBe('2 miles — authored on the road');
  });
});
