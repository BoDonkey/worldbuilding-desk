import type {MapImage, WorldEntity, WorldMap} from '../../entityTypes';
import {normalizePlacements, placeAncestors, type PlacesById} from './places';
import type {CharacterPosition, PathStop} from './placeMovement';

/*
 * The map surface (slice 4.80, places brief § 8): an imported image with
 * place records pinned onto it. A pin is a placement, so one map unit is one
 * pixel of the image. Everything here is read from the place records and the
 * replayed ledger; the only writes are the author's own pins.
 */

export const MAP_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
/** Longest side the browser can reliably draw onto a canvas for export. */
export const MAP_IMAGE_MAX_SIDE = 16384;
export const MAP_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const megabytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Why a chosen file cannot be a map image, or null. Checked before it is read. */
export const mapImageFileProblem = (file: {type: string; size: number}): string | null => {
  if (!MAP_IMAGE_TYPES.includes(file.type)) return 'Choose a PNG, JPEG, WebP, or GIF image.';
  if (file.size > MAP_IMAGE_MAX_BYTES) {
    return `This image is ${megabytes(file.size)}. Map images can be up to ${megabytes(MAP_IMAGE_MAX_BYTES)}; save a smaller copy (a JPEG is usually much smaller) and import that.`;
  }
  return null;
};

/** Why decoded image dimensions cannot be used, or null. */
export const mapImageSizeProblem = (width: number, height: number): string | null => {
  if (!(width > 0) || !(height > 0)) return 'This image could not be read. Try saving it again as PNG or JPEG.';
  if (width > MAP_IMAGE_MAX_SIDE || height > MAP_IMAGE_MAX_SIDE) {
    return `This image is ${width} × ${height} pixels. Map images can be up to ${MAP_IMAGE_MAX_SIDE} pixels on each side.`;
  }
  return null;
};

/** Reads and checks an image file in the browser. Returns the image or an error message. */
export const readMapImageFile = async (file: File): Promise<{image: MapImage} | {error: string}> => {
  const fileProblem = mapImageFileProblem(file);
  if (fileProblem) return {error: fileProblem};
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read the image.'));
    reader.readAsDataURL(file);
  });
  const size = await new Promise<{width: number; height: number}>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({width: image.naturalWidth, height: image.naturalHeight});
    image.onerror = () => resolve({width: 0, height: 0});
    image.src = dataUrl;
  });
  const sizeProblem = mapImageSizeProblem(size.width, size.height);
  if (sizeProblem) return {error: sizeProblem};
  return {
    image: {dataUrl, mimeType: file.type, width: size.width, height: size.height, byteLength: file.size, fileName: file.name}
  };
};

export interface MapPin {
  place: WorldEntity;
  x: number;
  y: number;
  /** False for a point entered by number that lies outside the image. */
  onImage: boolean;
}

export const isPointOnImage = (point: {x: number; y: number}, image: MapImage): boolean =>
  point.x >= 0 && point.y >= 0 && point.x <= image.width && point.y <= image.height;

/** Every place with a point on this map, by name. */
export const pinsOnMap = (map: WorldMap, places: PlacesById): MapPin[] =>
  [...places.values()]
    .flatMap((place) => {
      const placement = place.place?.placements?.find((candidate) => candidate.mapId === map.id);
      if (!placement) return [];
      return [{
        place,
        x: placement.x,
        y: placement.y,
        onImage: map.image ? isPointOnImage(placement, map.image) : false
      }];
    })
    .sort((a, b) => a.place.name.localeCompare(b.place.name));

/** The place record with its point on `mapId` set (or removed, for `null`), as it should save. */
export const withPlacement = (
  place: WorldEntity,
  mapId: string,
  point: {x: number; y: number} | null,
  now: number
): WorldEntity => {
  const placements = normalizePlacements(place.place?.placements).filter((placement) => placement.mapId !== mapId);
  if (point) placements.push({mapId, x: Math.round(point.x), y: Math.round(point.y)});
  return {...place, place: {...place.place, placements}, updatedAt: now};
};

export const clampToImage = (point: {x: number; y: number}, image: MapImage): {x: number; y: number} => ({
  x: Math.min(image.width, Math.max(0, Math.round(point.x))),
  y: Math.min(image.height, Math.max(0, Math.round(point.y)))
});

const NUDGES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
};

/**
 * A pin moved by an arrow key: 1% of the image's shorter side, 5% with
 * Shift. Null for any other key.
 */
export const nudgePoint = (
  point: {x: number; y: number},
  key: string,
  image: MapImage,
  large: boolean
): {x: number; y: number} | null => {
  const direction = NUDGES[key];
  if (!direction) return null;
  const step = Math.max(1, Math.round(Math.min(image.width, image.height) * (large ? 0.05 : 0.01)));
  return clampToImage({x: point.x + direction[0] * step, y: point.y + direction[1] * step}, image);
};

/**
 * The pin a place shows at: its own, else the nearest place it is inside
 * that has one. A tavern with no pin shows at its city's pin.
 */
export const anchorPinFor = (
  placeId: string,
  pinsById: ReadonlyMap<string, MapPin>,
  places: PlacesById
): MapPin | null => {
  for (const id of [placeId, ...placeAncestors(placeId, places).map((place) => place.id)]) {
    const pin = pinsById.get(id);
    if (pin?.onImage) return pin;
  }
  return null;
};

export interface MapOccupant {
  position: CharacterPosition;
  /** The character's own place, when they show at the pin of a place it is inside. */
  within?: string;
}

/** Who shows at each pin, and who is somewhere this map does not show. */
export const occupantsOnMap = (
  positions: CharacterPosition[],
  pins: MapPin[],
  places: PlacesById
): {byPlaceId: Map<string, MapOccupant[]>; elsewhere: CharacterPosition[]} => {
  const pinsById = new Map(pins.map((pin) => [pin.place.id, pin]));
  const byPlaceId = new Map<string, MapOccupant[]>();
  const elsewhere: CharacterPosition[] = [];
  positions.forEach((position) => {
    const pin = position.placeId ? anchorPinFor(position.placeId, pinsById, places) : null;
    if (!pin) {
      elsewhere.push(position);
      return;
    }
    const occupants = byPlaceId.get(pin.place.id) ?? [];
    occupants.push(pin.place.id === position.placeId ? {position} : {position, within: position.label});
    byPlaceId.set(pin.place.id, occupants);
  });
  return {byPlaceId, elsewhere};
};

export interface MapPathPoint {
  x: number;
  y: number;
  label: string;
  sceneOrder: number;
}

/**
 * A character's path drawn on this map: one point per stop that shows on
 * it, skipping stops that show at the same pin as the one before.
 */
export const pathOnMap = (stops: PathStop[], pins: MapPin[], places: PlacesById): MapPathPoint[] => {
  const pinsById = new Map(pins.map((pin) => [pin.place.id, pin]));
  const points: MapPathPoint[] = [];
  let lastPinId: string | null = null;
  stops.forEach((stop) => {
    const pin = stop.placeId ? anchorPinFor(stop.placeId, pinsById, places) : null;
    if (!pin || pin.place.id === lastPinId) return;
    lastPinId = pin.place.id;
    points.push({x: pin.x, y: pin.y, label: stop.label, sceneOrder: stop.sceneOrder});
  });
  return points;
};

/** How much to shrink a map for image export so neither side passes `maxSide`. */
export const exportScale = (image: MapImage, maxSide = 8192): number =>
  Math.min(1, maxSide / Math.max(image.width, image.height));
