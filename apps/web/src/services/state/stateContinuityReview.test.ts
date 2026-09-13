import {describe, expect, it} from 'vitest';
import type {
  CharacterSheet,
  StateMutationCommand,
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../../entityTypes';
import {findStateContinuityReviewItems} from './stateContinuityReview';

const ruleset: StoredRuleset = {
  id: 'rules',
  projectId: 'project',
  name: 'Rules',
  version: '1',
  statDefinitions: [],
  resourceDefinitions: [],
  rules: [],
  itemTemplates: [],
  statusTemplates: [],
  createdAt: 1,
  updatedAt: 1
};

const sheet: CharacterSheet = {
  id: 'sheet-sera',
  projectId: 'project',
  characterEntityId: 'sera',
  name: 'Sera',
  level: 1,
  experience: 0,
  stats: [],
  resources: [],
  inventory: [],
  inventoryEntries: [
    {id: 'draught', mode: 'quick', name: 'Pale Draught', quantity: 1},
    {id: 'key', mode: 'quick', name: 'Emberglass Key', quantity: 1}
  ],
  equipmentEntries: [{id: 'knife', mode: 'quick', name: 'Sorrowsteel knife', quantity: 1}],
  createdAt: 1,
  updatedAt: 1
};

const scene = (order: number, title: string, content: string): WritingDocument => ({
  id: `scene-${order}`,
  projectId: 'project',
  title,
  content,
  order,
  createdAt: order,
  updatedAt: order
});

const event = (
  order: number,
  title: string,
  command: StateMutationCommand,
  position = 10
): StateMutationEvent => ({
  id: `event-${order}-${command.type}`,
  projectId: 'project',
  sceneId: `scene-${order}`,
  sceneTitle: title,
  sceneOrder: order,
  scenePosition: position,
  sourceRevision: order,
  sourceHash: `hash-${order}`,
  status: 'accepted',
  commands: [command],
  createdAt: order
});

const knownEntities = [{id: 'sera', name: 'Sera', type: 'character' as const}];

describe('state-backed continuity review', () => {
  it('flags a review-derived mutation that cannot replay and cites the earlier scene', () => {
    const scenes = [
      scene(1, 'The Salt Door', 'Sera drank the Pale Draught.'),
      scene(2, 'The Second Draught', 'Sera drank the Pale Draught.')
    ];
    const findings = findStateContinuityReviewItems({
      documents: [scenes[1]!],
      sceneOrderDocuments: scenes,
      knownEntities,
      characterSheets: [sheet],
      ruleset,
      stateMutationEvents: [event(1, 'The Salt Door', {
        type: 'inventory_consume',
        actorId: 'sera',
        itemName: 'Pale Draught'
      })]
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.issue).toMatchObject({code: 'INVALID_MUTATION', severity: 'warning'});
    expect(findings[0]?.issue.message).toContain('The Salt Door');
    expect(findings[0]?.issue.focusText).toBe('Sera drank the Pale Draught');
  });

  it('does not validate an accepted mutation against its own replayed result', () => {
    const current = scene(1, 'The Salt Door', 'Sera drank the Pale Draught.');
    const accepted = event(1, 'The Salt Door', {
      type: 'inventory_consume',
      actorId: 'sera',
      itemName: 'Pale Draught'
    }, 0);

    expect(findStateContinuityReviewItems({
      documents: [current],
      knownEntities,
      characterSheets: [sheet],
      ruleset,
      stateMutationEvents: [accepted]
    })).toEqual([]);
  });

  it('catches the fixture custody error using the same ordered walk as the assistant', () => {
    const scenes = [
      scene(3, 'The Weighing House', 'Sera handed over the Emberglass Key.'),
      scene(4, 'Sorrowsteel', "The Key went into Brannic's pocket."),
      scene(
        5,
        'The Hollow Court',
        'Sera came down the antechamber slowly.\n\nShe stopped at the gate. She pressed the Emberglass Key into the lock.'
      )
    ];
    const findings = findStateContinuityReviewItems({
      documents: scenes,
      knownEntities,
      characterSheets: [sheet],
      ruleset,
      stateMutationEvents: [event(3, 'The Weighing House', {
        type: 'inventory_remove',
        actorId: 'sera',
        itemName: 'Emberglass Key'
      })]
    });

    const conflict = findings.find((item) => item.issue.code === 'STATE_CONFLICT');
    expect(conflict?.sceneId).toBe('scene-5');
    expect(conflict?.issue.focusText).toContain('pressed the Emberglass Key');
    expect(conflict?.issue.message).toContain('The Weighing House');
    expect(conflict?.issue.message).toContain('no later acquisition is accepted');
  });

  it('flags a static location contradiction but accepts an explicit movement cue', () => {
    const prior = event(1, 'The Camp', {
      type: 'location_set',
      actorId: 'sera',
      locationName: 'North Camp'
    });
    const staticClaim = scene(2, 'The Harbor', 'Sera waited at South Harbor.');
    const movedClaim = scene(
      2,
      'The Harbor',
      'Sera entered South Harbor. Later, Sera waited at South Harbor.'
    );

    const input = {
      sceneOrderDocuments: [scene(1, 'The Camp', ''), staticClaim],
      knownEntities,
      characterSheets: [sheet],
      ruleset,
      stateMutationEvents: [prior]
    };
    expect(findStateContinuityReviewItems({...input, documents: [staticClaim]}))
      .toEqual([expect.objectContaining({
        sceneId: 'scene-2',
        issue: expect.objectContaining({code: 'STATE_CONFLICT'})
      })]);
    expect(findStateContinuityReviewItems({
      ...input,
      documents: [movedClaim],
      sceneOrderDocuments: [scene(1, 'The Camp', ''), movedClaim]
    })).toEqual([]);
  });

  it('flags an attack with an item the accepted ledger left unequipped', () => {
    const armedSheet: CharacterSheet = {
      ...sheet,
      inventoryEntries: [
        ...(sheet.inventoryEntries ?? []),
        {id: 'knife-inventory', mode: 'quick', name: 'Sorrowsteel knife', quantity: 1}
      ],
      equipmentEntries: [{id: 'knife-equipped', mode: 'quick', name: 'Sorrowsteel knife'}]
    };
    const scenes = [
      scene(1, 'After the Fight', 'Sera sheathed the Sorrowsteel knife.'),
      scene(2, 'The Ambush', 'Sera attacked the guard with the Sorrowsteel knife.')
    ];
    const findings = findStateContinuityReviewItems({
      documents: [scenes[1]!],
      sceneOrderDocuments: scenes,
      knownEntities,
      characterSheets: [armedSheet],
      ruleset,
      stateMutationEvents: [event(1, 'After the Fight', {
        type: 'inventory_unequip',
        actorId: 'sera',
        itemName: 'Sorrowsteel knife'
      })]
    });

    expect(findings).toEqual([expect.objectContaining({
      issue: expect.objectContaining({
        code: 'STATE_CONFLICT',
        message: expect.stringContaining('leaves it unequipped')
      })
    })]);
  });

  it('leaves projects without a ruleset unchanged', () => {
    expect(findStateContinuityReviewItems({
      documents: [scene(1, 'Scene', 'Sera drank the Pale Draught.')],
      knownEntities,
      characterSheets: [sheet],
      ruleset: null,
      stateMutationEvents: []
    })).toEqual([]);
  });
});
