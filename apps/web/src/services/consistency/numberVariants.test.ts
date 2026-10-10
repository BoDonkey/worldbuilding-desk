import {describe, expect, it} from 'vitest';
import {getNumberVariants, withNumberVariants} from './numberVariants';

describe('getNumberVariants', () => {
  it('pairs plain -s plurals with their singulars', () => {
    expect(getNumberVariants('Dhemons')).toEqual(['Dhemon']);
    expect(getNumberVariants('Dhemon')).toEqual(['Dhemons']);
  });

  it('handles -ies and consonant -y', () => {
    expect(getNumberVariants('Fairies')).toEqual(['Fairy']);
    expect(getNumberVariants('Fairy')).toEqual(['Fairies']);
    expect(getNumberVariants('Grey')).toEqual(['Greys']);
  });

  it('handles -es after sibilants', () => {
    expect(getNumberVariants('Witches')).toEqual(['Witch']);
    expect(getNumberVariants('Witch')).toEqual(['Witches']);
    expect(getNumberVariants('Glass')).toEqual(['Glasses']);
    expect(getNumberVariants('Foxes')).toEqual(['Fox']);
  });

  it('inflects only the last word of a multiword name', () => {
    expect(getNumberVariants('Iron Guards')).toEqual(['Iron Guard']);
    expect(getNumberVariants('Order of the Rose')).toEqual(['Order of the Roses']);
  });

  it('leaves short or non-letter endings alone', () => {
    expect(getNumberVariants('Ox')).toEqual([]);
    expect(getNumberVariants('Sector 7')).toEqual([]);
    expect(getNumberVariants('')).toEqual([]);
  });
});

describe('withNumberVariants', () => {
  const entries = [
    {id: 'race', surface: 'Dhemons', character: false},
    {id: 'hero', surface: 'Elias', character: true},
    {id: 'guard', surface: 'Iron Guard', character: false},
    {id: 'guards', surface: 'Iron Guards', character: false}
  ];

  it('adds variants only for entries allowed to inflect', () => {
    const result = withNumberVariants(entries, (entry) => !entry.character);
    expect(result).toContainEqual({id: 'race', surface: 'Dhemon', character: false});
    expect(result.some((entry) => entry.surface === 'Elia')).toBe(false);
  });

  it('never lets a variant shadow another record\'s exact name', () => {
    const result = withNumberVariants(entries, (entry) => !entry.character);
    expect(result.filter((entry) => entry.surface === 'Iron Guard')).toEqual([
      {id: 'guard', surface: 'Iron Guard', character: false}
    ]);
    expect(result.filter((entry) => entry.surface === 'Iron Guards')).toEqual([
      {id: 'guards', surface: 'Iron Guards', character: false}
    ]);
  });
});
