import {describe, expect, it} from 'vitest';
import {buildStateSubjects} from './stateSubjects';
import type {
  CharacterSheet,
  StateMutationCommand,
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../../entityTypes';
import {findStateContinuityReviewItems} from './stateContinuityReview';
import {buildPlaceNameIndex} from '../worldBible/placePositions';

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
      stateSubjects: buildStateSubjects({characterSheets: [sheet], characterEntities: []}),
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
      stateSubjects: buildStateSubjects({characterSheets: [sheet], characterEntities: []}),
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
      stateSubjects: buildStateSubjects({characterSheets: [sheet], characterEntities: []}),
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
      stateSubjects: buildStateSubjects({characterSheets: [sheet], characterEntities: []}),
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
      stateSubjects: buildStateSubjects({characterSheets: [armedSheet], characterEntities: []}),
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
      stateSubjects: buildStateSubjects({characterSheets: [sheet], characterEntities: []}),
      ruleset: null,
      stateMutationEvents: []
    })).toEqual([]);
  });

  describe('characters without a sheet (general fiction)', () => {
    const sheetless = buildStateSubjects({
      characterSheets: [],
      characterEntities: [{id: 'sera', name: 'Sera'}]
    });

    it('flags a static location that contradicts an accepted move, with no ruleset', () => {
      const scenes = [
        scene(1, 'The Camp', 'Sera slept by the fire.'),
        scene(2, 'The Harbor', 'Sera waited at South Harbor.')
      ];
      const findings = findStateContinuityReviewItems({
        documents: [scenes[1]!],
        sceneOrderDocuments: scenes,
        knownEntities,
        stateSubjects: sheetless,
        ruleset: null,
        stateMutationEvents: [event(1, 'The Camp', {
          type: 'location_set',
          actorId: 'sera',
          locationName: 'North Camp'
        })]
      });

      expect(findings).toEqual([expect.objectContaining({
        id: expect.stringContaining(':scene-2:sera:'),
        issue: expect.objectContaining({
          code: 'STATE_CONFLICT',
          relatedEntities: [{id: 'sera', name: 'Sera', type: 'character'}],
          message: expect.stringContaining('places them at North Camp')
        })
      })]);
    });

    it('flags using an item the ledger says she gave away', () => {
      const scenes = [
        scene(1, 'The Vault', 'Sera found the Emberglass Key.'),
        scene(2, 'The Weighing House', 'Sera handed over the Emberglass Key.'),
        scene(3, 'The Hollow Court', 'Sera pressed the Emberglass Key into the lock.')
      ];
      const findings = findStateContinuityReviewItems({
        documents: [scenes[2]!],
        sceneOrderDocuments: scenes,
        knownEntities,
        stateSubjects: sheetless,
        ruleset: null,
        stateMutationEvents: [
          event(1, 'The Vault', {type: 'inventory_add', actorId: 'sera', itemName: 'Emberglass Key'}),
          event(2, 'The Weighing House', {type: 'inventory_remove', actorId: 'sera', itemName: 'Emberglass Key'})
        ]
      });

      expect(findings).toEqual([expect.objectContaining({
        sceneId: 'scene-3',
        issue: expect.objectContaining({
          code: 'STATE_CONFLICT',
          message: expect.stringContaining('The Weighing House')
        })
      })]);
    });

    it('stays quiet when the scenes agree with the ledger', () => {
      const scenes = [
        scene(1, 'The Camp', 'Sera slept by the fire.'),
        scene(2, 'The Camp Again', 'Sera waited at North Camp.')
      ];
      expect(findStateContinuityReviewItems({
        documents: scenes,
        knownEntities,
        stateSubjects: sheetless,
        ruleset: null,
        stateMutationEvents: [event(1, 'The Camp', {
          type: 'location_set',
          actorId: 'sera',
          locationName: 'North Camp'
        })]
      })).toEqual([]);
    });
  });

  describe('positions that name place records (slice 4.77)', () => {
    const sheetless = buildStateSubjects({
      characterSheets: [],
      characterEntities: [{id: 'sera', name: 'Sera'}]
    });
    const place = (id: string, name: string, parentId?: string) => ({
      id, projectId: 'project', categoryId: 'cat-loc', name, fields: {}, links: [],
      place: parentId ? {parentId} : undefined, createdAt: 1, updatedAt: 1
    });
    const places = buildPlaceNameIndex({
      categories: [{
        id: 'cat-loc', projectId: 'project', kind: 'general', name: 'Locations', slug: 'locations',
        fieldSchema: [], createdAt: 1
      }],
      entities: [
        place('varn', 'Varn'),
        place('tavern', 'Gilded Gull', 'varn'),
        place('harbor', 'South Harbor')
      ],
      aliases: [{
        id: 'alias-gull', projectId: 'project', targetId: 'tavern', targetType: 'entity',
        entityId: 'tavern', alias: 'the Gull', createdAt: 1, updatedAt: 1
      }]
    });
    const findingsFor = (prose: string, move: StateMutationCommand) => {
      const scenes = [scene(1, 'Arrival', 'Sera came ashore.'), scene(2, 'Later', prose)];
      return findStateContinuityReviewItems({
        documents: [scenes[1]!],
        sceneOrderDocuments: scenes,
        knownEntities,
        stateSubjects: sheetless,
        ruleset: null,
        stateMutationEvents: [event(1, 'Arrival', move)],
        places
      });
    };
    const atTavern: StateMutationCommand = {
      type: 'location_set', actorId: 'sera', locationName: 'the tavern', placeId: 'tavern'
    };

    it('accepts prose naming a place that contains the recorded one', () => {
      expect(findingsFor('Sera waited in Varn.', atTavern)).toEqual([]);
    });

    it('accepts prose naming a place inside the recorded one', () => {
      expect(findingsFor('Sera waited in the Gull.', {
        type: 'location_set', actorId: 'sera', locationName: 'Varn', placeId: 'varn'
      })).toEqual([]);
    });

    it('compares by record, so a different name for the same place agrees', () => {
      expect(findingsFor('Sera waited at the Gilded Gull.', atTavern)).toEqual([]);
    });

    it('flags a place outside the recorded one and names the record', () => {
      expect(findingsFor('Sera waited at South Harbor.', atTavern)).toEqual([expect.objectContaining({
        issue: expect.objectContaining({
          code: 'STATE_CONFLICT',
          message: expect.stringContaining('places them at Gilded Gull')
        })
      })]);
    });

    it('falls back to text for an old position with no record', () => {
      expect(findingsFor('Sera waited at North Camp.', {
        type: 'location_set', actorId: 'sera', locationName: 'North Camp'
      })).toEqual([]);
      expect(findingsFor('Sera waited at Old Mill.', {
        type: 'location_set', actorId: 'sera', locationName: 'North Camp'
      })).toHaveLength(1);
    });
  });
});
