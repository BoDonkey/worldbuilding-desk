import 'fake-indexeddb/auto';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {CharacterSheet, StateMutationEvent, StoredRuleset} from '../../entityTypes';
import {
  getStateMutationEventById,
  getStateMutationEventsByProject,
  saveStateMutationEvents,
  saveWritingDocument
} from '../storage';
import {openDb, STATE_MUTATION_EVENT_STORE_NAME} from '../storage/db';
import {
  acceptStateChangeProposal,
  replaceSceneStateChangesBySource,
  saveStateChange
} from './stateChangeSave';
import {buildStateSubjects, replayStateSubject} from './stateSubjects';

const ruleset = {
  id: 'rules', projectId: 'project', name: 'Rules', description: '', version: '1',
  statDefinitions: [], resourceDefinitions: [],
  rules: [], itemTemplates: [], statusTemplates: [], createdAt: 1, updatedAt: 1
} satisfies StoredRuleset;

const sheet: CharacterSheet = {
  id: 'sheet', projectId: 'project', characterId: 'character', characterEntityId: 'entity-mira',
  name: 'Mira', level: 1, experience: 0, stats: [], resources: [], inventory: [],
  createdAt: 1, updatedAt: 1
};

const stateSubjects = buildStateSubjects({characterSheets: [sheet], characterEntities: []});

const makeEvent = (
  overrides: Partial<StateMutationEvent> & Pick<StateMutationEvent, 'id' | 'commands'>
): StateMutationEvent => ({
  projectId: 'project', sceneId: 'scene-1', sceneTitle: 'Arrival', sceneOrder: 1,
  sceneSequence: 1, sourceType: 'deterministic-review', sourceRevision: 1,
  sourceHash: 'hash', status: 'proposed', createdAt: 1, ...overrides
});

const addRope = makeEvent({
  id: 'add-rope',
  commands: [{type: 'inventory_add', actorId: 'entity-mira', itemName: 'Rope', quantity: 1}]
});
const equipRope = makeEvent({
  id: 'equip-rope',
  sceneSequence: 2,
  commands: [{type: 'inventory_equip', actorId: 'entity-mira', itemName: 'Rope'}]
});

// The ledger announces each write on `window`; this suite runs without a DOM.
vi.stubGlobal('window', new EventTarget());

async function clearLedger(): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readwrite');
  transaction.objectStore(STATE_MUTATION_EVENT_STORE_NAME).clear();
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

const accept = (eventId: string) =>
  acceptStateChangeProposal({eventId, projectId: 'project', stateSubjects, ruleset});

describe('saving a state change', () => {
  beforeEach(async () => {
    await clearLedger();
    // Changes whose scene is missing are invalidated on load (slice 3.38).
    await saveWritingDocument({
      id: 'scene-1', projectId: 'project', title: 'Arrival', content: 'Scene text',
      order: 1, createdAt: 1, updatedAt: 1
    });
  });

  it('does not save a change that fails the state check', async () => {
    const before = replayStateSubject({subject: stateSubjects[0], ruleset, events: []});
    await expect(saveStateChange({
      event: {...equipRope, status: 'accepted'}, ruleset, before
    })).rejects.toThrow();
    expect(await getStateMutationEventById(equipRope.id)).toBeUndefined();

    await saveStateChange({event: {...addRope, status: 'accepted'}, ruleset, before});
    expect(await getStateMutationEventById(addRope.id)).toMatchObject({status: 'accepted'});
  });

  it('accepts a suggestion only when the stored story supports it', async () => {
    await saveStateMutationEvents([addRope, equipRope]);

    await expect(accept(equipRope.id)).rejects.toThrow();
    expect(await getStateMutationEventById(equipRope.id)).toMatchObject({status: 'proposed'});

    await accept(addRope.id);
    await accept(equipRope.id);
    expect(await getStateMutationEventById(equipRope.id)).toMatchObject({status: 'accepted'});
  });

  it('checks the stored event, not the copy on screen', async () => {
    await saveStateMutationEvents([{...addRope, status: 'invalidated'}]);
    await expect(accept(addRope.id)).rejects.toThrow('no longer waiting for review');
    await expect(accept('missing')).rejects.toThrow('no longer waiting for review');
  });

  it('refuses a suggestion whose character is gone', async () => {
    await saveStateMutationEvents([addRope]);
    await expect(acceptStateChangeProposal({
      eventId: addRope.id, projectId: 'project', stateSubjects: [], ruleset
    })).rejects.toThrow('no longer in the project');
    expect(await getStateMutationEventById(addRope.id)).toMatchObject({status: 'proposed'});
  });

  it('keeps an accepted change the new review derives again', async () => {
    await saveStateMutationEvents([{...addRope, status: 'accepted'}, equipRope]);
    await replaceSceneStateChangesBySource({
      projectId: 'project',
      sceneId: 'scene-1',
      sourceType: 'deterministic-review',
      nextEvents: [{...addRope, id: 'add-rope-again', sourceHash: 'new-hash'}],
      invalidationReason: 'Scene saved again.',
      invalidatedAt: 5
    });
    const events = await getStateMutationEventsByProject('project');
    expect(events.map((event) => [event.id, event.status, event.sourceHash]).sort()).toEqual([
      ['add-rope', 'accepted', 'new-hash'],
      ['equip-rope', 'invalidated', 'hash']
    ]);
  });
});
