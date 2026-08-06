import type {
  CharacterResource,
  CharacterStat,
  StateMutationCommand,
  StoredRuleset
} from '../../entityTypes';

export type CharacterSheetMutationCommandInput = {
  actorId: string;
  mutationType: StateMutationCommand['type'];
  statDefinition: StoredRuleset['statDefinitions'][number] | null;
  resourceDefinition: StoredRuleset['resourceDefinitions'][number] | null;
  numberValue: string;
  textValue: string;
  booleanValue: boolean;
  statusName: string;
  itemName: string;
  quantity: string;
  locationName: string;
};

export function buildCharacterSheetMutationCommand(
  input: CharacterSheetMutationCommandInput
): StateMutationCommand | null {
  const actorId = input.actorId.trim();
  if (!actorId) return null;
  const numericValue = Number(input.numberValue);
  const quantity = Math.max(1, Number(input.quantity) || 1);
  const itemName = input.itemName.trim();
  const statusName = input.statusName.trim();
  const locationName = input.locationName.trim();

  switch (input.mutationType) {
    case 'resource_change':
      return input.resourceDefinition && Number.isFinite(numericValue)
        ? {
            type: 'resource_change',
            actorId,
            resourceDefinitionId: input.resourceDefinition.id,
            delta: numericValue
          }
        : null;
    case 'resource_set':
      return input.resourceDefinition && Number.isFinite(numericValue)
        ? {
            type: 'resource_set',
            actorId,
            resourceDefinitionId: input.resourceDefinition.id,
            value: numericValue
          }
        : null;
    case 'stat_change':
      if (!input.statDefinition) return null;
      if (input.statDefinition.type === 'number' && Number.isFinite(numericValue)) {
        return {
          type: 'stat_change',
          actorId,
          statDefinitionId: input.statDefinition.id,
          delta: numericValue
        };
      }
      if (input.statDefinition.type === 'boolean') {
        return {
          type: 'stat_change',
          actorId,
          statDefinitionId: input.statDefinition.id,
          delta: input.booleanValue
        };
      }
      return {
        type: 'stat_change',
        actorId,
        statDefinitionId: input.statDefinition.id,
        delta: input.textValue
      };
    case 'stat_set':
      if (!input.statDefinition) return null;
      if (input.statDefinition.type === 'number' && Number.isFinite(numericValue)) {
        return {
          type: 'stat_set',
          actorId,
          statDefinitionId: input.statDefinition.id,
          value: numericValue
        };
      }
      if (input.statDefinition.type === 'boolean') {
        return {
          type: 'stat_set',
          actorId,
          statDefinitionId: input.statDefinition.id,
          value: input.booleanValue
        };
      }
      return {
        type: 'stat_set',
        actorId,
        statDefinitionId: input.statDefinition.id,
        value: input.textValue
      };
    case 'status_apply':
    case 'status_remove':
      return statusName
        ? {type: input.mutationType, actorId, statusName}
        : null;
    case 'inventory_add':
    case 'inventory_remove':
    case 'inventory_consume':
      return itemName
        ? {type: input.mutationType, actorId, itemName, quantity}
        : null;
    case 'inventory_equip':
    case 'inventory_unequip':
      return itemName ? {type: input.mutationType, actorId, itemName} : null;
    case 'location_set':
      return locationName ? {type: 'location_set', actorId, locationName} : null;
  }
}

export function reconcileCharacterStats(
  ruleset: StoredRuleset | null,
  current: CharacterStat[]
): CharacterStat[] {
  if (!ruleset) return [];
  const currentByDefinitionId = new Map(
    current.map((stat) => [stat.definitionId, stat])
  );
  return ruleset.statDefinitions.map((definition) => {
    const existing = currentByDefinitionId.get(definition.id);
    return existing ?? {
      definitionId: definition.id,
      value: typeof definition.defaultValue === 'number' ? definition.defaultValue : 0
    };
  });
}

export function reconcileCharacterResources(
  ruleset: StoredRuleset | null,
  current: CharacterResource[]
): CharacterResource[] {
  if (!ruleset) return [];
  const currentByDefinitionId = new Map(
    current.map((resource) => [resource.definitionId, resource])
  );
  return ruleset.resourceDefinitions.map((definition) => {
    const existing = currentByDefinitionId.get(definition.id);
    if (existing) return existing;
    const initial =
      typeof definition.defaultValue === 'number' ? definition.defaultValue : 0;
    return {
      definitionId: definition.id,
      current: initial,
      max: initial
    };
  });
}
