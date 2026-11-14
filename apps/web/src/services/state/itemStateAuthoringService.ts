import type {
  CompendiumEntry,
  EntityCategory,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity
} from '../../entityTypes';
import {isItemCategory} from '../worldBible/worldBibleSummary';
import type {CharacterReplayState} from './stateReplay';
import {assertStateChangeValid} from './stateChangeValidation';
import {saveItemStateAuthoringPlan} from '../storage';
import {normalizeNameExact} from '../names/nameMatching';

export interface ReusableItemResolution {
  normalizedName: string;
  entityMatches: WorldEntity[];
  compendiumMatches: CompendiumEntry[];
  sourceEntityId?: string;
  definitionId?: string;
  status: 'unresolved' | 'exact' | 'ambiguous';
}

export function resolveReusableItem(params: {
  itemName: string;
  categories: EntityCategory[];
  entities: WorldEntity[];
  compendiumEntries: CompendiumEntry[];
}): ReusableItemResolution {
  const normalizedName = normalizeNameExact(params.itemName);
  const itemCategoryIds = new Set(
    params.categories.filter(isItemCategory).map((category) => category.id)
  );
  const entityMatches = normalizedName
    ? params.entities.filter(
        (entity) =>
          itemCategoryIds.has(entity.categoryId) &&
          normalizeNameExact(entity.name) === normalizedName
      )
    : [];
  const compendiumMatches = normalizedName
    ? params.compendiumEntries.filter(
        (entry) => normalizeNameExact(entry.name) === normalizedName
      )
    : [];

  if (entityMatches.length > 1 || compendiumMatches.length > 1) {
    return {normalizedName, entityMatches, compendiumMatches, status: 'ambiguous'};
  }

  const entity = entityMatches[0];
  const definition = compendiumMatches[0];
  if (
    entity &&
    definition?.sourceEntityId &&
    definition.sourceEntityId !== entity.id
  ) {
    return {normalizedName, entityMatches, compendiumMatches, status: 'ambiguous'};
  }
  if (!entity && !definition) {
    return {normalizedName, entityMatches, compendiumMatches, status: 'unresolved'};
  }

  return {
    normalizedName,
    entityMatches,
    compendiumMatches,
    sourceEntityId: entity?.id ?? definition?.sourceEntityId,
    definitionId: definition?.id,
    status: 'exact'
  };
}

export interface ItemStateAuthoringWritePlan {
  projectId: string;
  event: StateMutationEvent;
  eventToInvalidate?: StateMutationEvent;
  entityToSave?: WorldEntity;
  compendiumEntryToSave?: CompendiumEntry;
}

export function validateItemStateAuthoringPlan(params: {
  plan: ItemStateAuthoringWritePlan;
  ruleset: StoredRuleset | null;
  before?: CharacterReplayState;
}): void {
  const {plan} = params;
  if (!plan.projectId.trim()) throw new Error('Project is required.');
  if (plan.event.projectId !== plan.projectId) {
    throw new Error('Scene change belongs to a different project.');
  }
  if (
    plan.eventToInvalidate?.projectId !== undefined &&
    plan.eventToInvalidate.projectId !== plan.projectId
  ) {
    throw new Error('Superseded proposal belongs to a different project.');
  }
  if (plan.entityToSave?.projectId !== undefined &&
      plan.entityToSave.projectId !== plan.projectId) {
    throw new Error('World item belongs to a different project.');
  }
  if (plan.compendiumEntryToSave?.projectId !== undefined &&
      plan.compendiumEntryToSave.projectId !== plan.projectId) {
    throw new Error('Item mechanics belong to a different project.');
  }
  if (
    plan.entityToSave &&
    plan.compendiumEntryToSave?.sourceEntityId &&
    plan.compendiumEntryToSave.sourceEntityId !== plan.entityToSave.id
  ) {
    throw new Error('Item mechanics link to a different World Bible item.');
  }

  assertStateChangeValid({event: plan.event, ruleset: params.ruleset, before: params.before});
}

export async function applyItemStateAuthoringPlan(params: {
  plan: ItemStateAuthoringWritePlan;
  ruleset: StoredRuleset | null;
  before?: CharacterReplayState;
}): Promise<void> {
  validateItemStateAuthoringPlan(params);
  const {plan} = params;
  await saveItemStateAuthoringPlan(plan);

  if (typeof window !== 'undefined') {
    if (plan.entityToSave) {
      window.dispatchEvent(new CustomEvent('wbd:entity-records-changed'));
    }
    if (plan.compendiumEntryToSave) {
      window.dispatchEvent(new CustomEvent('wbd:compendium-records-changed'));
    }
    window.dispatchEvent(new CustomEvent('wbd:state-mutation-events-changed'));
  }
}
