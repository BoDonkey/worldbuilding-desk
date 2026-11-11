import {describe, expect, it} from 'vitest';
import type {LevelThreshold} from '../types/WorldRuleset';
import {
  StateMutationCommandSchema,
  deriveLevel,
  normalizeLevelTable,
  summarizeStateMutationCommand,
  summarizeStateMutationEffects
} from './kinds';
import {applyStateMutationCommand, replayCharacterState, validateStateMutationCommandAgainstState} from './replay';
import type {ManuscriptRuleset, ReplaySheet, StateMutationEvent} from './types';

const levelTable: LevelThreshold[] = [
  {level: 2, experience: 100},
  {level: 3, experience: 300},
  {level: 4, experience: 600}
];

const ruleset = (table?: LevelThreshold[]): ManuscriptRuleset => ({
  statDefinitions: [],
  resourceDefinitions: [],
  levelTable: table
});

const sheet: ReplaySheet = {
  id: 'sheet-1',
  characterEntityId: 'entity-1',
  name: 'Kael',
  level: 1,
  experience: 50,
  stats: [],
  resources: []
};

let nextId = 0;
const gain = (
  amount: number,
  overrides: Partial<StateMutationEvent> = {}
): StateMutationEvent => ({
  id: `event-${++nextId}`,
  projectId: 'project-1',
  sceneId: `scene-${overrides.sceneOrder ?? 1}`,
  sceneOrder: 1,
  sourceRevision: 1,
  sourceHash: 'h',
  status: 'accepted',
  commands: [{type: 'xp_gain', actorId: 'entity-1', amount}],
  createdAt: nextId,
  ...overrides
});

const replay = (
  events: StateMutationEvent[],
  options: {table?: LevelThreshold[]; upToSceneOrder?: number} = {}
) =>
  replayCharacterState({
    sheet,
    ruleset: ruleset(options.table),
    events,
    target: {actorId: 'entity-1', sheetId: sheet.id},
    upToSceneOrder: options.upToSceneOrder
  }).progression;

describe('xp_gain replay', () => {
  it('starts from the sheet and adds gains across scenes', () => {
    const events = [gain(100, {sceneOrder: 1}), gain(200, {sceneOrder: 2})];
    expect(replay([], {table: levelTable})).toMatchObject({experience: 50, level: 1});
    expect(replay(events, {table: levelTable, upToSceneOrder: 1})).toMatchObject({
      experience: 150,
      level: 2
    });
    expect(replay(events, {table: levelTable})).toMatchObject({experience: 350, level: 3});
  });

  it('applies scenes in manuscript order, not the order events were recorded', () => {
    const later = gain(500, {sceneOrder: 3, createdAt: 1});
    const earlier = gain(100, {sceneOrder: 1, createdAt: 2});
    expect(replay([later, earlier], {table: levelTable, upToSceneOrder: 2})).toMatchObject({
      experience: 150,
      level: 2
    });
    expect(replay([later, earlier], {table: levelTable})).toMatchObject({
      experience: 650,
      level: 4
    });
  });

  it('ignores invalidated and proposed gains', () => {
    const events = [
      gain(100),
      gain(1000, {status: 'invalidated'}),
      gain(1000, {status: 'proposed'})
    ];
    expect(replay(events, {table: levelTable})).toMatchObject({experience: 150, level: 2});
  });

  it('keeps the author-set level when the ruleset has no level table', () => {
    expect(replay([gain(5000)])).toMatchObject({experience: 5050, level: 1});
  });

  it('only touches the named actor', () => {
    const other = gain(100, {
      commands: [{type: 'xp_gain', actorId: 'someone-else', amount: 100}]
    });
    expect(replay([other], {table: levelTable})).toMatchObject({experience: 50, level: 1});
  });

  it('rejects a correction that would take experience below zero', () => {
    const state = replayCharacterState({
      sheet,
      ruleset: ruleset(levelTable),
      events: [],
      target: {actorId: 'entity-1'}
    });
    expect(
      validateStateMutationCommandAgainstState({
        state,
        command: {type: 'xp_gain', actorId: 'entity-1', amount: -60}
      })
    ).toEqual(['Experience would drop below zero (50 -60).']);
    expect(
      validateStateMutationCommandAgainstState({
        state,
        command: {type: 'xp_gain', actorId: 'entity-1', amount: -50}
      })
    ).toEqual([]);
  });

  it('describes the gain and any level-up', () => {
    const before = replayCharacterState({
      sheet,
      ruleset: ruleset(levelTable),
      events: [],
      target: {actorId: 'entity-1'}
    });
    const command = {type: 'xp_gain', actorId: 'entity-1', amount: 250, reason: 'Troll'} as const;
    const after = applyStateMutationCommand(before, command);
    expect(summarizeStateMutationCommand({command})).toBe('+250 XP (Troll)');
    expect(summarizeStateMutationEffects({before, after, command})).toEqual([
      'Experience: 50 -> 300',
      'Level: 1 -> 3'
    ]);
    expect(
      summarizeStateMutationEffects({
        before,
        after: applyStateMutationCommand(before, {...command, amount: 10}),
        command: {...command, amount: 10}
      })
    ).toEqual(['Experience: 50 -> 60']);
  });

  it('validates the command shape', () => {
    expect(
      StateMutationCommandSchema.safeParse({type: 'xp_gain', actorId: 'a', amount: 25}).success
    ).toBe(true);
    expect(
      StateMutationCommandSchema.safeParse({type: 'xp_gain', actorId: 'a', amount: '25'}).success
    ).toBe(false);
  });
});

describe('level derivation', () => {
  const at = (experience: number, startingLevel = 1, table = levelTable) =>
    deriveLevel({experience, startingLevel, levelTable: normalizeLevelTable(table)});

  it('takes the highest level whose XP has been reached', () => {
    expect(at(0)).toBe(1);
    expect(at(99)).toBe(1);
    expect(at(100)).toBe(2);
    expect(at(599)).toBe(3);
    expect(at(10_000)).toBe(4);
  });

  it('never goes below the starting level', () => {
    expect(at(0, 3)).toBe(3);
    expect(at(600, 3)).toBe(4);
  });

  it('reads tables in any order and skips unusable rows', () => {
    const messy = [
      {level: 3, experience: 300},
      {level: 2, experience: 100},
      {level: 1, experience: 0},
      {level: 2.5, experience: 200},
      {level: 5, experience: -1},
      {level: 6, experience: Number.NaN},
      null,
      'level 7'
    ] as unknown as LevelThreshold[];
    expect(normalizeLevelTable(messy)).toEqual([
      {level: 2, experience: 100},
      {level: 3, experience: 300}
    ]);
    expect(at(150, 1, messy)).toBe(2);
    expect(normalizeLevelTable(undefined)).toEqual([]);
  });
});
