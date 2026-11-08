import {describe, expect, it} from 'vitest';
import type {StateMutationEvent, StoredRuleset} from '../../../entityTypes';
import {buildCharacterSheetMutationCommand} from '../../characters/characterSheetRuleset';
import {buildCharacterSnapshot, describeCharacterSnapshotChanges} from '../characterSnapshot';
import {snapshotRuntimeModifiers, snapshotSheet} from '../characterSnapshot.fixture';
import {buildCompoundChangePreview, buildPositionedStateCommand} from '../positionedStateChange';
import {replayCharacterState} from '../stateReplay';
import {describeCharacterSnapshotChange} from '../statPanel';
import {getAppStateKind, stateDeltaObservationToCommand, summarizeMutationCommand} from '.';

const ruleset = {
  id: 'rules',
  projectId: 'project-1',
  name: 'Rules',
  version: '1',
  statDefinitions: [],
  resourceDefinitions: [],
  levelTable: [
    {level: 4, experience: 500},
    {level: 5, experience: 1000}
  ],
  rules: [],
  itemTemplates: [],
  statusTemplates: [],
  createdAt: 1,
  updatedAt: 1
} satisfies StoredRuleset;

const formInput = (numberValue: string, textValue = '') => ({
  actorId: 'mira',
  mutationType: 'xp_gain' as const,
  statDefinition: null,
  resourceDefinition: null,
  numberValue,
  textValue,
  booleanValue: false,
  statusName: '',
  itemName: '',
  quantity: '1',
  locationName: ''
});

describe('xp_gain app kind', () => {
  it('builds from the Character Sheets form and loads back into it', () => {
    expect(buildCharacterSheetMutationCommand(formInput(''))).toBeNull();
    expect(buildCharacterSheetMutationCommand(formInput('250'))).toEqual({
      type: 'xp_gain',
      actorId: 'mira',
      amount: 250
    });
    const command = buildCharacterSheetMutationCommand(formInput('250', '  Cave troll '));
    expect(command).toEqual({type: 'xp_gain', actorId: 'mira', amount: 250, reason: 'Cave troll'});
    expect(getAppStateKind('xp_gain').sheetForm.load(command!)).toEqual({
      numberValue: '250',
      textValue: 'Cave troll'
    });
  });

  it('builds from a Workspace composer row and loads back into it', () => {
    const build = (value: string, name = '') =>
      buildPositionedStateCommand({
        actorId: 'mira',
        ruleset,
        draft: {id: 'row', kind: 'xp_gain', value, name}
      });
    expect(build('')).toBeNull();
    expect(build('0')).toBeNull();
    const command = build('120', 'Quest reward');
    expect(command).toEqual({type: 'xp_gain', actorId: 'mira', amount: 120, reason: 'Quest reward'});
    expect(getAppStateKind('xp_gain').composer.load(command!)).toEqual({
      value: '120',
      name: 'Quest reward'
    });
  });

  it('maps an XP observation to a proposed command and ignores ones without an amount', () => {
    const observation = {
      id: 'o1',
      projectId: 'project-1',
      type: 'state_delta_candidate' as const,
      operation: 'xp_gain' as const,
      actor: 'mira',
      confidence: 0.8,
      evidence: {start: 0, end: 10, text: 'gained 250 XP'},
      createdAt: 1
    };
    expect(stateDeltaObservationToCommand({...observation, amount: 250}, 'mira')).toEqual({
      type: 'xp_gain',
      actorId: 'mira',
      amount: 250
    });
    expect(stateDeltaObservationToCommand(observation, 'mira')).toBeNull();
  });

  it('labels the change for history and the dashboard', () => {
    expect(summarizeMutationCommand({type: 'xp_gain', actorId: 'mira', amount: 250})).toBe('XP +250');
    expect(
      summarizeMutationCommand({type: 'xp_gain', actorId: 'mira', amount: -20, reason: 'Fix'})
    ).toBe('XP -20 (Fix)');
    expect(getAppStateKind('xp_gain').dashboardCategory).toBe('Progression');
  });

  it('previews the gain and the level-up it causes', () => {
    const before = replayCharacterState({
      sheet: {...snapshotSheet, experience: 400},
      ruleset,
      events: [],
      target: {sheetId: snapshotSheet.id}
    });
    const preview = buildCompoundChangePreview({
      before,
      commands: [{type: 'xp_gain', actorId: 'mira', amount: 150}]
    });
    expect(preview.steps[0].effects).toEqual(['Experience: 400 -> 550', 'Level: 3 -> 4']);
  });
});

describe('replayed level and XP in the character snapshot', () => {
  const gain = (sceneOrder: number, amount: number): StateMutationEvent => ({
    id: `gain-${sceneOrder}`,
    projectId: 'project-1',
    sceneId: `scene-${sceneOrder}`,
    sceneOrder,
    sourceRevision: 1,
    sourceHash: 'h',
    status: 'accepted',
    commands: [{type: 'xp_gain', actorId: snapshotSheet.characterId!, amount}],
    createdAt: sceneOrder
  });
  const snapshotAt = (sceneOrder: number) =>
    buildCharacterSnapshot({
      sheet: snapshotSheet,
      ruleset,
      events: [gain(1, 300), gain(2, 300)],
      position: {kind: 'scene', sceneOrder, moment: 'ending'},
      runtimeModifiers: {...snapshotRuntimeModifiers, levelBonus: 0},
      statDefinitionNameById: new Map(),
      resourceDefinitionNameById: new Map(),
      compendiumEntries: [],
      entityById: new Map()
    });

  it('shows the level each scene reached', () => {
    expect([1, 2].map((order) => [snapshotAt(order).level, snapshotAt(order).experience])).toEqual([
      [3, 300],
      [4, 600]
    ]);
    expect(
      describeCharacterSnapshotChanges(snapshotAt(1), snapshotAt(2)).map(describeCharacterSnapshotChange)
    ).toEqual(['Level 3 → 4', 'XP 300 → 600']);
  });
});
