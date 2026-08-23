import {describe, expect, it} from 'vitest';
import {
  findCurrentSceneMatches,
  resolveCurrentSceneFindIndex
} from './currentSceneFind';

describe('findCurrentSceneMatches', () => {
  it('finds repeated matches without case sensitivity', () => {
    expect(
      findCurrentSceneMatches([{text: 'Beacon beacon BEACON', position: 5}], 'beacon')
    ).toEqual([
      {from: 5, to: 11},
      {from: 12, to: 18},
      {from: 19, to: 25}
    ]);
  });

  it('finds text across adjacent marked segments but not across block gaps', () => {
    expect(
      findCurrentSceneMatches(
        [
          {text: 'silver ', position: 1},
          {text: 'gate', position: 8},
          {text: 'silver', position: 20},
          {text: ' gate', position: 28}
        ],
        'silver gate'
      )
    ).toEqual([{from: 1, to: 12}]);
  });

  it('returns no matches for an empty query', () => {
    expect(findCurrentSceneMatches([{text: 'Scene', position: 1}], '   ')).toEqual(
      []
    );
  });
});

describe('resolveCurrentSceneFindIndex', () => {
  it('wraps next and previous navigation', () => {
    expect(resolveCurrentSceneFindIndex(2, 3, 'next')).toBe(0);
    expect(resolveCurrentSceneFindIndex(0, 3, 'previous')).toBe(2);
  });

  it('starts at the appropriate edge and handles zero matches', () => {
    expect(resolveCurrentSceneFindIndex(-1, 3, 'next')).toBe(0);
    expect(resolveCurrentSceneFindIndex(-1, 3, 'previous')).toBe(2);
    expect(resolveCurrentSceneFindIndex(0, 0, 'next')).toBe(-1);
  });
});
