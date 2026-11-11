import {describe, expect, it} from 'vitest';
import type {CharacterSheet, StateMutationEvent, StoredRuleset} from '../../entityTypes';
import {
  buildStateSubjectLookup,
  buildStateSubjects,
  findStateSubject,
  recordableStateSubjects,
  replayStateSubject,
  stateSubjectAccepts
} from './stateSubjects';

const sheet = (overrides: Partial<CharacterSheet> & Pick<CharacterSheet, 'id' | 'name'>): CharacterSheet => ({
  projectId: 'project',
  level: 1,
  experience: 0,
  stats: [],
  resources: [],
  inventory: [],
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

const kaelSheet = sheet({id: 'sheet-kael', characterId: 'character-kael', characterEntityId: 'entity-kael', name: 'Kael'});
const legacySheet = sheet({id: 'sheet-old', characterId: 'character-old', name: 'Old Mira'});
const characterEntities = [
  {id: 'entity-kael', name: 'Kael (World Bible)'},
  {id: 'entity-sera', name: 'Sera'}
];

describe('state subjects', () => {
  const subjects = buildStateSubjects({characterSheets: [kaelSheet, legacySheet], characterEntities});

  it('lists sheets, then World Bible characters that have no sheet', () => {
    expect(subjects.map(({actorId, name, legacy, sheet}) => ({actorId, name, legacy, hasSheet: Boolean(sheet)})))
      .toEqual([
        {actorId: 'entity-kael', name: 'Kael', legacy: false, hasSheet: true},
        {actorId: 'character-old', name: 'Old Mira', legacy: true, hasSheet: true},
        {actorId: 'entity-sera', name: 'Sera', legacy: false, hasSheet: false}
      ]);
    expect(recordableStateSubjects(subjects).map((subject) => subject.actorId))
      .toEqual(['entity-kael', 'entity-sera']);
  });

  it('finds a subject by any of its ids and by resolved legacy ids', () => {
    expect(findStateSubject('sheet-kael', subjects)?.name).toBe('Kael');
    expect(findStateSubject('character-kael', subjects)?.name).toBe('Kael');
    expect(findStateSubject('entity-sera', subjects)?.name).toBe('Sera');
    expect(findStateSubject('Sera', subjects)).toBeNull();
    const lookup = buildStateSubjectLookup(subjects, [{
      id: 'resolution', projectId: 'project', legacyActorId: 'old-sera-id',
      legacyActorType: 'character', entityId: 'entity-sera', createdAt: 1
    }]);
    expect(lookup.get('old-sera-id')?.name).toBe('Sera');
  });

  it('gives characters without a sheet location and item changes only', () => {
    const sera = findStateSubject('entity-sera', subjects)!;
    const kael = findStateSubject('entity-kael', subjects)!;
    expect(stateSubjectAccepts(sera, {type: 'location_set'})).toBe(true);
    expect(stateSubjectAccepts(sera, {type: 'inventory_add'})).toBe(true);
    expect(stateSubjectAccepts(sera, {type: 'resource_change'})).toBe(false);
    expect(stateSubjectAccepts(sera, {type: 'xp_gain'})).toBe(false);
    expect(stateSubjectAccepts(kael, {type: 'resource_change'})).toBe(true);
  });

  it('replays a character without a sheet with no ruleset defaults', () => {
    const ruleset = {
      id: 'rules', projectId: 'project', name: 'Rules', version: '1',
      statDefinitions: [{id: 'str', name: 'Strength', type: 'number', defaultValue: 5}],
      resourceDefinitions: [{id: 'hp', name: 'Health', type: 'number', defaultValue: 10}],
      rules: [], itemTemplates: [], statusTemplates: [], createdAt: 1, updatedAt: 1
    } satisfies StoredRuleset;
    const events: StateMutationEvent[] = [{
      id: 'move', projectId: 'project', sceneId: 'scene-1', sceneOrder: 1,
      sourceRevision: 1, sourceHash: 'h', status: 'accepted', createdAt: 1,
      commands: [{type: 'location_set', actorId: 'entity-sera', locationName: 'Highmoor'}]
    }];
    const state = replayStateSubject({subject: findStateSubject('entity-sera', subjects)!, ruleset, events});
    expect(state).toMatchObject({actorId: 'entity-sera', actorName: 'Sera', locationName: 'Highmoor'});
    expect(state.stats).toEqual({});
    expect(state.resources).toEqual({current: {}, max: {}});
  });
});
