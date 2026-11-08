import type {
  CompendiumConsumableDefinition,
  CompendiumEntry,
  StateMutationCommand
} from '../../entityTypes';
import {consumableEffectToCommand} from './kinds';

export function findConsumableEntry(params: {
  entries: CompendiumEntry[];
  item: {name: string; definitionId?: string};
}): CompendiumEntry | null {
  const linked = params.item.definitionId
    ? params.entries.find((entry) => entry.id === params.item.definitionId)
    : null;
  if (linked?.consumable) return linked;
  const normalizedName = params.item.name.trim().toLocaleLowerCase();
  return params.entries.find(
    (entry) => entry.consumable && entry.name.trim().toLocaleLowerCase() === normalizedName
  ) ?? null;
}

export function buildConsumableCommands(params: {
  actorId: string;
  itemName: string;
  definition: CompendiumConsumableDefinition;
  itemReference?: {sourceEntityId?: string; definitionId?: string};
}): StateMutationCommand[] {
  const commands: StateMutationCommand[] = [{
    type: 'inventory_consume',
    actorId: params.actorId,
    itemName: params.itemName,
    quantity: 1,
    sourceEntityId: params.itemReference?.sourceEntityId,
    definitionId: params.itemReference?.definitionId
  }];
  params.definition.effects.forEach((effect) => {
    commands.push(consumableEffectToCommand({actorId: params.actorId, effect}));
  });
  if (params.definition.statusName?.trim()) {
    commands.push({
      type: 'status_apply',
      actorId: params.actorId,
      statusName: params.definition.statusName.trim()
    });
  }
  return commands;
}

export function buildConsumableExpirationCommands(params: {
  actorId: string;
  definition: CompendiumConsumableDefinition;
}): StateMutationCommand[] {
  const commands: StateMutationCommand[] = params.definition.effects.map((effect) =>
    consumableEffectToCommand({actorId: params.actorId, effect, reverse: true})
  );
  if (params.definition.statusName?.trim()) {
    commands.push({
      type: 'status_remove',
      actorId: params.actorId,
      statusName: params.definition.statusName.trim()
    });
  }
  return commands;
}
