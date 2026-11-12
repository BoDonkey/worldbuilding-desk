import type {LevelThreshold, WorldRuleset} from '../types/WorldRuleset';
import type {
  InventoryEquipStateMutationCommand,
  InventoryQuantityStateMutationCommand,
  LocationSetStateMutationCommand,
  ResourceChangeStateMutationCommand,
  ResourceSetStateMutationCommand,
  StatChangeStateMutationCommand,
  StatSetStateMutationCommand,
  StatusStateMutationCommand,
  XpGainStateMutationCommand
} from './kinds';

/*
 * Manuscript-time state model: accepted ledger events ordered by scene, never
 * wall-clock time. Moved from apps/web (Slice 3.10); persistence and project
 * lookups stay in the app and are passed in as data.
 */

export type StateMutationActorId = string;
export type StateMutationInventoryQuantity = number;

// Each command shape lives with its kind module in ./kinds.
export type StateMutationCommand =
  | ResourceChangeStateMutationCommand
  | ResourceSetStateMutationCommand
  | StatChangeStateMutationCommand
  | StatSetStateMutationCommand
  | StatusStateMutationCommand
  | InventoryQuantityStateMutationCommand
  | InventoryEquipStateMutationCommand
  | LocationSetStateMutationCommand
  | XpGainStateMutationCommand;

export interface StateMutationEvent {
  id: string;
  projectId: string;
  sceneId: string;
  sceneTitle?: string;
  sceneOrder?: number;
  sceneSequence?: number;
  scenePosition?: number;
  sceneAnchor?: {
    before: string;
    after: string;
  };
  label?: string;
  sourceType?: 'manual' | 'deterministic-review';
  sourceRevision: number;
  sourceHash: string;
  status: 'proposed' | 'accepted' | 'invalidated';
  commands: StateMutationCommand[];
  consumableEffect?: {
    definitionId: string;
    itemName: string;
    durationLabel?: string;
    phase: 'consume' | 'expire';
    sourceEventId?: string;
  };
  createdAt: number;
  invalidatedAt?: number;
  invalidationReason?: string;
}

/** The ruleset fields replay and validation read. */
export type ManuscriptRuleset = Pick<WorldRuleset, 'statDefinitions' | 'resourceDefinitions'> &
  Partial<Pick<WorldRuleset, 'levelTable'>>;

interface ReplaySheetEntry {
  name: string;
  quantity?: number;
  sourceEntityId?: string;
  definitionId?: string;
}

/** The character sheet fields replay starts from. */
export interface ReplaySheet {
  id: string;
  characterEntityId?: string;
  characterId?: string;
  name: string;
  /** Starting level and XP; replayed `xp_gain` commands build on them. */
  level?: number;
  experience?: number;
  stats: Array<{definitionId: string; value: number | boolean | string}>;
  resources: Array<{definitionId: string; current: number; max: number}>;
  statuses?: string[];
  inventoryEntries?: ReplaySheetEntry[];
  equipmentEntries?: ReplaySheetEntry[];
  statusEntries?: ReplaySheetEntry[];
}

/** Maps a legacy actor id recorded on old events to its canonical entity id. */
export interface ActorResolutionReference {
  legacyActorId: string;
  entityId: string;
}

/** XP and level at a point in the manuscript. */
export interface CharacterProgressionState {
  experience: number;
  level: number;
  /** The sheet's level; a level table never takes a character below it. */
  startingLevel: number;
  /** The ruleset's level table, normalized; empty when there is none. */
  levelTable: readonly LevelThreshold[];
}

export interface CharacterReplayState {
  actorId: string;
  actorName: string;
  stats: Record<string, number | boolean | string>;
  resources: {
    current: Record<string, number>;
    max: Record<string, number>;
  };
  inventory: {
    items: Array<{
      name: string;
      quantity: number;
      sourceEntityId?: string;
      definitionId?: string;
    }>;
    equipped: string[];
  };
  statuses: string[];
  locationName?: string;
  /** The World Bible place record for `locationName`, when the position links to one (slice 4.77). */
  locationPlaceId?: string;
  progression: CharacterProgressionState;
}

export type CharacterStateReplayBaseline = CharacterReplayState;

export interface ReplayableCharacterTarget {
  characterId?: string;
  sheetId?: string;
  actorId?: string;
  actorName?: string;
}
