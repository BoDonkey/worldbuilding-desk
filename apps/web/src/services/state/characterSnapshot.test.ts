import {describe, expect, it} from 'vitest';
import {buildSceneRosterModel} from '../workspace/workspaceView';
import {
  buildCharacterSnapshot,
  describeCharacterSnapshotChanges,
  getSceneOrder,
  summarizeCharacterSnapshot,
  type CharacterSnapshotPosition
} from './characterSnapshot';
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
} from './characterSnapshot.fixture';

const snapshotAt = (position: CharacterSnapshotPosition) =>
  buildCharacterSnapshot({
    sheet: snapshotSheet,
    ruleset: null,
    events: snapshotEvents,
    position,
    runtimeModifiers: snapshotRuntimeModifiers,
    statDefinitionNameById: snapshotStatNames,
    resourceDefinitionNameById: snapshotResourceNames,
    compendiumEntries: snapshotCompendiumEntries,
    entityById: new Map(snapshotEntities.map((entity) => [entity.id, entity]))
  });

const resourceValues = (position: CharacterSnapshotPosition) =>
  snapshotAt(position).resources.map(({label, current, max}) => `${label} ${current}/${max}`);

describe('buildCharacterSnapshot', () => {
  it('reads state at the opening, cursor, and ending of a scene, and at the latest point', () => {
    expect(resourceValues({kind: 'scene', sceneOrder: 1, moment: 'opening'})).toEqual([
      'Health 35/45',
      'Mana 10/10'
    ]);
    expect(resourceValues({kind: 'scene', sceneOrder: 1, moment: 'cursor', cursorPosition: 20})).toEqual([
      'Health 17/45',
      'Mana 10/10'
    ]);
    expect(resourceValues({kind: 'scene', sceneOrder: 1, moment: 'ending'})).toEqual([
      'Health 29/45',
      'Mana 10/10'
    ]);
    expect(resourceValues({kind: 'latest'})).toEqual(['Health 29/45', 'Mana 3/10']);
  });

  it('applies runtime modifiers and ignores proposed events', () => {
    const snapshot = snapshotAt({kind: 'scene', sceneOrder: 2, moment: 'ending'});

    expect(snapshot.level).toBe(4);
    expect(snapshot.stats).toEqual([
      {id: 'strength', label: 'Strength', value: '14'},
      {id: 'agility', label: 'Agility', value: '17'}
    ]);
    // The proposed "set Health to 1" at position 50 is not applied.
    expect(snapshot.resources[0]).toEqual({id: 'hp', label: 'Health', current: 29, max: 45});
    expect(snapshot.statuses).toEqual(['Invigorated', 'Party synergy grants +1 effective level.']);
    expect(snapshot.location).toBe('The Vault');
  });

  it('resolves linked item names, consumables, and equipment', () => {
    const snapshot = snapshotAt({kind: 'scene', sceneOrder: 2, moment: 'ending'});

    expect(
      snapshot.inventory.map(({name, quantity, equipped, consumable}) => ({
        name,
        quantity,
        equipped,
        consumable
      }))
    ).toEqual([
      {name: 'Rope', quantity: 1, equipped: false, consumable: undefined},
      {
        name: 'Healing Potion',
        quantity: 1,
        equipped: false,
        consumable: {definitionId: 'compendium-potion', durationLabel: 'one scene'}
      },
      {name: 'Ember Blade', quantity: 1, equipped: true, consumable: undefined}
    ]);
  });

  it('is the state the scene roster shows', () => {
    const roster = buildSceneRosterModel({
      selectedDocument: snapshotScenes[1],
      categories: snapshotCategories,
      characters: snapshotCharacters,
      entities: snapshotEntities,
      characterSheets: [snapshotSheet],
      aliases: [],
      content: snapshotScenes[1].content,
      overrides: {pinnedKeys: [], hiddenKeys: []},
      documents: snapshotScenes,
      ruleset: null,
      stateMutationEvents: snapshotEvents,
      stateMoment: 'cursor',
      cursorPosition: 20,
      runtimeModifiers: snapshotRuntimeModifiers,
      statDefinitionNameById: snapshotStatNames,
      resourceDefinitionNameById: snapshotResourceNames,
      compendiumEntries: snapshotCompendiumEntries
    });
    const snapshot = snapshotAt({kind: 'scene', sceneOrder: 2, moment: 'cursor', cursorPosition: 20});
    const card = roster.characters.find((character) => character.sheetId === snapshotSheet.id);

    expect(card).toMatchObject({
      level: snapshot.level,
      stats: snapshot.stats,
      resources: snapshot.resources,
      inventory: snapshot.inventory,
      statuses: snapshot.statuses,
      location: snapshot.location
    });
  });
});

