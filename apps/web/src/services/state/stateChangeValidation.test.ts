import {describe, expect, it} from 'vitest';
import type {CharacterSheet, StateMutationEvent, StoredRuleset} from '../../entityTypes';
import {
  assertStateChangeValid,
  findStateChangeAcceptanceIssues,
  findStateChangeIssues,
  MISSING_SUBJECT_ISSUE
} from './stateChangeValidation';
import {buildStateSubjects, replayStateSubject} from './stateSubjects';

const ruleset = {
  id: 'rules', projectId: 'project', name: 'Rules', description: '', version: '1',
  statDefinitions: [],
  resourceDefinitions: [{id: 'hp', name: 'Health', type: 'number', defaultValue: 10}],
  rules: [], itemTemplates: [], statusTemplates: [], createdAt: 1, updatedAt: 1
} satisfies StoredRuleset;

const sheet: CharacterSheet = {
  id: 'sheet', projectId: 'project', characterId: 'character', characterEntityId: 'entity-mira',
  name: 'Mira', level: 1, experience: 0, stats: [],
  resources: [{definitionId: 'hp', current: 10, max: 10}], inventory: [],
  createdAt: 1, updatedAt: 1
};

const stateSubjects = buildStateSubjects({
  characterSheets: [sheet],
  characterEntities: [{id: 'entity-mira', name: 'Mira'}, {id: 'entity-sera', name: 'Sera'}]
});

const makeEvent = (
  overrides: Partial<StateMutationEvent> & Pick<StateMutationEvent, 'id' | 'commands'>
): StateMutationEvent => ({
  projectId: 'project', sceneId: 'scene-2', sceneTitle: 'Arrival', sceneOrder: 2,
  sceneSequence: 1, sourceType: 'deterministic-review', sourceRevision: 1,
  sourceHash: 'hash', status: 'proposed', createdAt: 1, ...overrides
});

const before = () =>
  replayStateSubject({subject: stateSubjects[0], ruleset, events: []});

describe('state change checks', () => {
  it('checks each command against the state the earlier ones leave', () => {
    const addThenEquip = makeEvent({
      id: 'ok',
      commands: [
        {type: 'inventory_add', actorId: 'entity-mira', itemName: 'Rope', quantity: 1},
        {type: 'inventory_equip', actorId: 'entity-mira', itemName: 'Rope'}
      ]
    });
    expect(findStateChangeIssues({event: addThenEquip, ruleset, before: before()})).toEqual([]);

    const secondCommandFails = makeEvent({
      id: 'bad',
      commands: [
        {type: 'inventory_add', actorId: 'entity-mira', itemName: 'Rope', quantity: 1},
        {type: 'inventory_equip', actorId: 'entity-mira', itemName: 'Lantern'}
      ]
    });
    expect(findStateChangeIssues({event: secondCommandFails, ruleset, before: before()}))
      .toHaveLength(1);
    expect(() => assertStateChangeValid({event: secondCommandFails, ruleset, before: before()}))
      .toThrow();
  });

  it('reports ids the ruleset does not have', () => {
    const event = makeEvent({
      id: 'unknown-resource',
      commands: [
        {type: 'resource_change', actorId: 'entity-mira', resourceDefinitionId: 'mana', delta: -1}
      ]
    });
    expect(findStateChangeIssues({event, ruleset, before: before()})).not.toEqual([]);
  });

  it('rejects an event whose shape is wrong', () => {
    const event = makeEvent({
      id: 'bad-shape',
      commands: [{type: 'inventory_add', actorId: 'entity-mira', itemName: 'Rope', quantity: 1}],
      sourceHash: ''
    });
    expect(() => assertStateChangeValid({event, ruleset, before: before()})).toThrow();
    expect(findStateChangeAcceptanceIssues({event, events: [], stateSubjects, ruleset}))
      .toEqual(['This change is not in a form that can be saved.']);
  });

  it('does not accept a suggestion with no commands', () => {
    const event = makeEvent({id: 'empty', commands: []});
    expect(findStateChangeAcceptanceIssues({event, events: [], stateSubjects, ruleset}))
      .toEqual(['This change has nothing to apply.']);
  });
});

describe('accepting a suggested state change', () => {
  const equipRope = makeEvent({
    id: 'equip',
    commands: [{type: 'inventory_equip', actorId: 'entity-mira', itemName: 'Rope'}]
  });
  const ropeAdded = makeEvent({
    id: 'rope',
    sceneId: 'scene-1',
    sceneOrder: 1,
    status: 'accepted',
    commands: [{type: 'inventory_add', actorId: 'entity-mira', itemName: 'Rope', quantity: 1}]
  });

  it('passes when the accepted story supports the change', () => {
    expect(findStateChangeAcceptanceIssues({
      event: equipRope, events: [ropeAdded], stateSubjects, ruleset
    })).toEqual([]);
  });

  it('fails when the change it relied on is no longer accepted', () => {
    expect(findStateChangeAcceptanceIssues({
      event: equipRope,
      events: [{...ropeAdded, status: 'invalidated'}],
      stateSubjects,
      ruleset
    })).toHaveLength(1);
  });

  it('ignores other suggestions that are still waiting', () => {
    expect(findStateChangeAcceptanceIssues({
      event: equipRope,
      events: [{...ropeAdded, status: 'proposed'}],
      stateSubjects,
      ruleset
    })).toHaveLength(1);
  });

  it('fails when the character is gone', () => {
    expect(findStateChangeAcceptanceIssues({
      event: makeEvent({
        id: 'gone',
        commands: [{type: 'location_set', actorId: 'entity-deleted', locationName: 'Highmoor'}]
      }),
      events: [],
      stateSubjects,
      ruleset
    })).toEqual([MISSING_SUBJECT_ISSUE]);
  });

  it('checks every command, each for its own character', () => {
    const event = makeEvent({
      id: 'two-characters',
      commands: [
        {type: 'location_set', actorId: 'entity-sera', locationName: 'Highmoor'},
        {type: 'inventory_equip', actorId: 'entity-mira', itemName: 'Lantern'}
      ]
    });
    const issues = findStateChangeAcceptanceIssues({event, events: [], stateSubjects, ruleset});
    expect(issues).toHaveLength(1);
    expect(issues).not.toContain(MISSING_SUBJECT_ISSUE);
  });

  it('finds a character through a resolved legacy id', () => {
    expect(findStateChangeAcceptanceIssues({
      event: makeEvent({
        id: 'legacy',
        commands: [{type: 'location_set', actorId: 'old-id', locationName: 'Highmoor'}]
      }),
      events: [],
      stateSubjects,
      actorResolutions: [{
        id: 'resolution', projectId: 'project', legacyActorType: 'sheet',
        legacyActorId: 'old-id', entityId: 'entity-sera', createdAt: 1
      }],
      ruleset
    })).toEqual([]);
  });
});
