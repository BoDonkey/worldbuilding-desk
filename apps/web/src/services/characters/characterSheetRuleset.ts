import type {
  CharacterResource,
  CharacterStat,
  StateMutationCommand,
  StoredRuleset
} from '../../entityTypes';
import {getAppStateKind} from '../state/kinds';

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
  return getAppStateKind(input.mutationType).sheetForm.build({
    actorId,
    statDefinition: input.statDefinition,
    resourceDefinition: input.resourceDefinition,
    numericValue: Number(input.numberValue),
    textValue: input.textValue,
    booleanValue: input.booleanValue,
    quantity: Math.max(1, Number(input.quantity) || 1),
    statusName: input.statusName.trim(),
    itemName: input.itemName.trim(),
    locationName: input.locationName.trim()
  });
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
