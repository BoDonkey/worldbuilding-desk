import {describe, expect, it} from 'vitest';
import type {
  CanonicalFact,
  Character,
  CharacterStyle,
  LoreFactProposal,
  WorldEntity
} from '../../entityTypes';
import type {ConsistencyAlias} from '../consistency/aliasStorage';
import {buildCharacterSnapshot, getSceneOrder} from '../state/characterSnapshot';
import {
  snapshotCategories,
  snapshotCharacters,
  snapshotCompendiumEntries,
  snapshotEntities,
  snapshotEvents,
  snapshotResourceNames,
  snapshotRuntimeModifiers,
  snapshotScenes,
  snapshotSheet,
  snapshotStatNames
} from '../state/characterSnapshot.fixture';
import {
  buildCharacterVoiceContext,
  STORY_STATE_KNOWLEDGE_NOTE,
  type CharacterVoicePosition
} from './characterVoiceContext';

const projectId = 'project-snapshot';

const oren: WorldEntity = {
  id: 'entity-oren',
  projectId,
  categoryId: 'characters',
  name: 'Oren',
  fields: {notes: 'A quiet guide.'},
  links: [],
  createdAt: 1,
  updatedAt: 1
};
const mira: WorldEntity = {...snapshotEntities[0], fields: {notes: '<p>Scout of the lower stair.</p>'}};
const entities = [mira, oren, snapshotEntities[1]];

const style: CharacterStyle = {
  id: 'style-clipped',
  name: 'Clipped and wary',
  markName: 'characterDialogue',
  styles: {}
};
const characters: Character[] = [
  {...snapshotCharacters[0], characterStyleId: style.id},
  snapshotCharacters[1]
];

const aliases: ConsistencyAlias[] = [
  {id: 'alias-1', projectId, targetId: 'entity-mira', targetType: 'entity', alias: 'Little Hawk', createdAt: 1, updatedAt: 1},
  {id: 'alias-2', projectId, targetId: 'entity-oren', targetType: 'entity', alias: 'Old Lantern', createdAt: 1, updatedAt: 1}
];

const fact = (id: string, overrides: Partial<CanonicalFact>): CanonicalFact => ({
  id,
  projectId,
  targetType: 'entity',
  targetId: 'entity-mira',
  factType: 'trait',
  value: id,
  acceptedAt: 1,
  updatedAt: 1,
  ...overrides
});

const proposal = (id: string, status: LoreFactProposal['status']): LoreFactProposal => ({
  id,
  projectId,
  loreDocumentId: 'lore-1',
  factType: 'trait',
  value: id,
  confidence: 1,
  evidence: {start: 0, end: 1, text: 'x'},
  status,
  createdAt: 1,
  updatedAt: 1
});

const canonicalFacts: CanonicalFact[] = [
  fact('fact-stubborn', {value: 'stubborn'}),
  fact('fact-accepted-source', {value: 'fears deep water', sourceProposalId: 'proposal-accepted'}),
  fact('fact-pending-source', {value: 'PENDING-CLAIM', sourceProposalId: 'proposal-pending'}),
  fact('fact-rejected-source', {value: 'REJECTED-CLAIM', sourceProposalId: 'proposal-rejected'}),
  fact('fact-legacy-target', {targetType: 'character', targetId: 'character-mira', factType: 'goal', value: 'find her brother'}),
  fact('fact-oren', {targetId: 'entity-oren', value: 'OREN-ONLY'}),
  fact('fact-until-vault', {factType: 'occupation', value: 'apprentice scout', validUntilSceneId: 'scene-2'}),
  fact('fact-from-vault', {factType: 'occupation', value: 'Vault warden', validFromSceneId: 'scene-2'})
];

const factProposals = [
  proposal('proposal-accepted', 'accepted'),
  proposal('proposal-pending', 'proposed'),
  proposal('proposal-rejected', 'rejected')
];

const state = {
  ruleset: null,
  events: snapshotEvents,
  runtimeModifiers: snapshotRuntimeModifiers,
  statDefinitionNameById: snapshotStatNames,
  resourceDefinitionNameById: snapshotResourceNames,
  compendiumEntries: snapshotCompendiumEntries
};

const build = (position: CharacterVoicePosition, entityId = 'entity-mira') =>
  buildCharacterVoiceContext({
    entityId,
    position,
    categories: snapshotCategories,
    entities,
    characters,
    sheets: [snapshotSheet],
    aliases,
    canonicalFacts,
    factProposals,
    characterStyles: [style],
    documents: snapshotScenes,
    state
  });

const section = (context: ReturnType<typeof build>, kind: string) =>
  context.sections.find((candidate) => candidate.kind === kind);

