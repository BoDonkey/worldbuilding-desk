import {describe, expect, it} from 'vitest';
import type {
  Character,
  CharacterSheet,
  EntityCategory,
  StateMutationEvent,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import {
  buildManualCaptureLinkOptions,
  buildSceneRosterModel,
  buildSelectedSceneTimeline
} from './workspaceView';

const scene: WritingDocument = {
  id: 'scene-1',
  projectId: 'project-1',
  title: 'Arrival',
  content: '<p>Mira visits the Citadel.</p>',
  order: 1,
  createdAt: 1,
  updatedAt: 2
};

const character: Character = {
  id: 'character-1',
  projectId: 'project-1',
  name: 'Mira',
  fields: {role: 'Scout'},
  createdAt: 1,
  updatedAt: 1
};

const sheet: CharacterSheet = {
  id: 'sheet-1',
  projectId: 'project-1',
  characterId: character.id,
  name: character.name,
  level: 2,
  experience: 0,
  stats: [{definitionId: 'agility', value: 3}],
  resources: [{definitionId: 'hp', current: 10, max: 10}],
  inventory: [],
  createdAt: 1,
  updatedAt: 1
};

const categories: EntityCategory[] = [
  {
    id: 'characters',
    projectId: 'project-1',
    name: 'Characters',
    slug: 'characters',
    fieldSchema: [],
    createdAt: 1
  },
  {
    id: 'locations',
    projectId: 'project-1',
    name: 'Locations',
    slug: 'locations',
    fieldSchema: [{key: 'region', label: 'Region', type: 'text'}],
    createdAt: 1
  }
];

const entities: WorldEntity[] = [
  {
    id: 'entity-character-1',
    projectId: 'project-1',
    categoryId: 'characters',
    name: 'Mira',
    fields: {},
    links: [],
    createdAt: 1,
    updatedAt: 1
  },
  {
    id: 'citadel',
    projectId: 'project-1',
    categoryId: 'locations',
    name: 'Citadel',
    fields: {region: 'North'},
    links: [],
    createdAt: 1,
    updatedAt: 1
  }
];

const runtimeModifiers = {
  statModifiers: {},
  resourceModifiers: {},
  levelBonus: 0,
  notes: []
};

describe('buildSceneRosterModel', () => {
  it('returns an empty model without a selected scene', () => {
    expect(
      buildSceneRosterModel({
        selectedDocument: null,
        categories,
        characters: [character],
        entities,
        characterSheets: [sheet],
        aliases: [],
        content: '',
        overrides: {pinnedKeys: [], hiddenKeys: []},
        documents: [scene],
        ruleset: null,
        stateMutationEvents: [],
        stateMoment: 'opening',
        cursorPosition: 0,
        runtimeModifiers,
        statDefinitionNameById: new Map(),
        resourceDefinitionNameById: new Map(),
        compendiumEntries: []
      })
    ).toEqual({
      sceneTitle: null,
      characters: [],
      items: [],
      addOptions: [],
      ambiguousSurfaces: []
    });
  });

  it('builds character and world-entity cards from scene mentions', () => {
    const model = buildSceneRosterModel({
      selectedDocument: scene,
      categories,
      characters: [character],
      entities,
      characterSheets: [sheet],
      aliases: [],
      content: scene.content,
      overrides: {pinnedKeys: [], hiddenKeys: []},
      documents: [scene],
      ruleset: null,
      stateMutationEvents: [],
      stateMoment: 'opening',
      cursorPosition: 0,
      runtimeModifiers,
      statDefinitionNameById: new Map([['agility', 'Agility']]),
      resourceDefinitionNameById: new Map([['hp', 'Health']]),
      compendiumEntries: []
    });

    expect(model.characters).toHaveLength(1);
    expect(model.characters[0]).toMatchObject({
      name: 'Mira',
      role: 'Scout',
      hasSheet: true,
      stats: [{id: 'agility', label: 'Agility', value: '3'}]
    });
    expect(model.items).toHaveLength(1);
    expect(model.items[0]).toMatchObject({
      name: 'Citadel',
      categoryLabel: 'Locations',
      fields: [{id: 'region', label: 'Region', value: 'North'}]
    });
  });
});

describe('buildSelectedSceneTimeline', () => {
  it('returns null without a selected scene', () => {
    expect(
      buildSelectedSceneTimeline({
        selectedDocument: null,
        stateMutationEvents: [],
        characterSheets: [sheet],
        ruleset: null,
        documents: [scene],
        resourceDefinitionNameById: new Map(),
        statDefinitionNameById: new Map()
      })
    ).toBeNull();
  });

  it('summarizes accepted commands and final actor state', () => {
    const event: StateMutationEvent = {
      id: 'event-1',
      projectId: 'project-1',
      sceneId: scene.id,
      sceneTitle: scene.title,
      sceneOrder: 1,
      sceneSequence: 1,
      sourceRevision: scene.updatedAt,
      sourceHash: 'changed-hash',
      status: 'accepted',
      commands: [
        {
          type: 'resource_change',
          actorId: sheet.id,
          resourceDefinitionId: 'hp',
          delta: -2
        }
      ],
      createdAt: 3
    };

    const timeline = buildSelectedSceneTimeline({
      selectedDocument: scene,
      stateMutationEvents: [event],
      characterSheets: [sheet],
      ruleset: null,
      documents: [scene],
      resourceDefinitionNameById: new Map([['hp', 'Health']]),
      statDefinitionNameById: new Map()
    });

    expect(timeline?.entries).toEqual([
      expect.objectContaining({
        id: event.id,
        actorLabel: 'Mira',
        summaryLines: ['Health -2'],
        effectLines: ['Health: 10 -> 8']
      })
    ]);
    expect(timeline?.snapshots).toEqual([
      {actorLabel: 'Mira', lines: ['Health 8/10']}
    ]);
  });
});

describe('buildManualCaptureLinkOptions', () => {
  it('ranks exact matches first and omits duplicate character records', () => {
    const options = buildManualCaptureLinkOptions({
      draftText: 'Citadel',
      categories,
      characters: [character],
      entities,
    });

    expect(options[0]).toMatchObject({
      id: 'entity:citadel',
      name: 'Citadel',
      type: 'Locations',
      score: 0
    });
    expect(options.some((option) => option.id === `character:${character.id}`)).toBe(false);
  });

  it('returns no options when capture is closed', () => {
    expect(
      buildManualCaptureLinkOptions({
        draftText: null,
        categories,
        characters: [character],
        entities
      })
    ).toEqual([]);
  });
});
