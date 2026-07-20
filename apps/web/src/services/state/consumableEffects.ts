import type {
  CompendiumConsumableDefinition,
  CompendiumEntry,
  StateMutationCommand
} from '../../entityTypes';

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
}): StateMutationCommand[] {
  const commands: StateMutationCommand[] = [{
    type: 'inventory_consume',
    actorId: params.actorId,
    itemName: params.itemName,
    quantity: 1
  }];
  params.definition.effects.forEach((effect) => {
    commands.push(effect.type === 'stat_change'
      ? {
          type: 'stat_change',
          actorId: params.actorId,
          statDefinitionId: effect.definitionId,
          delta: effect.delta
        }
      : {
          type: 'resource_change',
          actorId: params.actorId,
          resourceDefinitionId: effect.definitionId,
          delta: effect.delta
        });
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
    effect.type === 'stat_change'
      ? {
          type: 'stat_change',
          actorId: params.actorId,
          statDefinitionId: effect.definitionId,
          delta: -effect.delta
        }
      : {
          type: 'resource_change',
          actorId: params.actorId,
          resourceDefinitionId: effect.definitionId,
          delta: -effect.delta
        }
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
