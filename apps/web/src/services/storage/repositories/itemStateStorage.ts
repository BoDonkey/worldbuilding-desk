import type {ItemStateAuthoringWritePlan} from '../../state/itemStateAuthoringService';
import {
  COMPENDIUM_ENTRY_STORE_NAME,
  ENTITY_STORE_NAME,
  openDb,
  STATE_MUTATION_EVENT_STORE_NAME
} from '../db';
import {transactionToPromise} from '../idbRequest';

/** Writes an item-state plan's event, entity, and compendium entry in one transaction. */
export async function saveItemStateAuthoringPlan(plan: ItemStateAuthoringWritePlan): Promise<void> {
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
  if (plan.eventToInvalidate) {
    transaction
      .objectStore(STATE_MUTATION_EVENT_STORE_NAME)
      .put(plan.eventToInvalidate);
  }
  await transactionToPromise(transaction);
}
