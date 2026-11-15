import {describe, expect, it} from 'vitest';
import type {MapGrid} from '../../entityTypes';
import {gridDistance, gridTile, gridUnit, hexCell, normalizeMapGrid, squareCell} from './mapGrid';

const SQRT3 = Math.sqrt(3);
const square: MapGrid = {kind: 'square', cellSize: 10};
const pointy: MapGrid = {kind: 'hex', cellSize: 10, hexOrientation: 'pointy'};
const flat: MapGrid = {kind: 'hex', cellSize: 10, hexOrientation: 'flat'};

/** The centre of axial hex (q, r), plus a small nudge so tests do not sit exactly on centres. */
const pointyCentre = (q: number, r: number, nudge = 0) => ({x: 10 * (q + r / 2) + nudge, y: 10 * (SQRT3 / 2) * r - nudge});
const flatCentre = (q: number, r: number, nudge = 0) => ({x: 10 * (SQRT3 / 2) * q + nudge, y: 10 * (q / 2 + r) - nudge});

describe('square grids', () => {
  it('counts a diagonal step as one square', () => {
    expect(gridDistance({x: 5, y: 5}, {x: 35, y: 15}, square)).toBe(3);
    expect(gridDistance({x: 1, y: 1}, {x: 25, y: 25}, square)).toBe(2);
    expect(gridDistance({x: 1, y: 1}, {x: 9, y: 9}, square)).toBe(0);
  });

  it('reads cells from where the grid starts', () => {
    expect(squareCell({x: 4, y: 4}, {...square, originX: 5, originY: 5})).toEqual({col: -1, row: -1});
    expect(squareCell({x: 6, y: 16}, {...square, originX: 5, originY: 5})).toEqual({col: 0, row: 1});
  });
});

describe('hex grids', () => {
  it('finds the hex a point falls in, for pointy and flat tops', () => {
    expect(hexCell(pointyCentre(2, -1, 2), pointy)).toEqual({q: 2, r: -1});
    expect(hexCell(flatCentre(-3, 2, 2), flat)).toEqual({q: -3, r: 2});
    expect(hexCell({x: 0.5, y: 0.5}, pointy)).toEqual({q: 0, r: 0});
  });

  it('counts hex steps between cells', () => {
    expect(gridDistance(pointyCentre(0, 0), pointyCentre(1, 0, 1), pointy)).toBe(1);
    expect(gridDistance(pointyCentre(0, 0), pointyCentre(3, -1, 1), pointy)).toBe(3);
    expect(gridDistance(pointyCentre(-2, 0), pointyCentre(2, 2, 1), pointy)).toBe(6);
    expect(gridDistance(flatCentre(0, 0), flatCentre(0, 4, 1), flat)).toBe(4);
    expect(gridDistance(flatCentre(1, 1), flatCentre(-2, 1, 1), flat)).toBe(3);
  });

  it('anchors hexes at the grid origin', () => {
    const shifted: MapGrid = {...pointy, originX: 100, originY: 50};
    expect(hexCell({x: 100 + 10 + 0.5, y: 50.5}, shifted)).toEqual({q: 1, r: 0});
  });
});

describe('grid settings', () => {
  it('saves a valid grid and refuses a missing or zero cell size', () => {
    expect(normalizeMapGrid({kind: 'hex', cellSize: 32})).toEqual({grid: {kind: 'hex', cellSize: 32, hexOrientation: 'pointy'}});
    expect(normalizeMapGrid({kind: 'square', cellSize: 5, hexOrientation: 'flat', originX: 2, originY: 0}))
      .toEqual({grid: {kind: 'square', cellSize: 5, originX: 2}});
    expect(normalizeMapGrid({kind: 'square', cellSize: 0})).toMatchObject({error: expect.stringMatching(/above zero/)});
    expect(normalizeMapGrid({kind: 'square', cellSize: 4, originX: Number.NaN})).toMatchObject({error: expect.stringMatching(/two numbers/)});
    expect(gridUnit(square)).toBe('squares');
    expect(gridUnit(flat)).toBe('hexes');
  });

  it('describes a repeating tile that matches the cell spacing', () => {
    expect(gridTile({...square, originX: 3})).toMatchObject({x: 3, y: 0, width: 10, height: 10});
    const tile = gridTile(pointy);
    expect(tile.width).toBe(10);
    expect(tile.height).toBeCloseTo(30 / SQRT3);
    expect(tile.path.match(/M/g)).toHaveLength(5);
  });
});
