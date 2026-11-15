import type {WorldMap} from '../../entityTypes';
import {gridTile} from './mapGrid';
import {exportScale, type MapOccupant, type MapPathPoint, type MapPin} from './mapSurface';

/*
 * The pinned map as a PNG (slice 4.80): the author's image with each pin, its
 * name, and who is there at the chosen scene, plus a character's path when
 * one is shown and the map's grid when it has one (4.81). Colours come from the current theme tokens, so the export
 * looks like the screen.
 */

const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to read the map image.'));
    image.src = src;
  });

/** Most grid tiles drawn on an export; a finer grid is left off rather than stall the export. */
const MAX_GRID_TILES = 100_000;

const drawGrid = (context: CanvasRenderingContext2D, map: WorldMap, scale: number, unit: number, line: string, halo: string) => {
  if (!map.grid || !map.image) return;
  const tile = gridTile(map.grid);
  const startX = tile.x - Math.ceil(tile.x / tile.width) * tile.width;
  const startY = tile.y - Math.ceil(tile.y / tile.height) * tile.height;
  const columns = Math.ceil((map.image.width - startX) / tile.width);
  const rows = Math.ceil((map.image.height - startY) / tile.height);
  if (columns * rows > MAX_GRID_TILES) return;
  const piece = new Path2D(tile.path);
  const grid = new Path2D();
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = startX + column * tile.width;
      const y = startY + row * tile.height;
      grid.addPath(piece, new DOMMatrix([scale, 0, 0, scale, x * scale, y * scale]));
    }
  }
  // A halo under each line keeps the grid visible on light and dark images alike.
  context.save();
  context.strokeStyle = halo;
  context.globalAlpha = 0.45;
  context.lineWidth = Math.max(3, unit * 1.5);
  context.stroke(grid);
  context.strokeStyle = line;
  context.globalAlpha = 0.55;
  context.lineWidth = Math.max(1, unit / 2);
  context.stroke(grid);
  context.restore();
};

export const renderMapExport = async (params: {
  map: WorldMap;
  pins: MapPin[];
  occupants: ReadonlyMap<string, MapOccupant[]>;
  path: MapPathPoint[];
}): Promise<Blob> => {
  const {map, pins, occupants, path} = params;
  if (!map.image) throw new Error('Import a map image first.');
  const source = await loadImage(map.image.dataUrl);
  const scale = exportScale(map.image);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(map.image.width * scale);
  canvas.height = Math.round(map.image.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to draw the map.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  const unit = Math.max(1, Math.min(canvas.width, canvas.height) / 400);
  const accent = token('--color-accent');
  const panel = token('--surface-panel-elevated');
  const text = token('--color-text-primary');
  const border = token('--surface-border-strong');

  if (map.grid) drawGrid(context, map, scale, unit, text, panel);

  if (path.length > 1) {
    context.strokeStyle = accent;
    context.lineWidth = 2 * unit;
    context.setLineDash([6 * unit, 4 * unit]);
    context.beginPath();
    path.forEach((point, i) => {
      const x = point.x * scale;
      const y = point.y * scale;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.setLineDash([]);
  }

  const fontSize = Math.round(6 * unit + 6);
  context.font = `600 ${fontSize}px system-ui, sans-serif`;
  context.textBaseline = 'middle';
  pins.filter((pin) => pin.onImage).forEach((pin) => {
    const x = pin.x * scale;
    const y = pin.y * scale;
    context.fillStyle = accent;
    context.strokeStyle = panel;
    context.lineWidth = 1.5 * unit;
    context.beginPath();
    context.arc(x, y, 4 * unit, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    const names = (occupants.get(pin.place.id) ?? []).map((occupant) => occupant.position.subject.name);
    const label = names.length > 0 ? `${pin.place.name}: ${names.join(', ')}` : pin.place.name;
    const padding = 3 * unit;
    const width = context.measureText(label).width + padding * 2;
    const height = fontSize + padding * 2;
    const left = Math.min(canvas.width - width, x + 6 * unit);
    const top = Math.max(0, y - height / 2);
    context.fillStyle = panel;
    context.strokeStyle = border;
    context.lineWidth = unit;
    context.beginPath();
    context.roundRect(left, top, width, height, 3 * unit);
    context.fill();
    context.stroke();
    context.fillStyle = text;
    context.fillText(label, left + padding, top + height / 2);
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Unable to export the map.'))), 'image/png');
  });
};
