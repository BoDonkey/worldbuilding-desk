import 'fake-indexeddb/auto';
import {beforeEach, describe, expect, it} from 'vitest';
import type {
  CompendiumEntry,
  EntityCategory,
  StateMutationEvent,
  WorldEntity
} from '../../entityTypes';
import {
  COMPENDIUM_ENTRY_STORE_NAME,
  ENTITY_STORE_NAME,
  openDb,
  STATE_MUTATION_EVENT_STORE_NAME
} from '../../db';
import {
  applyItemStateAuthoringPlan,
  resolveReusableItem
} from './itemStateAuthoringService';

const category: EntityCategory = {
  id: 'items', projectId: 'project-1', kind: 'general', name: 'Items', slug: 'items',
  fieldSchema: [], createdAt: 1
};
const entity: WorldEntity = {
  id: 'potion-entity', projectId: 'project-1', categoryId: category.id,
  name: 'Health Potion', fields: {}, links: [], createdAt: 1, updatedAt: 1
};
const definition: CompendiumEntry = {
  id: 'potion-definition', projectId: 'project-1', name: 'Health Potion',
  domain: 'artifact', sourceEntityId: entity.id, actions: [], createdAt: 1,
  updatedAt: 1, consumable: {effects: []}
};
const event: StateMutationEvent = {
  id: 'event-1', projectId: 'project-1', sceneId: 'scene-1', sceneOrder: 1,
  sourceRevision: 1, sourceHash: 'hash', status: 'accepted', createdAt: 1,
  commands: [{
    type: 'inventory_add', actorId: 'bill', itemName: 'Health Potion', quantity: 1,
    sourceEntityId: entity.id, definitionId: definition.id
  }]
};
const proposalEvent: StateMutationEvent = {
  ...event,
  id: 'proposal-1',
  status: 'proposed',
  sourceType: 'deterministic-review'
};

async function clearStores(): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction(
    [ENTITY_STORE_NAME, COMPENDIUM_ENTRY_STORE_NAME, STATE_MUTATION_EVENT_STORE_NAME],
    'readwrite'
  );
  transaction.objectStore(ENTITY_STORE_NAME).clear();
  transaction.objectStore(COMPENDIUM_ENTRY_STORE_NAME).clear();
  transaction.objectStore(STATE_MUTATION_EVENT_STORE_NAME).clear();
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function read(storeName: string, id: string): Promise<unknown> {
  const db = await openDb();
  const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(id);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('prose-proximate item/state foundation', () => {
  beforeEach(clearStores);

  it('resolves only exact unique reusable item links', () => {
    expect(resolveReusableItem({
      itemName: '  health   potion ', categories: [category], entities: [entity],
      compendiumEntries: [definition]
    })).toMatchObject({
      status: 'exact', sourceEntityId: entity.id, definitionId: definition.id
    });
    expect(resolveReusableItem({
      itemName: 'Health Potion', categories: [category],
      entities: [entity, {...entity, id: 'other'}], compendiumEntries: [definition]
    }).status).toBe('ambiguous');
  });

  it('writes canon, mechanics, and state in one transaction', async () => {
    await applyItemStateAuthoringPlan({
      plan: {
        projectId: 'project-1', entityToSave: entity,
        compendiumEntryToSave: definition, event
      },
      ruleset: null
    });
    expect(await read(ENTITY_STORE_NAME, entity.id)).toEqual(entity);
    expect(await read(COMPENDIUM_ENTRY_STORE_NAME, definition.id)).toEqual(definition);
    expect(await read(STATE_MUTATION_EVENT_STORE_NAME, event.id)).toEqual(event);
  });

  it('atomically supersedes the reviewed proposal with the confirmed event', async () => {
    await applyItemStateAuthoringPlan({
      plan: {
        projectId: 'project-1',
        event,
        eventToInvalidate: {
          ...proposalEvent,
          status: 'invalidated',
          invalidatedAt: 2,
          invalidationReason: 'Replaced by author-confirmed Workspace item proposal.'
        }
      },
      ruleset: null
    });

    expect(await read(STATE_MUTATION_EVENT_STORE_NAME, event.id)).toEqual(event);
    expect(await read(STATE_MUTATION_EVENT_STORE_NAME, proposalEvent.id)).toMatchObject({
      status: 'invalidated',
      invalidatedAt: 2
    });
  });

  it('validates the complete plan before opening a write transaction', async () => {
    await expect(applyItemStateAuthoringPlan({
      plan: {
        projectId: 'project-1', entityToSave: entity,
        compendiumEntryToSave: {...definition, projectId: 'other'}, event
      },
      ruleset: null
    })).rejects.toThrow('different project');
    expect(await read(ENTITY_STORE_NAME, entity.id)).toBeUndefined();
    expect(await read(STATE_MUTATION_EVENT_STORE_NAME, event.id)).toBeUndefined();
  });
});
