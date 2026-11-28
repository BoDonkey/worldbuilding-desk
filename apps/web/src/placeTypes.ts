/**
 * Places and maps (slices 4.76–4.81): where a place is, what it connects to,
 * and the maps it sits on. Re-exported from `entityTypes.ts`.
 */

/**
 * An amount the author wrote down: their own words ("three days"), and
 * optionally a number and unit the app can add up later (3, "days").
 */
export interface AuthoredMeasure {
  words?: string;
  amount?: number;
  unit?: string;
}

export interface PlaceTravelTime extends AuthoredMeasure {
  /** How the trip is made: "on foot", "by horse". */
  mode: string;
}

/**
 * A link between two places. Stored once, on the record where it was added,
 * and shown on both ends. Two-way unless `oneWay` (then only from → to).
 */
export interface PlaceConnection {
  id: string;
  toId: string;
  /** Road, river, portal, stairway: the author's word. */
  kind: string;
  oneWay?: boolean;
  distance?: AuthoredMeasure;
  travelTimes?: PlaceTravelTime[];
}

export interface PlaceData {
  /** The one place this place is inside. Parents nest to any depth; cycles are refused. */
  parentId?: string;
  connections?: PlaceConnection[];
  /** Where this place is on each map: at most one point per map (slice 4.79). */
  placements?: PlacePlacement[];
}

/** "This place is at (x, y) on that map", in the map's own units. */
export interface PlacePlacement {
  mapId: string;
  x: number;
  y: number;
}

/**
 * A map of part of the world (slice 4.79). Coordinates belong to a map, never
 * to the world: there is no global grid. Distances measured on a map are in
 * its `distanceUnit`.
 */
export interface WorldMap {
  id: string;
  projectId: string;
  name: string;
  /** The background image the author imported (slice 4.80). Map units are its pixels. */
  image?: MapImage;
  /** What distances on this map are measured in: miles, leagues, feet. */
  distanceUnit: string;
  /** How many distance units one map unit covers: 0.5 means one map unit is half a mile. */
  scale: number;
  /** Where this whole map sits, as one point, on a larger map. */
  parentPlacement?: PlacePlacement;
  /** Squares or hexes (slice 4.81): distance on this map is counted in cells. */
  grid?: MapGrid;
  createdAt: number;
  updatedAt: number;
}

/**
 * A square or hex grid over a map (slice 4.81, places brief § 4). It changes
 * how distance is measured on that map, never where places are.
 */
export interface MapGrid {
  kind: 'square' | 'hex';
  /** Map units between the centres of two neighbouring cells. */
  cellSize: number;
  /** Hexes only: a point or a flat side at the top. */
  hexOrientation?: 'pointy' | 'flat';
  /** Where the grid is anchored, in map units: a square's corner or a hex's centre. */
  originX?: number;
  originY?: number;
}

/**
 * A map background made elsewhere (Inkarnate, a scan), stored inline as a data
 * URL so backups, vaults, and project copies carry it with the map record.
 * One map unit is one pixel of the image.
 */
export interface MapImage {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  byteLength: number;
  fileName?: string;
}

/** "1 league = 3 miles": one `from` is `factor` of `to`. Set by the author. */
export interface UnitConversion {
  from: string;
  to: string;
  factor: number;
}
