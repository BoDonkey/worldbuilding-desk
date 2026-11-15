import type {
  CharacterResource,
  CharacterStat,
  StoredRuleset
} from '../../entityTypes';
import {
  reconcileCharacterResources,
  reconcileCharacterStats
} from './characterSheetRuleset';

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
