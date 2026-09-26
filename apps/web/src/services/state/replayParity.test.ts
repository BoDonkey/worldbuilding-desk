import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import type {
  CharacterSheet,
  StateMutationCommand,
  StateMutationEvent,
  StoredRuleset
} from '../../entityTypes';
import type {ActorResolution} from '../characters/characterIdentity';
import {CONTINUITY_CORPUS} from '../../fixtures/continuityCorpus';
import {snapshotEvents, snapshotSheet} from './characterSnapshot.fixture';
import {
  applyStateMutationCommand,
  compareStateMutationEvents,
  replayCharacterState,
  validateStateMutationCommandAgainstState,
  validateStateMutationEventForRuleset
} from './stateReplay';
import {buildCharacterReplayBaseline, validateStateMutationEvent} from './stateMutationSchemas';

/*
 * Replay parity for Slice 3.10 (moving the manuscript-time state core into
 * packages/rules-engine). The digest below is of the output the pre-move web
 * implementation produced (about 8.6 MB of JSON: 63 cases, ~12k replays);
 * every later implementation must reproduce it byte for byte. On mismatch the
 * full output is written to the OS temp dir for diffing against a run of the
 * previous commit. Change the digest only for an intended behavior change.
 */
const GOLDEN_SHA256 = '474bfce64995d9579fd7a8c1bfff4ce6444a46b34399d34cdf0ac6265f53772d';

interface ParityCase {
  name: string;
  ruleset: StoredRuleset | null;
  sheets: CharacterSheet[];
  events: StateMutationEvent[];
  actorResolutions?: ActorResolution[];
}

// Deterministic generator so the ledgers are data, not chance.
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(values: readonly T[]): T => values[Math.floor(next() * values.length)]
  };
}

const RULESET: StoredRuleset = {
  id: 'parity-rules',
  projectId: 'parity',
  name: 'Parity rules',
  version: '1',
  statDefinitions: [
    {id: 'str', name: 'Strength', type: 'number', defaultValue: 10, min: 1, max: 20},
    {id: 'brave', name: 'Brave', type: 'boolean', defaultValue: false},
    {id: 'title', name: 'Title', type: 'text', defaultValue: 'Squire'}
  ],
  resourceDefinitions: [
    {id: 'hp', name: 'Health', type: 'number', defaultValue: 30, max: 40},
    {id: 'mp', name: 'Mana', type: 'number', defaultValue: 5},
    {id: 'gold', name: 'Gold', type: 'number', defaultValue: 0}
  ],
  rules: [],
  itemTemplates: [],
  statusTemplates: [],
  createdAt: 1,
  updatedAt: 1
} as StoredRuleset;

const ITEMS = ['Healing Potion', 'Ember Blade', 'Rope', 'healing potion ', 'Lantern'];
const STATUSES = ['Poisoned', 'Hasted', 'Invisible'];
const LOCATIONS = ['The Gate', 'The Vault', 'Market'];

