import {describe, expect, it} from 'vitest';
import type {
  ChapterCard,
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../../entityTypes';
import {buildStoryDashboard, countQuotedWords, countWords} from './storyDashboard';

const document = (id: string, order: number, content: string): WritingDocument => ({
  id,
  projectId: 'project',
  title: `Scene ${order + 1}`,
  content,
  order,
  createdAt: order + 1,
  updatedAt: order + 1
});

const event = (
  id: string,
  sceneId: string,
  commands: StateMutationEvent['commands'],
  status: StateMutationEvent['status'] = 'accepted'
): StateMutationEvent => ({
  id,
  projectId: 'project',
  sceneId,
  sourceRevision: 1,
  sourceHash: 'hash',
  status,
  commands,
  createdAt: 1
});

const card = (sceneIds?: string[]): ChapterCard => ({
  id: 'card-1',
  projectId: 'project',
  title: 'Opening chapter',
  summary: 'The opening movement.',
  status: 'draft',
  order: 0,
  sceneIds,
  plotPoints: [],
  createdAt: 1,
  updatedAt: 1
});

const ruleset: StoredRuleset = {
  id: 'rules',
  projectId: 'project',
  name: 'Rules',
  version: '1',
  statDefinitions: [
    {id: 'level', name: 'Level', type: 'number', defaultValue: 1},
    {id: 'strength', name: 'Strength', type: 'number', defaultValue: 5}
  ],
  resourceDefinitions: [
    {id: 'mana', name: 'Mana', type: 'number', min: 0, max: 10, defaultValue: 10}
  ],
  rules: [],
  itemTemplates: [],
  statusTemplates: [],
  createdAt: 1,
  updatedAt: 1
};

describe('storyDashboard', () => {
  it('counts manuscript and quoted dialogue words deterministically', () => {
    const content = '<p>She said, “Open the salt door.”</p><p>He refused twice.</p>';
    expect(countWords(content)).toBe(9);
    expect(countQuotedWords(content)).toBe(4);
  });

  it('builds scene, explicitly linked chapter, and accepted-state metrics', () => {
    const dashboard = buildStoryDashboard({
      documents: [
        document('scene-2', 1, '<p>Second scene has five plain words.</p>'),
        document('scene-1', 0, '<p>“Take the key,” Mira said.</p>')
      ],
      cards: [card(['scene-1', 'scene-2', 'missing-scene'])],
      events: [
        event('accepted', 'scene-1', [
          {type: 'inventory_add', actorId: 'mira', itemName: 'Key'},
          {type: 'location_set', actorId: 'mira', locationName: 'Vault'}
        ]),
        event('proposed', 'scene-2', [
          {type: 'status_apply', actorId: 'mira', statusName: 'Tired'}
        ], 'proposed'),
        event('orphan', 'missing-scene', [
          {type: 'status_apply', actorId: 'mira', statusName: 'Lost'}
        ])
      ],
      ruleset: null,
      mechanicsEnabled: false
    });

    expect(dashboard.sourceSceneIds).toEqual(['scene-1', 'scene-2']);
    expect(dashboard.acceptedEventCount).toBe(1);
    expect(dashboard.acceptedCommandCount).toBe(2);
    expect(dashboard.missingEventSceneIds).toEqual(['missing-scene']);
    expect(dashboard.chapters[0]).toMatchObject({
      cardId: 'card-1',
      sourceSceneIds: ['scene-1', 'scene-2'],
      missingSceneIds: ['missing-scene'],
      acceptedChangeCount: 2
    });
    expect(dashboard.stateDistribution).toEqual([
      {category: 'Inventory', commandCount: 1, eventCount: 1, sourceSceneIds: ['scene-1']},
      {category: 'Locations', commandCount: 1, eventCount: 1, sourceSceneIds: ['scene-1']}
    ]);
    expect(dashboard.mechanics).toBeNull();
  });

  it('never infers a planning link from matching title or order', () => {
    const dashboard = buildStoryDashboard({
      documents: [{...document('scene-1', 0, 'Draft words'), title: 'Opening chapter'}],
      cards: [card()],
      events: [],
      ruleset: null,
      mechanicsEnabled: false
    });

    expect(dashboard.chapters).toEqual([]);
    expect(dashboard.unlinkedCardCount).toBe(1);
  });

  it('shows mechanics co-movement and explicit advancement intervals only when enabled', () => {
    const documents = [
      document('scene-1', 0, 'one two three'),
      document('scene-2', 1, 'four five'),
      document('scene-3', 2, 'six seven eight nine')
    ];
    const events = [
      event('level-1', 'scene-1', [
        {type: 'stat_change', actorId: 'mira', statDefinitionId: 'level', delta: 1},
        {type: 'resource_change', actorId: 'mira', resourceDefinitionId: 'mana', delta: -2}
      ]),
      event('strength', 'scene-2', [
        {type: 'stat_change', actorId: 'mira', statDefinitionId: 'strength', delta: 1}
      ]),
      event('level-2', 'scene-3', [
        {type: 'stat_change', actorId: 'mira', statDefinitionId: 'level', delta: 1}
      ])
    ];

    const mechanics = buildStoryDashboard({
      documents,
      cards: [],
      events,
      ruleset,
      mechanicsEnabled: true
    }).mechanics!;

    expect(mechanics.axes.map((axis) => [axis.label, axis.commandCount])).toEqual([
      ['Level', 2],
      ['Mana', 1],
      ['Strength', 1]
    ]);
    expect(mechanics.coMovements).toEqual([
      {sceneId: 'scene-1', sceneTitle: 'Scene 1', axisLabels: ['Level', 'Mana']}
    ]);
    expect(mechanics.advancementChangeCount).toBe(2);
    expect(mechanics.advancementIntervals).toEqual([
      {
        axisId: 'stat:level',
        axisLabel: 'Level',
        fromSceneId: 'scene-1',
        fromSceneTitle: 'Scene 1',
        toSceneId: 'scene-3',
        toSceneTitle: 'Scene 3',
        sceneInterval: 2,
        wordsBetween: 2
      }
    ]);
    expect(mechanics.advancementChangesPerTenThousandWords).toBeCloseTo(2222.22, 1);

    expect(buildStoryDashboard({
      documents,
      cards: [],
      events,
      ruleset,
      mechanicsEnabled: false
    }).mechanics).toBeNull();
  });
});
