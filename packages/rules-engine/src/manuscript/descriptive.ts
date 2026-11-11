import type {ReplaySheet, StateMutationCommand} from './types';

/*
 * Descriptive state (4.27): where a character is and what they hold. A
 * character without a sheet or ruleset carries only these kinds; stats,
 * resources, statuses, and XP stay with sheets.
 */

export const DESCRIPTIVE_STATE_COMMAND_TYPES = [
  'location_set',
  'inventory_add',
  'inventory_remove',
  'inventory_consume',
  'inventory_equip',
  'inventory_unequip'
] as const satisfies ReadonlyArray<StateMutationCommand['type']>;

const descriptiveTypes: ReadonlySet<string> = new Set(DESCRIPTIVE_STATE_COMMAND_TYPES);

export function isDescriptiveStateCommand(command: Pick<StateMutationCommand, 'type'>): boolean {
  return descriptiveTypes.has(command.type);
}

/**
 * The replay starting point for a character without a sheet: nothing held,
 * no location. Its state comes only from accepted scene changes.
 */
export function buildDescriptiveReplaySheet(params: {
  entityId: string;
  name: string;
}): ReplaySheet {
  return {
    id: params.entityId,
    characterEntityId: params.entityId,
    name: params.name,
    stats: [],
    resources: []
  };
}