function generatedCase(seed: number): ParityCase {
  const random = createRandom(seed);
  const actors = ['entity-a', 'entity-b', 'legacy-a', 'sheet-b', 'stranger'];
  const sheets: CharacterSheet[] = [
    {
      id: 'sheet-a',
      projectId: 'parity',
      characterEntityId: 'entity-a',
      characterId: 'char-a',
      name: 'Avery',
      level: 2,
      experience: 0,
      stats: random.next() < 0.5 ? [{definitionId: 'str', value: 12}] : [],
      resources: random.next() < 0.5 ? [{definitionId: 'hp', current: 25, max: 40}] : [],
      inventory: ['Legacy string item'],
      inventoryEntries:
        random.next() < 0.6
          ? [
              {id: 'i1', mode: 'quick', name: 'Healing Potion', quantity: 2},
              {id: 'i2', mode: 'cataloged', name: 'Ember Blade', sourceEntityId: 'item-ember', definitionId: 'def-ember'}
            ]
          : undefined,
      equipmentEntries: random.next() < 0.3 ? [{id: 'e1', mode: 'quick', name: 'Ember Blade'}] : undefined,
      statuses: ['Tired'],
      statusEntries: random.next() < 0.5 ? [{id: 's1', mode: 'quick', name: 'Hasted'}] : undefined,
      createdAt: 1,
      updatedAt: 1
    },
    {
      id: 'sheet-b',
      projectId: 'parity',
      name: 'Bryn',
      level: 1,
      experience: 0,
      stats: [{definitionId: 'title', value: 7}],
      resources: [{definitionId: 'mp', current: 3, max: 5}],
      inventory: [],
      createdAt: 1,
      updatedAt: 1
    }
  ];

  const command = (actorId: string): StateMutationCommand => {
    const item = random.pick(ITEMS);
    const withReferences = random.next() < 0.3
      ? {sourceEntityId: 'item-ember', definitionId: random.next() < 0.5 ? 'def-ember' : undefined}
      : {};
    switch (random.int(0, 12)) {
      case 0: return {type: 'resource_change', actorId, resourceDefinitionId: random.pick(['hp', 'mp', 'gold', 'none']), delta: random.int(-50, 50)};
      case 1: return {type: 'resource_set', actorId, resourceDefinitionId: random.pick(['hp', 'mp', 'gold']), value: random.int(-5, 60)};
      case 2: return {type: 'stat_change', actorId, statDefinitionId: random.pick(['str', 'brave', 'title', 'none']), delta: random.pick([random.int(-3, 3), true, 'Knight'])};
      case 3: return {type: 'stat_set', actorId, statDefinitionId: random.pick(['str', 'brave', 'title']), value: random.pick([random.int(0, 25), false, 'Lord'])};
      case 4: return {type: 'status_apply', actorId, statusName: random.pick(STATUSES)};
      case 5: return {type: 'status_remove', actorId, statusName: random.pick([...STATUSES, 'Tired'])};
      case 6: return {type: 'inventory_add', actorId, itemName: item, quantity: random.next() < 0.5 ? random.int(1, 3) : undefined, ...withReferences};
      case 7: return {type: 'inventory_remove', actorId, itemName: item, quantity: random.next() < 0.5 ? random.int(1, 3) : undefined, ...withReferences};
      case 8: return {type: 'inventory_consume', actorId, itemName: item, quantity: random.next() < 0.5 ? random.int(1, 2) : undefined, ...withReferences};
      case 9: return {type: 'inventory_equip', actorId, itemName: item, ...withReferences};
      case 10: return {type: 'inventory_unequip', actorId, itemName: item};
      default: return {type: 'location_set', actorId, locationName: random.pick(LOCATIONS)};
    }
  };

  const events: StateMutationEvent[] = Array.from({length: random.int(4, 14)}, (_, index) => {
    const sceneOrder = random.next() < 0.1 ? undefined : random.int(1, 4);
    return {
      id: `event-${seed}-${index}`,
      projectId: 'parity',
      sceneId: sceneOrder ? `scene-${sceneOrder}` : 'scene-unordered',
      sceneOrder,
      sceneSequence: random.next() < 0.5 ? random.int(1, 3) : undefined,
      scenePosition: random.next() < 0.7 ? random.int(0, 60) : undefined,
      sourceRevision: random.int(1, 3),
      sourceHash: 'hash',
      status: random.pick(['accepted', 'accepted', 'accepted', 'proposed', 'invalidated'] as const),
      commands: Array.from({length: random.int(1, 3)}, () => {
        const generated = command(random.pick(actors));
        // A few malformed commands exercise schema rejection.
        if (random.next() < 0.04) return {...generated, actorId: ''};
        if (random.next() < 0.03 && 'itemName' in generated) return {...generated, quantity: 0};
        return generated;
      }),
      createdAt: random.int(1, 1000)
    };
  });

  return {
    name: `generated-${seed}`,
    ruleset: random.next() < 0.8 ? RULESET : null,
    sheets,
    events,
    actorResolutions: [
      {id: 'r1', projectId: 'parity', legacyActorId: 'legacy-a', legacyActorType: 'character', entityId: 'entity-a', createdAt: 1},
      {id: 'r2', projectId: 'parity', legacyActorId: 'char-a', legacyActorType: 'character', entityId: 'entity-a', createdAt: 1}
    ]
  };
}

