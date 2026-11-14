import {describe, expect, it} from 'vitest';
import type {WorldMap} from '../../entityTypes';
import {
  mapAncestors,
  mapParentProblem,
  mapsById,
  normalizeMapInput,
  normalizeUnitConversions,
  parentMapOptions,
  unitFactor,
  unitKey
} from './maps';

const map = (id: string, parentMapId?: string): WorldMap => ({
  id, projectId: 'p', name: id[0].toUpperCase() + id.slice(1), distanceUnit: 'miles', scale: 1,
  ...(parentMapId ? {parentPlacement: {mapId: parentMapId, x: 0, y: 0}} : {}),
  createdAt: 1, updatedAt: 1
});

const maps = mapsById([map('world'), map('region', 'world'), map('city', 'region')]);

describe('map nesting', () => {
  it('lists the maps a map sits on, nearest first', () => {
    expect(mapAncestors('city', maps).map((entry) => entry.id)).toEqual(['region', 'world']);
  });

  it('refuses a map sitting on itself or on a map inside it', () => {
    expect(mapParentProblem('world', 'world', maps)).toMatch(/itself/);
    expect(mapParentProblem('world', 'city', maps)).toMatch(/already sits on this map/);
    expect(parentMapOptions('region', maps).map((entry) => entry.id)).toEqual(['world']);
    expect(parentMapOptions(null, maps)).toHaveLength(3);
  });
});

describe('normalizeMapInput', () => {
  const base = {name: ' Coast ', distanceUnit: ' leagues ', scale: 0.5};

  it('trims and keeps a valid map', () => {
    const result = normalizeMapInput({input: base, projectId: 'p', maps, now: 5});
    expect(result).toMatchObject({map: {name: 'Coast', distanceUnit: 'leagues', scale: 0.5, createdAt: 5}});
  });

  it('explains what is missing', () => {
    const check = (input: Partial<typeof base>) =>
      normalizeMapInput({input: {...base, ...input}, projectId: 'p', maps, now: 5});
    expect(check({name: ' '})).toEqual({error: 'Give the map a name.'});
    expect(check({distanceUnit: ''})).toMatchObject({error: expect.stringMatching(/measured in/)});
    expect(check({scale: 0})).toMatchObject({error: expect.stringMatching(/above zero/)});
    expect(check({name: 'region'})).toMatchObject({error: expect.stringMatching(/already a map called Region/)});
  });

  it('refuses a parent that would make a cycle, and keeps the creation time and image on edit', () => {
    const withImage = mapsById([...maps.values(), {...map('coast'), imageRef: 'img-1'}]);
    const cycle = normalizeMapInput({
      input: {...base, id: 'world', name: 'World', parentPlacement: {mapId: 'city', x: 1, y: 1}},
      projectId: 'p', maps: withImage, now: 9
    });
    expect(cycle).toMatchObject({error: expect.stringMatching(/already sits/)});
    const edited = normalizeMapInput({input: {...base, id: 'coast'}, projectId: 'p', maps: withImage, now: 9});
    expect(edited).toMatchObject({map: {id: 'coast', imageRef: 'img-1', createdAt: 1, updatedAt: 9}});
  });
});

describe('units', () => {
  it('treats case, spacing, and a plural "s" as the same unit', () => {
    expect(unitKey(' Miles ')).toBe('mile');
    expect(unitKey('days')).toBe('day');
    expect(unitKey('feet')).toBe('feet');
    expect(unitKey('pass')).toBe('pass');
  });

  it('converts only through conversions the author set, in either direction and chained', () => {
    const conversions = [{from: 'league', to: 'miles', factor: 3}, {from: 'mile', to: 'furlongs', factor: 8}];
    expect(unitFactor('leagues', 'mile', conversions)).toBe(3);
    expect(unitFactor('miles', 'league', conversions)).toBeCloseTo(1 / 3);
    expect(unitFactor('league', 'furlong', conversions)).toBe(24);
    expect(unitFactor('league', 'feet', conversions)).toBeUndefined();
  });

  it('drops incomplete conversions and keeps one per pair of units', () => {
    expect(normalizeUnitConversions([
      {from: 'league', to: 'mile', factor: 3},
      {from: 'miles', to: 'leagues', factor: 0.25},
      {from: 'mile', to: '', factor: 2},
      {from: 'mile', to: 'miles', factor: 2},
      {from: 'hour', to: 'minute', factor: -1}
    ])).toEqual([{from: 'miles', to: 'leagues', factor: 0.25}]);
  });
});