describe('buildCharacterVoiceContext', () => {
  it('grounds the canonical record, aliases, and dialogue style with provenance', () => {
    const context = build({kind: 'latest'});

    expect(context.entityId).toBe('entity-mira');
    expect(section(context, 'canon-record')).toEqual({
      kind: 'canon-record',
      source: 'Accepted canon: World Bible record - Mira',
      content: 'Mira\nnotes: Scout of the lower stair.\nAlso known as: Little Hawk',
      provenance: [
        {type: 'world-entity', id: 'entity-mira'},
        {type: 'alias', id: 'alias-1'}
      ]
    });
    expect(section(context, 'dialogue-style')).toMatchObject({
      content: 'Dialogue style: Clipped and wary',
      provenance: [{type: 'character-style', id: 'style-clipped'}]
    });
  });

  it('uses accepted facts for this character only, excluding pending and rejected claims', () => {
    const facts = section(build({kind: 'scene', sceneId: 'scene-1', moment: 'ending'}), 'accepted-facts');

    expect(facts?.provenance.map((entry) => entry.id)).toEqual([
      'fact-stubborn',
      'fact-accepted-source',
      'fact-legacy-target',
      'fact-until-vault'
    ]);
    expect(facts?.content).not.toMatch(/PENDING-CLAIM|REJECTED-CLAIM|OREN-ONLY/);
    expect(facts?.content).toContain('- goal: find her brother');
  });

  it('applies fact validity windows at the chosen position', () => {
    const idsAt = (position: CharacterVoicePosition) =>
      section(build(position), 'accepted-facts')?.provenance.map((entry) => entry.id) ?? [];

    expect(idsAt({kind: 'scene', sceneId: 'scene-1', moment: 'opening'})).toContain('fact-until-vault');
    expect(idsAt({kind: 'scene', sceneId: 'scene-1', moment: 'opening'})).not.toContain('fact-from-vault');
    expect(idsAt({kind: 'scene', sceneId: 'scene-2', moment: 'opening'})).toContain('fact-from-vault');
    expect(idsAt({kind: 'scene', sceneId: 'scene-2', moment: 'opening'})).not.toContain('fact-until-vault');
    expect(idsAt({kind: 'latest'})).toContain('fact-from-vault');
    expect(idsAt({kind: 'latest'})).not.toContain('fact-until-vault');
  });

  it('reports story state that matches replay at the chosen position', () => {
    const positions: CharacterVoicePosition[] = [
      {kind: 'scene', sceneId: 'scene-1', moment: 'opening'},
      {kind: 'scene', sceneId: 'scene-1', moment: 'cursor', cursorPosition: 20},
      {kind: 'scene', sceneId: 'scene-2', moment: 'ending'},
      {kind: 'latest'}
    ];
    positions.forEach((position) => {
      const expected = buildCharacterSnapshot({
        sheet: snapshotSheet,
        ruleset: null,
        events: snapshotEvents,
        position:
          position.kind === 'latest'
            ? position
            : {
                kind: 'scene',
                sceneOrder: getSceneOrder(snapshotScenes, position.sceneId),
                moment: position.moment,
                cursorPosition: position.cursorPosition
              },
        runtimeModifiers: snapshotRuntimeModifiers,
        statDefinitionNameById: snapshotStatNames,
        resourceDefinitionNameById: snapshotResourceNames,
        compendiumEntries: snapshotCompendiumEntries,
        entityById: new Map(entities.map((entity) => [entity.id, entity]))
      });
      expect(build(position).snapshot).toEqual(expected);
    });

    const cursor = build({kind: 'scene', sceneId: 'scene-1', moment: 'cursor', cursorPosition: 20});
    expect(cursor.positionLabel).toBe('the cursor in "The Descent"');
    expect(section(cursor, 'story-state')).toMatchObject({
      source: 'Story state at the cursor in "The Descent" - Mira',
      provenance: [{type: 'character-sheet', id: 'sheet-mira'}]
    });
    expect(section(cursor, 'story-state')?.content).toContain('Health: 17/45');
    expect(section(cursor, 'story-state')?.content).toContain('Location: The Stair');
  });

  it('labels story state as what is true, not what the character knows', () => {
    expect(section(build({kind: 'latest'}), 'story-state')?.content.startsWith(STORY_STATE_KNOWLEDGE_NOTE)).toBe(true);
  });

  it('omits story state and dialogue style for a character without them', () => {
    const context = build({kind: 'latest'}, 'entity-oren');

    expect(context.snapshot).toBeNull();
    expect(context.sections.map((candidate) => candidate.kind)).toEqual(['canon-record', 'accepted-facts']);
    expect(section(context, 'canon-record')?.content).toContain('Also known as: Old Lantern');
  });

  it('fails closed for non-character records and scenes missing from the manuscript', () => {
    expect(() => build({kind: 'latest'}, 'entity-ember-blade')).toThrow('not a character');
    expect(() => build({kind: 'scene', sceneId: 'scene-deleted', moment: 'opening'})).toThrow(
      'no longer in this manuscript'
    );
  });
});
