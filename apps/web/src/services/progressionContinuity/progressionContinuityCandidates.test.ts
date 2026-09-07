import {describe, expect, it} from 'vitest';
import type {
  CanonicalFact,
  Character,
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../../entityTypes';
import {
  buildAbandonedProgressionMethodCandidates,
  buildUnusedSolutionCandidates
} from './progressionContinuityCandidates';

const projectId = 'project-1';

const document = (id: string, order: number, content: string): WritingDocument => ({
  id,
  projectId,
  title: `Scene ${order + 1}`,
  content,
  order,
  createdAt: order + 1,
  updatedAt: order + 1
});

const character = (id: string, name: string): Character => ({
  id,
  projectId,
  name,
  fields: {},
  createdAt: 1,
  updatedAt: 1
});

const abilityFact = (id: string, targetId: string, value: string): CanonicalFact => ({
  id,
  projectId,
  targetType: 'character',
  targetId,
  factType: 'ability',
  value,
  acceptedAt: 1,
  updatedAt: 1
});

describe('buildUnusedSolutionCandidates', () => {
  it('flags a priority ability with several character appearances and zero mentions of it', () => {
    const documents = [
      document('scene-1', 0, 'Mira walked through the market, wary of guards.'),
      document('scene-2', 1, 'Mira hid behind a crate as footsteps approached.'),
      document('scene-3', 2, 'Mira watched the locked gate, unsure how to reach the far side.')
    ];
    const characters = [character('char-mira', 'Mira')];
    const facts = [abilityFact('fact-1', 'char-mira', 'Teleportation')];

    const candidates = buildUnusedSolutionCandidates({
      canonicalFacts: facts,
      characters,
      characterAliasesById: new Map(),
      documents
    });

    expect(candidates).toEqual([
      {
        key: 'unused_solution:char-mira:fact-1',
        kind: 'unused_solution',
        subjectLabel: 'Mira',
        detailText: 'Teleportation',
        sourceSceneIds: ['scene-1', 'scene-2', 'scene-3']
      }
    ]);
  });

  it('does not flag when the ability is mentioned in an appearance scene', () => {
    const documents = [
      document('scene-1', 0, 'Mira walked through the market.'),
      document('scene-2', 1, 'Mira teleported past the gate guards.'),
      document('scene-3', 2, 'Mira rested by the fire.')
    ];
    const candidates = buildUnusedSolutionCandidates({
      canonicalFacts: [abilityFact('fact-1', 'char-mira', 'Teleportation')],
      characters: [character('char-mira', 'Mira')],
      characterAliasesById: new Map(),
      documents
    });
    expect(candidates).toEqual([]);
  });

  it('does not flag a non-priority ability', () => {
    const documents = [
      document('scene-1', 0, 'Mira practiced her lockpicking.'),
      document('scene-2', 1, 'Mira practiced again.'),
      document('scene-3', 2, 'Mira practiced once more.')
    ];
    const candidates = buildUnusedSolutionCandidates({
      canonicalFacts: [abilityFact('fact-1', 'char-mira', 'Lockpicking')],
      characters: [character('char-mira', 'Mira')],
      characterAliasesById: new Map(),
      documents
    });
    expect(candidates).toEqual([]);
  });

  it('does not flag a character who appears in too few scenes to be meaningful', () => {
    const documents = [
      document('scene-1', 0, 'Mira walked through the market.'),
      document('scene-2', 1, 'Someone else entirely, elsewhere.')
    ];
    const candidates = buildUnusedSolutionCandidates({
      canonicalFacts: [abilityFact('fact-1', 'char-mira', 'Teleportation')],
      characters: [character('char-mira', 'Mira')],
      characterAliasesById: new Map(),
      documents
    });
    expect(candidates).toEqual([]);
  });

  it('counts alias mentions toward character appearances', () => {
    const documents = [
      document('scene-1', 0, 'The Shadowblade slipped past the guards.'),
      document('scene-2', 1, 'The Shadowblade waited in silence.'),
      document('scene-3', 2, 'The Shadowblade watched the locked gate.')
    ];
    const candidates = buildUnusedSolutionCandidates({
      canonicalFacts: [abilityFact('fact-1', 'char-mira', 'Teleportation')],
      characters: [character('char-mira', 'Mira')],
      characterAliasesById: new Map([['char-mira', ['Shadowblade']]]),
      documents
    });
    expect(candidates).toHaveLength(1);
  });
});

const ruleset: StoredRuleset = {
  id: 'rules',
  projectId,
  name: 'Rules',
  version: '1',
  statDefinitions: [{id: 'level', name: 'Level', type: 'number', defaultValue: 1}],
  resourceDefinitions: [{id: 'mana', name: 'Mana', type: 'number', min: 0, max: 10, defaultValue: 10}],
  rules: [],
  itemTemplates: [],
  statusTemplates: [],
  createdAt: 1,
  updatedAt: 1
};

const advancementEvent = (
  id: string,
  sceneId: string,
  label: string,
  status: StateMutationEvent['status'] = 'accepted'
): StateMutationEvent => ({
  id,
  projectId,
  sceneId,
  label,
  sourceRevision: 1,
  sourceHash: 'hash',
  status,
  commands: [{type: 'stat_change', actorId: 'char-mira', statDefinitionId: 'level', delta: 3}],
  createdAt: 1
});

describe('buildAbandonedProgressionMethodCandidates', () => {
  it('flags a labeled advancement method never mentioned again with room to recur', () => {
    const documents = [
      document('scene-1', 0, 'Mira used the Zenkai Boost and surged in power.'),
      document('scene-2', 1, 'Mira trained in the courtyard.'),
      document('scene-3', 2, 'Mira faced the next trial.')
    ];
    const candidates = buildAbandonedProgressionMethodCandidates({
      acceptedStateMutationEvents: [advancementEvent('event-1', 'scene-1', 'Zenkai Boost')],
      documents,
      ruleset
    });
    expect(candidates).toEqual([
      {
        key: 'abandoned_progression_method:zenkai boost',
        kind: 'abandoned_progression_method',
        subjectLabel: 'Zenkai Boost',
        detailText: 'Zenkai Boost',
        sourceSceneIds: ['scene-1']
      }
    ]);
  });

  it('does not flag when the method is mentioned again later', () => {
    const documents = [
      document('scene-1', 0, 'Mira used the Zenkai Boost and surged in power.'),
      document('scene-2', 1, 'Mira used the Zenkai Boost once more.'),
      document('scene-3', 2, 'Mira faced the next trial.')
    ];
    const candidates = buildAbandonedProgressionMethodCandidates({
      acceptedStateMutationEvents: [advancementEvent('event-1', 'scene-1', 'Zenkai Boost')],
      documents,
      ruleset
    });
    expect(candidates).toEqual([]);
  });

  it('does not flag when there is no room left in the manuscript for it to recur', () => {
    const documents = [
      document('scene-1', 0, 'Mira trained quietly.'),
      document('scene-2', 1, 'Mira used the Zenkai Boost and surged in power.')
    ];
    const candidates = buildAbandonedProgressionMethodCandidates({
      acceptedStateMutationEvents: [advancementEvent('event-1', 'scene-2', 'Zenkai Boost')],
      documents,
      ruleset
    });
    expect(candidates).toEqual([]);
  });

  it('ignores events without a descriptive label', () => {
    const documents = [
      document('scene-1', 0, 'Mira leveled up.'),
      document('scene-2', 1, 'Mira trained.'),
      document('scene-3', 2, 'Mira rested.')
    ];
    const candidates = buildAbandonedProgressionMethodCandidates({
      acceptedStateMutationEvents: [advancementEvent('event-1', 'scene-1', '')],
      documents,
      ruleset
    });
    expect(candidates).toEqual([]);
  });

  it('ignores a non-advancement axis change', () => {
    const documents = [
      document('scene-1', 0, 'Mira drank the potion and felt refreshed.'),
      document('scene-2', 1, 'Mira trained.'),
      document('scene-3', 2, 'Mira rested.')
    ];
    const manaEvent: StateMutationEvent = {
      id: 'event-1',
      projectId,
      sceneId: 'scene-1',
      label: 'Refreshing Potion',
      sourceRevision: 1,
      sourceHash: 'hash',
      status: 'accepted',
      commands: [{type: 'resource_change', actorId: 'char-mira', resourceDefinitionId: 'mana', delta: 5}],
      createdAt: 1
    };
    const candidates = buildAbandonedProgressionMethodCandidates({
      acceptedStateMutationEvents: [manaEvent],
      documents,
      ruleset
    });
    expect(candidates).toEqual([]);
  });
});
