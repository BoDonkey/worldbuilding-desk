import type {
  CompendiumEntry,
  EntityCategory,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity
} from '../../entityTypes';
import {
  COMPENDIUM_ENTRY_STORE_NAME,
  ENTITY_STORE_NAME,
  openDb,
  STATE_MUTATION_EVENT_STORE_NAME
} from '../../db';
import {isItemCategory} from '../worldBible/worldBibleSummary';
import {buildCompoundChangePreview} from './positionedStateChange';
import {
  validateStateMutationEventForRuleset,
  type CharacterReplayState
} from './stateReplay';
import {validateStateMutationEvent} from './stateMutationSchemas';

const normalizeItemName = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

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
  const normalizedName = normalizeItemName(params.itemName);
  const itemCategoryIds = new Set(
    params.categories.filter(isItemCategory).map((category) => category.id)
  );
  const entityMatches = normalizedName
    ? params.entities.filter(
        (entity) =>
          itemCategoryIds.has(entity.categoryId) &&
          normalizeItemName(entity.name) === normalizedName
      )
    : [];
  const compendiumMatches = normalizedName
    ? params.compendiumEntries.filter(
        (entry) => normalizeItemName(entry.name) === normalizedName
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

  validateStateMutationEvent(plan.event);
  const rulesetIssues = validateStateMutationEventForRuleset({
    event: plan.event,
    ruleset: params.ruleset
  });
  if (rulesetIssues.length > 0) throw new Error(rulesetIssues.join(' '));
  if (params.before) {
    const preview = buildCompoundChangePreview({
      before: params.before,
      commands: plan.event.commands
    });
    if (preview.issues.length > 0) throw new Error(preview.issues.join(' '));
  }
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function applyItemStateAuthoringPlan(params: {
  plan: ItemStateAuthoringWritePlan;
  ruleset: StoredRuleset | null;
  before?: CharacterReplayState;
}): Promise<void> {
  validateItemStateAuthoringPlan(params);
  const {plan} = params;
  const stores = [STATE_MUTATION_EVENT_STORE_NAME];
  if (plan.entityToSave) stores.push(ENTITY_STORE_NAME);
  if (plan.compendiumEntryToSave) stores.push(COMPENDIUM_ENTRY_STORE_NAME);
  const db = await openDb();
  const transaction = db.transaction(stores, 'readwrite');
  if (plan.entityToSave) {
    transaction.objectStore(ENTITY_STORE_NAME).put(plan.entityToSave);
  }
  if (plan.compendiumEntryToSave) {
    transaction
      .objectStore(COMPENDIUM_ENTRY_STORE_NAME)
      .put(plan.compendiumEntryToSave);
  }
  transaction.objectStore(STATE_MUTATION_EVENT_STORE_NAME).put(plan.event);
  await transactionToPromise(transaction);

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
