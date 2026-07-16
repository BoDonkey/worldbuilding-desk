import type {
  CharacterResource,
  CharacterStat,
  StoredRuleset
} from '../../entityTypes';

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
