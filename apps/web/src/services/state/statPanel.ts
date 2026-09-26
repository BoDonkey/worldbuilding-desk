import type {ChapterCard, WritingDocument} from '../../entityTypes';
import {sortWritingDocuments} from '../../writingStorage';
import type {CharacterSnapshotChange} from './characterSnapshot';

export const MAX_STAT_PINS = 3;

/** Pins or unpins a sheet; a fourth pin is refused rather than evicting one. */
export function toggleStatPin(
  pins: string[],
  sheetId: string
): {pins: string[]; result: 'pinned' | 'unpinned' | 'full'} {
  if (pins.includes(sheetId)) {
    return {pins: pins.filter((id) => id !== sheetId), result: 'unpinned'};
  }
  if (pins.length >= MAX_STAT_PINS) return {pins, result: 'full'};
  return {pins: [...pins, sheetId], result: 'pinned'};
}

/**
 * Where "changes since the previous chapter" starts for a scene: the opening of
 * the first manuscript scene linked to the scene's chapter card (the first card
 * by Corkboard order when several link it). Without a chapter card the baseline
 * is the scene's own opening, i.e. the previous scene's ending.
 */
export function resolveChangesBaseline(params: {
  documents: WritingDocument[];
  chapterCards: ChapterCard[];
  sceneId: string;
}): {sceneOrder: number; label: string} | null {
  const ordered = sortWritingDocuments(params.documents);
  const orderById = new Map(ordered.map((document, index) => [document.id, index + 1]));
  const sceneOrder = orderById.get(params.sceneId);
  if (!sceneOrder) return null;

  const chapter = params.chapterCards
    .filter((card) => (card.sceneIds ?? []).includes(params.sceneId))
    .sort((left, right) => left.order - right.order || left.createdAt - right.createdAt)[0];
  if (chapter) {
    const chapterOrders = (chapter.sceneIds ?? [])
      .map((sceneId) => orderById.get(sceneId))
      .filter((order): order is number => typeof order === 'number');
    const title = chapter.title.trim() || 'Untitled chapter';
    return {
      sceneOrder: Math.min(...chapterOrders),
      label: `Since the previous chapter, before “${title}”`
    };
  }
  return {
    sceneOrder,
    label: 'Since the previous scene (no chapter card links this scene)'
  };
}

const formatResource = (value: {current: number; max?: number} | null): string =>
  value ? `${value.current}${typeof value.max === 'number' ? `/${value.max}` : ''}` : 'none';

/** One plain line per change, for the pinned panel. */
export function describeCharacterSnapshotChange(change: CharacterSnapshotChange): string {
  switch (change.kind) {
    case 'level':
      return `Level ${change.from} → ${change.to}`;
    case 'resource':
      return `${change.label} ${formatResource(change.from)} → ${formatResource(change.to)}`;
    case 'stat':
      return `${change.label} ${change.from ?? 'none'} → ${change.to ?? 'none'}`;
    case 'status':
      return `${change.change === 'added' ? 'Gained' : 'Lost'} ${change.name}`;
    case 'item':
      return change.toQuantity > change.fromQuantity
        ? `${change.name} ${change.fromQuantity} → ${change.toQuantity} (gained)`
        : `${change.name} ${change.fromQuantity} → ${change.toQuantity} (lost)`;
    case 'equipment':
      return `${change.change === 'equipped' ? 'Equipped' : 'Unequipped'} ${change.name}`;
    case 'location':
      return `Moved ${change.from ?? 'nowhere'} → ${change.to ?? 'nowhere'}`;
  }
}
