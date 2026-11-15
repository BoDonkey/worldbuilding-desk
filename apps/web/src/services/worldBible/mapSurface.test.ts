import {describe, expect, it} from 'vitest';
import type {EntityCategory, MapImage, PlaceData, WorldEntity, WorldMap} from '../../entityTypes';
import type {StateSubject} from '../state/stateSubjects';
import type {CharacterPosition, PathStop} from './placeMovement';
import {placesById} from './places';
import {
  exportScale,
  MAP_IMAGE_MAX_BYTES,
  mapImageFileProblem,
  mapImageSizeProblem,
  nudgePoint,
  occupantsOnMap,
  pathOnMap,
  pinsOnMap,
  withPlacement
} from './mapSurface';

const categories: EntityCategory[] = [
  {id: 'cat-loc', projectId: 'p', kind: 'general', name: 'Locations', slug: 'locations', fieldSchema: [], createdAt: 0}
];

const place = (id: string, data?: PlaceData): WorldEntity => ({
  id, projectId: 'p', categoryId: 'cat-loc', name: id[0].toUpperCase() + id.slice(1),
  fields: {}, place: data, links: [], createdAt: 0, updatedAt: 0
});

const image: MapImage = {dataUrl: 'data:image/png;base64,AA==', mimeType: 'image/png', width: 1000, height: 500, byteLength: 1};
const map: WorldMap = {id: 'region', projectId: 'p', name: 'Region', distanceUnit: 'miles', scale: 0.5, image, createdAt: 0, updatedAt: 0};

const entities = [
  place('city', {placements: [{mapId: 'region', x: 100, y: 100}]}),
  place('tavern', {parentId: 'city'}),
  place('ford', {placements: [{mapId: 'region', x: 400, y: 250}, {mapId: 'other', x: 1, y: 1}]}),
  place('reef', {placements: [{mapId: 'region', x: 2000, y: 10}]}),
  place('moon')
];
const places = placesById(categories, entities);

const subject = (name: string): StateSubject => ({actorId: name.toLowerCase(), name} as StateSubject);
const position = (name: string, placeId: string | null, label: string): CharacterPosition =>
  ({subject: subject(name), placeId, label});

describe('map image checks', () => {
  it('refuses other file types and files over the size limit, naming the limit', () => {
    expect(mapImageFileProblem({type: 'image/png', size: 1000})).toBeNull();
    expect(mapImageFileProblem({type: 'image/svg+xml', size: 10})).toMatch(/PNG, JPEG, WebP, or GIF/);
    expect(mapImageFileProblem({type: 'image/jpeg', size: MAP_IMAGE_MAX_BYTES + 1})).toMatch(/up to 10\.0 MB/);
  });

  it('refuses unreadable and oversized dimensions', () => {
    expect(mapImageSizeProblem(0, 0)).toMatch(/could not be read/);
    expect(mapImageSizeProblem(20000, 100)).toMatch(/20000 × 100/);
    expect(mapImageSizeProblem(4000, 3000)).toBeNull();
  });
});

describe('pins', () => {
  it('lists places with a point on this map and marks points outside the image', () => {
    const pins = pinsOnMap(map, places);
    expect(pins.map((pin) => [pin.place.id, pin.onImage])).toEqual([['city', true], ['ford', true], ['reef', false]]);
  });

  it('sets, moves, and removes one point per map, keeping points on other maps', () => {
    const ford = places.get('ford')!;
    const moved = withPlacement(ford, 'region', {x: 10.4, y: 20.6}, 9);
    expect(moved.place?.placements).toEqual([{mapId: 'other', x: 1, y: 1}, {mapId: 'region', x: 10, y: 21}]);
    expect(moved.updatedAt).toBe(9);
    expect(withPlacement(ford, 'region', null, 9).place?.placements).toEqual([{mapId: 'other', x: 1, y: 1}]);
    expect(withPlacement(places.get('moon')!, 'region', {x: 1, y: 2}, 9).place?.placements).toEqual([{mapId: 'region', x: 1, y: 2}]);
  });

  it('moves a pin by arrow keys in steps of the shorter side, staying on the image', () => {
    expect(nudgePoint({x: 100, y: 100}, 'ArrowRight', image, false)).toEqual({x: 105, y: 100});
    expect(nudgePoint({x: 100, y: 100}, 'ArrowUp', image, true)).toEqual({x: 100, y: 75});
    expect(nudgePoint({x: 2, y: 498}, 'ArrowDown', image, true)).toEqual({x: 2, y: 500});
    expect(nudgePoint({x: 2, y: 2}, 'Enter', image, false)).toBeNull();
  });
});

describe('who is where on the map', () => {
  it('shows a character at their place, or at the pin of a place it is inside, and lists the rest', () => {
    const {byPlaceId, elsewhere} = occupantsOnMap(
      [
        position('Mira', 'tavern', 'Tavern'),
        position('Tomas', 'city', 'City'),
        position('Ilse', 'moon', 'Moon'),
        position('Ode', null, 'the old mill'),
        position('Reva', 'reef', 'Reef')
      ],
      pinsOnMap(map, places),
      places
    );
    expect(byPlaceId.get('city')?.map((o) => [o.position.subject.name, o.within])).toEqual([['Mira', 'Tavern'], ['Tomas', undefined]]);
    expect(elsewhere.map((p) => p.subject.name)).toEqual(['Ilse', 'Ode', 'Reva']);
  });

  it('draws a path through the pins its stops show at, skipping repeats and unpinned stops', () => {
    const stop = (placeId: string | null, sceneOrder: number): PathStop => ({
      eventId: `e${sceneOrder}`, sceneId: `s${sceneOrder}`, sceneTitle: '', sceneOrder, placeId, label: placeId ?? 'text'
    });
    const points = pathOnMap([stop('city', 1), stop('tavern', 2), stop('moon', 3), stop(null, 4), stop('ford', 5)], pinsOnMap(map, places), places);
    expect(points.map((point) => [point.x, point.y, point.sceneOrder])).toEqual([[100, 100, 1], [400, 250, 5]]);
  });
});

describe('export', () => {
  it('shrinks only images larger than the export limit', () => {
    expect(exportScale(image)).toBe(1);
    expect(exportScale({...image, width: 16000, height: 8000})).toBe(0.512);
  });
});
