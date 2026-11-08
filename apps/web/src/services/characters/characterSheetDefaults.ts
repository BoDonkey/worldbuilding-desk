import type {
  CharacterResource,
  CharacterStat,
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
