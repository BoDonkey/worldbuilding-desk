import {describe, expect, it} from 'vitest';
import type {CharacterSheet, WorldEntity} from '../../entityTypes';
import type {ConsistencyAlias} from '../consistency/aliasStorage';
import {
  applyCharacterStatCardTemplate,
  buildCharacterPeekTargets,
  findCharacterPeekTargetForLore,
  findCharacterPeekTargetsAt,
  resolveCharacterStatCardTemplate,
  searchCharacterPeekTargets
} from './characterPeek';
import type {CharacterSnapshot} from './characterSnapshot';

const sheet = (id: string, name: string, extra: Partial<CharacterSheet> = {}): CharacterSheet => ({
  id,
  projectId: 'p',
  name,
  level: 1,
  experience: 0,
  stats: [],
  resources: [],
  inventory: [],
  createdAt: 0,
  updatedAt: 0,
  ...extra
});

const entity = (id: string, name: string): WorldEntity =>
  ({id, projectId: 'p', categoryId: 'characters', name, fields: {}, links: [], createdAt: 0, updatedAt: 0}) as WorldEntity;

const alias = (
  targetId: string,
  value: string,
  targetType: ConsistencyAlias['targetType'] = 'entity'
): ConsistencyAlias => ({
  id: `${targetId}-${value}`,
  projectId: 'p',
  targetId,
  targetType,
  alias: value,
  createdAt: 0,
  updatedAt: 0
});

const targets = buildCharacterPeekTargets({
  sheets: [
    sheet('sheet-mira', 'Mira Vale', {characterEntityId: 'entity-mira'}),
    sheet('sheet-oren', 'Oren', {characterEntityId: 'entity-oren', characterId: 'char-oren'}),
    sheet('sheet-twin', 'Tamsin', {characterEntityId: 'entity-twin'})
  ],
  entities: [entity('entity-mira', 'Mira'), entity('entity-oren', 'Oren'), entity('entity-twin', 'Tamsin')],
  aliases: [
    alias('entity-mira', 'the Warden'),
    alias('entity-twin', 'the Warden'),
    alias('char-oren', 'Old Oren', 'character'),
    alias('entity-mira', 'mira')
  ]
});

const namesAt = (text: string, from: number, to = from) =>
  findCharacterPeekTargetsAt({text, from, to, targets}).map((target) => target.name);

describe('buildCharacterPeekTargets', () => {
  it('collects the sheet name, linked entry name, and aliases without duplicates', () => {
    expect(targets.map((target) => target.surfaces)).toEqual([
      ['Mira Vale', 'Mira', 'the Warden'],
      ['Oren', 'Old Oren'],
      ['Tamsin', 'the Warden']
    ]);
  });
});

describe('findCharacterPeekTargetsAt', () => {
  const text = 'Mira drew steel while Old Oren watched the Warden.';

  it('finds the name under or touching a collapsed cursor', () => {
    expect(namesAt(text, 0)).toEqual(['Mira Vale']);
    expect(namesAt(text, 2)).toEqual(['Mira Vale']);
    expect(namesAt(text, 4)).toEqual(['Mira Vale']);
    expect(namesAt(text, 7)).toEqual([]);
    expect(namesAt(text, 25)).toEqual(['Oren']);
  });

  it('prefers the longest surface, as the editor highlights do', () => {
    expect(namesAt('Mira Vale rested.', 6)).toEqual(['Mira Vale']);
  });

  it('returns every character sharing an ambiguous name', () => {
    expect(namesAt(text, text.indexOf('Warden') + 2)).toEqual(['Mira Vale', 'Tamsin']);
  });

  it('uses names overlapping a selection', () => {
    expect(namesAt(text, 0, text.length)).toEqual(['Mira Vale', 'Oren', 'Tamsin']);
    expect(namesAt(text, 5, 10)).toEqual([]);
  });

  it('ignores partial words and possessives stay matched', () => {
    expect(namesAt('Miraculous', 2)).toEqual([]);
    expect(namesAt("Oren's blade", 2)).toEqual(['Oren']);
  });
});

describe('findCharacterPeekTargetForLore', () => {
  it('resolves a highlighted entity, sheet, or character id', () => {
    expect(findCharacterPeekTargetForLore(targets, 'entity-mira')?.sheetId).toBe('sheet-mira');
    expect(findCharacterPeekTargetForLore(targets, 'char-oren')?.sheetId).toBe('sheet-oren');
    expect(findCharacterPeekTargetForLore(targets, 'sheet-twin')?.sheetId).toBe('sheet-twin');
    expect(findCharacterPeekTargetForLore(targets, 'entity-none')).toBeNull();
  });
});

describe('searchCharacterPeekTargets', () => {
  it('lists every character alphabetically and filters by name or alias', () => {
    expect(searchCharacterPeekTargets(targets, '').map((target) => target.name)).toEqual([
      'Mira Vale',
      'Oren',
      'Tamsin'
    ]);
    expect(searchCharacterPeekTargets(targets, 'warden').map((target) => target.name)).toEqual([
      'Mira Vale',
      'Tamsin'
    ]);
    expect(searchCharacterPeekTargets(targets, 'old').map((target) => target.name)).toEqual([
      'Oren'
    ]);
  });
});

describe('stat card template', () => {
  const snapshot: CharacterSnapshot = {
    sheetId: 'sheet-mira',
    name: 'Mira Vale',
    level: 3,
    stats: [
      {id: 'str', label: 'Strength', value: '12'},
      {id: 'agi', label: 'Agility', value: '9'}
    ],
    resources: [
      {id: 'hp', label: 'Health', current: 20, max: 30},
      {id: 'mp', label: 'Mana', current: 5, max: 10}
    ],
    inventory: [],
    statuses: []
  };
  const preferences = {
    sourceType: 'character' as const,
    style: 'compact' as const,
    insertMode: 'block' as const
  };

  it('follows the project stat-block style and scope', () => {
    expect(resolveCharacterStatCardTemplate(null)).toBeUndefined();
    expect(resolveCharacterStatCardTemplate({...preferences, scopePreset: 'all'})).toEqual({
      style: 'compact',
      label: 'Character Status • Compact'
    });

    const statsOnly = resolveCharacterStatCardTemplate({...preferences, scopePreset: 'stats'});
    expect(applyCharacterStatCardTemplate(snapshot, statsOnly).resources).toEqual([]);
    expect(applyCharacterStatCardTemplate(snapshot, statsOnly).stats).toHaveLength(2);

    const grouped = resolveCharacterStatCardTemplate({
      ...preferences,
      style: 'full',
      scopePreset: 'custom',
      selectedGroupId: 'g',
      selectedStatIds: ['agi'],
      groups: [{id: 'g', name: 'Combat', statIds: ['str'], resourceIds: ['hp']}]
    });
    expect(grouped?.label).toBe('Character Status • All Stats');
    const filtered = applyCharacterStatCardTemplate(snapshot, grouped);
    expect(filtered.stats.map((stat) => stat.id)).toEqual(['str']);
    expect(filtered.resources.map((resource) => resource.id)).toEqual(['hp']);
    expect(applyCharacterStatCardTemplate(snapshot, undefined)).toBe(snapshot);
  });
});
