import type {
  CharacterResource,
  CharacterStat,
  StateMutationCommand,
  StoredRuleset
} from '../../entityTypes';
import {
  reconcileCharacterResources,
  reconcileCharacterStats
} from './characterSheetRuleset';

export function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

export function buildDefaultStats(
  ruleset: StoredRuleset | null
): CharacterStat[] {
  return reconcileCharacterStats(ruleset, []);
}

export function buildDefaultResources(
  ruleset: StoredRuleset | null
): CharacterResource[] {
  return reconcileCharacterResources(ruleset, []);
}

export function summarizeMutationCommand(command: StateMutationCommand): string {
  switch (command.type) {
    case 'resource_change':
      return `Resource ${command.resourceDefinitionId} ${command.delta >= 0 ? '+' : ''}${command.delta}`;
    case 'resource_set':
      return `Resource ${command.resourceDefinitionId} = ${command.value}`;
    case 'stat_change':
      return `Stat ${command.statDefinitionId} -> delta ${String(command.delta)}`;
    case 'stat_set':
      return `Stat ${command.statDefinitionId} = ${String(command.value)}`;
    case 'status_apply':
      return `Apply status ${command.statusName}`;
    case 'status_remove':
      return `Remove status ${command.statusName}`;
    case 'inventory_add':
      return `Add ${command.itemName}${command.quantity ? ` x${command.quantity}` : ''}`;
    case 'inventory_remove':
      return `Remove ${command.itemName}${command.quantity ? ` x${command.quantity}` : ''}`;
    case 'inventory_consume':
      return `Consume ${command.itemName}${command.quantity ? ` x${command.quantity}` : ''}`;
    case 'inventory_equip':
      return `Equip ${command.itemName}`;
    case 'inventory_unequip':
      return `Unequip ${command.itemName}`;
    case 'location_set':
      return `Move to ${command.locationName}`;
  }
}
