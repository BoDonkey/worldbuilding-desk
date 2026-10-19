import {describe, expect, it} from 'vitest';
import {
  getDefaultActions,
  parseBaseStatsDraft,
  parseCommaSeparatedIds,
  parseModuleValue,
  parsePreviewMaterials,
  toBaseStatsDraft,
  toBiomeKey
} from './compendiumFormValues';

describe('Compendium form values', () => {
  it('trims comma-separated IDs, drops empty slots, and preserves order and duplicates', () => {
    expect(parseCommaSeparatedIds(' first, ,second, first, ')).toEqual(['first', 'second', 'first']);
    expect(parseCommaSeparatedIds('  ')).toEqual([]);
  });

  it('parses material rows with the existing zero, blank, duplicate, and extra-colon behavior', () => {
    expect(parsePreviewMaterials([
      ' iron_ore : 12 ', 'wolf_pelt:4', 'iron_ore:3.5', 'zero:0',
      'blank:', 'bare', 'extra:2:ignored', ':5', 'bad:nope', 'negative:-1', 'infinite:Infinity', ''
    ].join('\n'))).toEqual({iron_ore: 3.5, wolf_pelt: 4, zero: 0, blank: 0, bare: 0, extra: 2});
  });

  it('floors and bounds base stats while preserving blank-as-zero and numeric syntax', () => {
    expect(parseBaseStatsDraft({
      defense: '-2', storageCapacity: '100001.9', craftingThroughput: ' 1e2 ', morale: ''
    })).toEqual({baseStats: {defense: 0, storageCapacity: 100000, craftingThroughput: 100, morale: 0}});
    expect(parseBaseStatsDraft({
      defense: '12.9', storageCapacity: '0x10', craftingThroughput: '2', morale: '50'
    })).toEqual({baseStats: {defense: 12, storageCapacity: 16, craftingThroughput: 2, morale: 50}});
  });

  it('rejects nonfinite base stats before saving and reports the first invalid field', () => {
    expect(parseBaseStatsDraft({
      defense: 'bad', storageCapacity: 'Infinity', craftingThroughput: '100', morale: '50'
    })).toEqual({error: 'Base stat "defense" must be a valid number.'});
    expect(parseBaseStatsDraft({
      defense: '10', storageCapacity: 'Infinity', craftingThroughput: '100', morale: '50'
    })).toEqual({error: 'Base stat "storageCapacity" must be a valid number.'});
  });

  it('round-trips saved base stats into the editable string representation', () => {
    const stats = {defense: 12, storageCapacity: 120, craftingThroughput: 90, morale: 42};
    expect(parseBaseStatsDraft(toBaseStatsDraft(stats))).toEqual({baseStats: stats});
  });

  it.each([
    [' 5 ', 5], ['0', 0], ['-1.5', -1.5], ['2e2', 200],
    ['', ''], ['  ', '  '], ['Infinity', 'Infinity'], ['warded', 'warded']
  ])('preserves module value coercion for %j', (input, expected) => {
    expect(parseModuleValue(String(input))).toBe(expected);
  });

  it('normalizes imported biome names while keeping the fallback key', () => {
    expect(toBiomeKey('  Salt Door / North! ')).toBe('salt_door_north');
    expect(toBiomeKey('!?')).toBe('zone');
  });

  it('preserves domain-specific default action IDs, points, and repeatability', () => {
    expect(getDefaultActions('beast')).toEqual([
      {id: 'discover', label: 'Discover', points: 1, repeatable: false},
      {id: 'kill', label: 'Kill', points: 3, repeatable: true},
      {id: 'skin', label: 'Skin', points: 2, repeatable: true}
    ]);
    expect(getDefaultActions('flora')).toEqual(getDefaultActions('mineral'));
    expect(getDefaultActions('flora')[1]).toEqual({id: 'harvest', label: 'Harvest', points: 2, repeatable: true});
    expect(getDefaultActions('custom')).toEqual([{id: 'discover', label: 'Discover', points: 1, repeatable: false}]);
  });
});
