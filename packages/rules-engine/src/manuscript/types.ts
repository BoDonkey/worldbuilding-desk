import type {WorldRuleset} from '../types/WorldRuleset';

/*
 * Manuscript-time state model: accepted ledger events ordered by scene, never
 * wall-clock time. Moved from apps/web (Slice 3.10); persistence and project
 * lookups stay in the app and are passed in as data.
 */

export type StateMutationActorId = string;
export type StateMutationInventoryQuantity = number;

export type ResourceChangeStateMutationCommand = {
  type: 'resource_change';
  actorId: StateMutationActorId;
  resourceDefinitionId: string;
  delta: number;
};

export type ResourceSetStateMutationCommand = {
  type: 'resource_set';
  actorId: StateMutationActorId;
  resourceDefinitionId: string;
  value: number;
};

export type StatChangeStateMutationCommand = {
  type: 'stat_change';
  actorId: StateMutationActorId;
  statDefinitionId: string;
  delta: number | boolean | string;
};

export type StatSetStateMutationCommand = {
  type: 'stat_set';
  actorId: StateMutationActorId;
  statDefinitionId: string;
  value: number | boolean | string;
};

export type StatusStateMutationCommand = {
  type: 'status_apply' | 'status_remove';
  actorId: StateMutationActorId;
  statusName: string;
};

export type InventoryQuantityStateMutationCommand = {
  type: 'inventory_add' | 'inventory_remove' | 'inventory_consume';
  actorId: StateMutationActorId;
  itemName: string;
  quantity?: StateMutationInventoryQuantity;
  sourceEntityId?: string;
  definitionId?: string;
};

export type InventoryEquipStateMutationCommand = {
  type: 'inventory_equip' | 'inventory_unequip';
  actorId: StateMutationActorId;
  itemName: string;
  sourceEntityId?: string;
  definitionId?: string;
};

export type LocationSetStateMutationCommand = {
  type: 'location_set';
  actorId: StateMutationActorId;
  locationName: string;
};

export type StateMutationCommand =
  | ResourceChangeStateMutationCommand
  | ResourceSetStateMutationCommand
  | StatChangeStateMutationCommand
  | StatSetStateMutationCommand
  | StatusStateMutationCommand
  | InventoryQuantityStateMutationCommand
  | InventoryEquipStateMutationCommand
  | LocationSetStateMutationCommand;

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
export type ManuscriptRuleset = Pick<WorldRuleset, 'statDefinitions' | 'resourceDefinitions'>;

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
}

export type CharacterStateReplayBaseline = CharacterReplayState;

export interface ReplayableCharacterTarget {
  characterId?: string;
  sheetId?: string;
  actorId?: string;
  actorName?: string;
}
