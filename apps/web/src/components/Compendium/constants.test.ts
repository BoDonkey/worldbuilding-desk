import {describe, expect, it} from 'vitest';
import {filterNamedItems} from './constants';

const items = [
  {id: 'ember', name: 'Ember Draught'},
  {id: 'iron', name: 'Iron Ward'},
  {id: 'moon', name: 'Moonlit Tonic'}
];

describe('filterNamedItems', () => {
  it('matches names using a case-insensitive substring', () => {
    expect(filterNamedItems(items, 'DRAU')).toEqual([items[0]]);
  });

  it('trims the query before matching', () => {
    expect(filterNamedItems(items, '  ward ')).toEqual([items[1]]);
  });

  it('restores the full list when the query is cleared', () => {
    expect(filterNamedItems(items, '   ')).toBe(items);
  });
});