describe('describeCharacterSnapshotChanges', () => {
  it('lists what changed between two points, in a stable order', () => {
    const before = snapshotAt({kind: 'scene', sceneOrder: 1, moment: 'ending'});
    const after = snapshotAt({kind: 'scene', sceneOrder: 2, moment: 'ending'});

    expect(describeCharacterSnapshotChanges(before, after)).toEqual([
      {kind: 'resource', id: 'mana', label: 'Mana', from: {current: 10, max: 10}, to: {current: 3, max: 10}},
      {kind: 'stat', id: 'strength', label: 'Strength', from: '12', to: '14'},
      {kind: 'stat', id: 'agility', label: 'Agility', from: '16', to: '17'},
      {kind: 'status', name: 'Rested', change: 'removed'},
      {kind: 'item', name: 'Ember Blade', fromQuantity: 0, toQuantity: 1},
      {kind: 'equipment', name: 'Ember Blade', change: 'equipped'},
      {kind: 'location', from: 'The Stair', to: 'The Vault'}
    ]);
  });

  it('reports removals and unequipping, and nothing for identical snapshots', () => {
    const before = snapshotAt({kind: 'scene', sceneOrder: 2, moment: 'ending'});
    const after = snapshotAt({kind: 'latest'});

    expect(describeCharacterSnapshotChanges(before, after)).toEqual([
      {kind: 'item', name: 'Rope', fromQuantity: 1, toQuantity: 0},
      {kind: 'equipment', name: 'Ember Blade', change: 'unequipped'}
    ]);
    expect(describeCharacterSnapshotChanges(after, after)).toEqual([]);
  });

  it('reports level, statuses added, and resources that appear', () => {
    const before = snapshotAt({kind: 'scene', sceneOrder: 1, moment: 'opening'});
    const after = {
      ...before,
      level: 5,
      statuses: [...before.statuses, 'Poisoned'],
      resources: [...before.resources, {id: 'stamina', label: 'Stamina', current: 4, max: 8}]
    };

    expect(describeCharacterSnapshotChanges(before, after)).toEqual([
      {kind: 'level', from: 4, to: 5},
      {kind: 'resource', id: 'stamina', label: 'Stamina', from: null, to: {current: 4, max: 8}},
      {kind: 'status', name: 'Poisoned', change: 'added'}
    ]);
  });
});

describe('summarizeCharacterSnapshot', () => {
  it('formats compact lines and respects the limit', () => {
    const snapshot = snapshotAt({kind: 'scene', sceneOrder: 1, moment: 'ending'});

    expect(summarizeCharacterSnapshot(snapshot)).toEqual({
      resources: ['Health 29/45', 'Mana 10/10'],
      stats: ['Strength 12', 'Agility 16'],
      statuses: ['Rested', 'Invigorated', 'Party synergy grants +1 effective level.'],
      location: 'The Stair'
    });
    expect(summarizeCharacterSnapshot(snapshot, 1).stats).toEqual(['Strength 12']);
  });
});

describe('getSceneOrder', () => {
  it('returns the 1-based manuscript order, or 0 for an unknown scene', () => {
    expect(getSceneOrder(snapshotScenes, 'scene-2')).toBe(2);
    expect(getSceneOrder(snapshotScenes, 'missing')).toBe(0);
  });
});
