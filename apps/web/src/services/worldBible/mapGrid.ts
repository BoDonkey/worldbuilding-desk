import type {MapGrid} from '../../entityTypes';

/*
 * Square and hex grids (slice 4.81, places brief § 4). A grid changes how
 * distance is counted on its map, never where places are: placements stay in
 * map units, and each point is read as the cell it falls in.
 *
 * - Squares: a diagonal step counts as one square, as in most tabletop rules.
 * - Hexes: the number of hex steps between the two cells.
 *
 * `cellSize` is the distance between the centres of two neighbouring cells,
 * in map units (image pixels on a map with an image).
 */

const SQRT3 = Math.sqrt(3);

type Point = {x: number; y: number};

export const gridUnit = (grid: MapGrid): string => (grid.kind === 'square' ? 'squares' : 'hexes');

const origin = (grid: MapGrid): Point => ({x: grid.originX ?? 0, y: grid.originY ?? 0});

/** Centre to corner of a hex whose neighbours are `cellSize` apart. */
const hexRadius = (grid: MapGrid): number => grid.cellSize / SQRT3;

export const squareCell = (point: Point, grid: MapGrid): {col: number; row: number} => {
  const start = origin(grid);
  return {
    col: Math.floor((point.x - start.x) / grid.cellSize),
    row: Math.floor((point.y - start.y) / grid.cellSize)
  };
};

/** The hex a point falls in, as axial coordinates (q, r). */
export const hexCell = (point: Point, grid: MapGrid): {q: number; r: number} => {
  const start = origin(grid);
  const x = point.x - start.x;
  const y = point.y - start.y;
  const size = hexRadius(grid);
  const q = grid.hexOrientation === 'flat' ? (2 / 3) * x / size : ((SQRT3 / 3) * x - y / 3) / size;
  const r = grid.hexOrientation === 'flat' ? (-x / 3 + (SQRT3 / 3) * y) / size : ((2 / 3) * y) / size;
  // Round in cube coordinates so a point near a corner lands in the right hex.
  const s = -q - r;
  let roundQ = Math.round(q);
  let roundR = Math.round(r);
  const roundS = Math.round(s);
  const dq = Math.abs(roundQ - q);
  const dr = Math.abs(roundR - r);
  const ds = Math.abs(roundS - s);
  if (dq > dr && dq > ds) roundQ = -roundR - roundS;
  else if (dr > ds) roundR = -roundQ - roundS;
  return {q: roundQ + 0, r: roundR + 0};
};

/** Cells between two points on a grid map. */
export const gridDistance = (a: Point, b: Point, grid: MapGrid): number => {
  if (grid.kind === 'square') {
    const from = squareCell(a, grid);
    const to = squareCell(b, grid);
    return Math.max(Math.abs(from.col - to.col), Math.abs(from.row - to.row));
  }
  const from = hexCell(a, grid);
  const to = hexCell(b, grid);
  const dq = from.q - to.q;
  const dr = from.r - to.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** The grid as it should save, or an error message the author can act on. */
export const normalizeMapGrid = (grid: MapGrid): {grid: MapGrid} | {error: string} => {
  if (grid.kind !== 'square' && grid.kind !== 'hex') return {error: 'Choose squares or hexes.'};
  if (!isFiniteNumber(grid.cellSize) || grid.cellSize <= 0) {
    return {error: 'The cell size must be a number above zero.'};
  }
  const originX = grid.originX ?? 0;
  const originY = grid.originY ?? 0;
  if (!isFiniteNumber(originX) || !isFiniteNumber(originY)) {
    return {error: 'Give where the grid starts as two numbers, or leave both at 0.'};
  }
  return {
    grid: {
      kind: grid.kind,
      cellSize: grid.cellSize,
      ...(grid.kind === 'hex' ? {hexOrientation: grid.hexOrientation === 'flat' ? 'flat' as const : 'pointy' as const} : {}),
      ...(originX !== 0 ? {originX} : {}),
      ...(originY !== 0 ? {originY} : {})
    }
  };
};

const hexOutline = (centre: Point, radius: number, flat: boolean): string => {
  const corners = Array.from({length: 6}, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i + (flat ? 0 : 30));
    return `${centre.x + radius * Math.cos(angle)},${centre.y + radius * Math.sin(angle)}`;
  });
  return `M${corners.join('L')}Z`;
};

/**
 * One repeating tile of the grid for drawing it over a map image: its size,
 * where the first tile starts, and the outline path, all in map units.
 */
export const gridTile = (grid: MapGrid): {x: number; y: number; width: number; height: number; path: string} => {
  const start = origin(grid);
  const size = grid.cellSize;
  if (grid.kind === 'square') {
    return {...start, width: size, height: size, path: `M0,0H${size}M0,0V${size}`};
  }
  const radius = hexRadius(grid);
  const flat = grid.hexOrientation === 'flat';
  // Hexes centred on the tile's corners, edges, and middle cover it completely.
  const width = flat ? 3 * radius : size;
  const height = flat ? size : 3 * radius;
  const centres: Point[] = flat
    ? [{x: 0, y: 0}, {x: 0, y: height}, {x: 1.5 * radius, y: height / 2}, {x: width, y: 0}, {x: width, y: height}]
    : [{x: 0, y: 0}, {x: width, y: 0}, {x: width / 2, y: 1.5 * radius}, {x: 0, y: height}, {x: width, y: height}];
  return {...start, width, height, path: centres.map((centre) => hexOutline(centre, radius, flat)).join('')};
};