const CASES: ParityCase[] = [
  ...CONTINUITY_CORPUS.filter((corpusCase) => corpusCase.state).map((corpusCase) => ({
    name: `corpus-${corpusCase.id}`,
    ruleset: corpusCase.state!.ruleset,
    sheets: corpusCase.state!.characterSheets,
    events: corpusCase.state!.mutationEvents
  })),
  {name: 'character-snapshot-fixture', ruleset: null, sheets: [snapshotSheet], events: snapshotEvents},
  ...Array.from({length: 60}, (_, index) => generatedCase(index + 1))
];

const errorText = (run: () => unknown): unknown => {
  try {
    return {ok: run()};
  } catch (error) {
    return {error: error instanceof Error ? error.message : String(error)};
  }
};

function runCase(parityCase: ParityCase) {
  const sceneOrders = Array.from(
    new Set(parityCase.events.map((event) => event.sceneOrder).filter((order) => order !== undefined))
  ) as number[];
  const maxOrder = Math.max(0, ...sceneOrders);
  const positions = Array.from(
    new Set(parityCase.events.flatMap((event) =>
      event.scenePosition === undefined ? [] : [event.scenePosition - 1, event.scenePosition, event.scenePosition + 1]
    ))
  ).sort((left, right) => left - right);

  return {
    name: parityCase.name,
    order: parityCase.events.slice().sort(compareStateMutationEvents).map((event) => event.id),
    events: parityCase.events.map((event) => ({
      id: event.id,
      schema: errorText(() => validateStateMutationEvent(event).id),
      ruleset: validateStateMutationEventForRuleset({event, ruleset: parityCase.ruleset})
    })),
    sheets: parityCase.sheets.map((sheet) => {
      const target = {
        actorId: sheet.characterEntityId,
        characterId: sheet.characterId,
        sheetId: sheet.id,
        actorName: sheet.name
      };
      const replay = (upToSceneOrder?: number, upToScenePosition?: number) =>
        replayCharacterState({
          sheet,
          ruleset: parityCase.ruleset,
          events: parityCase.events,
          target,
          actorResolutions: parityCase.actorResolutions,
          upToSceneOrder,
          upToScenePosition
        });
      const latest = replay();
      return {
        sheetId: sheet.id,
        baseline: buildCharacterReplayBaseline({sheet, ruleset: parityCase.ruleset}),
        latest,
        byScene: Array.from({length: maxOrder + 2}, (_, order) => ({
          order,
          ending: replay(order),
          atPositions: positions.map((position) => replay(order, position))
        })),
        // Every command applied to, and validated against, the latest state.
        commands: parityCase.events.flatMap((event) =>
          event.commands.map((command) => ({
            applied: applyStateMutationCommand(latest, command),
            errors: validateStateMutationCommandAgainstState({state: latest, command})
          }))
        )
      };
    })
  };
}

describe('manuscript-time replay parity', () => {
  it('reproduces the pre-move golden output for every case, scene, and position', () => {
    const actual = JSON.stringify(CASES.map(runCase), null, 1);
    const digest = createHash('sha256').update(actual).digest('hex');
    if (digest !== GOLDEN_SHA256) {
      const dumpPath = join(tmpdir(), `replay-parity-${digest.slice(0, 12)}.json`);
      writeFileSync(dumpPath, actual);
      console.error(`Replay parity output written to ${dumpPath}`);
    }
    expect(digest).toBe(GOLDEN_SHA256);
  });
});
