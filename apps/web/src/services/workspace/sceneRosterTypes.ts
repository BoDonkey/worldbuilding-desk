import type {
  CharacterSnapshotInventoryLine,
  CharacterSnapshotResourceLine,
  CharacterSnapshotStatLine
} from '../state/characterSnapshot';

export type SceneRosterStatLine = CharacterSnapshotStatLine;
export type SceneRosterResourceLine = CharacterSnapshotResourceLine;
export type SceneRosterInventoryLine = CharacterSnapshotInventoryLine;
export interface SceneRosterCharacterCard {
  key: string;
  id: string;
  /**
   * World Bible character id that new state changes use. Absent for a
   * legacy sheet or character record not linked to the World Bible.
   */
  actorId?: string;
  sheetId?: string;
  name: string;
  role: string;
  level?: number;
  source: 'scene' | 'pinned';
  matchedSurface?: string;
  stats: SceneRosterStatLine[];
  resources: SceneRosterResourceLine[];
  inventory: SceneRosterInventoryLine[];
  statuses: string[];
  location?: string;
  hasSheet: boolean;
}

export interface SceneRosterItemCard {
  key: string;
  id: string;
  name: string;
  categoryLabel: string;
  icon?: string;
  source: 'scene' | 'pinned';
  matchedSurface?: string;
  fields: SceneRosterStatLine[];
}

export interface SceneRosterAddOption {
  key: string;
  name: string;
  group: 'Characters' | 'Items & entities';
}

export interface SceneRosterTimelineEvent {
  id: string;
  label: string;
  actorLabel: string;
  position?: number;
  anchorStatus: 'exact' | 'moved' | 'unresolved' | 'legacy';
  status: 'accepted' | 'invalidated';
  summaries: string[];
  canEdit: boolean;
  canExpire: boolean;
  durationLabel?: string;
}
