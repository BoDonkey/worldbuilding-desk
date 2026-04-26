import {describe, expect, it} from 'vitest';
import {
  findTextMatches,
  isInProgressCanonPrefix,
  isPossessiveFormOf,
  normalizeCanonText
} from './textMatcher';

describe('textMatcher', () => {
  it('normalizes canon and alias surfaces consistently', () => {
    expect(normalizeCanonText("The Ember Archive's")).toBe('ember archive');
    expect(normalizeCanonText('Kael')).toBe('kael');
    expect(normalizeCanonText("Kael's")).toBe('kael');
  });

  it('matches known multiword canon surfaces and possessives', () => {
    const matches = findTextMatches(
      "Kael entered the Ember Archive. Kael's map marked Ember Archive's gate.",
      [
        {id: 'kael', surface: 'Kael', kind: 'known'},
        {id: 'archive', surface: 'Ember Archive', kind: 'known'}
      ]
    );

    expect(matches.map((match) => match.surface)).toEqual([
      'Kael',
      'Ember Archive',
      "Kael's",
      "Ember Archive's"
    ]);
    expect(matches.map((match) => match.reason)).toEqual([
      'exact',
      'exact',
      'possessive',
      'possessive'
    ]);
  });

  it('prefers longer overlapping matches', () => {
    const matches = findTextMatches('The Ember Archive opened.', [
      {id: 'ember', surface: 'Ember', kind: 'known'},
      {id: 'archive', surface: 'Ember Archive', kind: 'known'}
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0].surface).toBe('Ember Archive');
  });

  it('detects incomplete prefixes of known canon names without hiding full words', () => {
    expect(isInProgressCanonPrefix('Ember Archiv', ['Ember Archive'])).toBe(true);
    expect(isInProgressCanonPrefix('Ember', ['Ember Archive'])).toBe(false);
    expect(isInProgressCanonPrefix('Ember Archive', ['Ember Archive'])).toBe(false);
  });

  it('recognizes possessive alias forms', () => {
    expect(isPossessiveFormOf("Kaelor's", 'Kaelor')).toBe(true);
    expect(isPossessiveFormOf('Kaelor', 'Kaelor')).toBe(false);
  });
});
