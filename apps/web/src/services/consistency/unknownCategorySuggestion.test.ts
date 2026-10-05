import {describe, expect, it} from 'vitest';
import type {EntityCategory, WorldEntity} from '../../entityTypes';
import type {GuardrailIssue} from './types';
import {findCategoryIdForSuggestedKind, suggestUnknownCategory} from './unknownCategorySuggestion';
import {
  canonicalizeUnknownSurface,
  downgradeUnknownIssuesToWarnings,
  findCloseCharacterEntityMatch,
  getReviewSourceForDocument,
  hashString
} from './sceneReviewHelpers';

const issue = (changes: Partial<GuardrailIssue> = {}): GuardrailIssue => ({
  code: 'UNKNOWN_ENTITY', severity: 'blocking', message: 'Unknown', surface: 'Vex', ...changes
});
const category = (id: string, slug: string) => ({id, slug, name: slug}) as EntityCategory;

describe('unknown category suggestion', () => {
  it('trusts the detection reason first', () => {
    expect(suggestUnknownCategory({surface: 'Vex', issue: issue({detectionReason: 'titled_name'}), documentContent: null})).toBe('character');
    expect(suggestUnknownCategory({surface: 'Vex', issue: issue({detectionReason: 'action_object_candidate'}), documentContent: null})).toBe('item');
  });

  it('reads the last word: named places, items, creatures, factions', () => {
    const suggest = (surface: string) => suggestUnknownCategory({surface, issue: undefined, documentContent: null});
    expect(suggest('Grey Harbor')).toBe('location');
    expect(suggest('grey harbor')).toBeNull();
    expect(suggest('ember sword')).toBe('item');
    expect(suggest('Ash Wolf')).toBe('creature');
    expect(suggest('Salt Guild')).toBe('faction');
    expect(suggest('   ')).toBeNull();
  });

  it('reads the words just before the name in the scene', () => {
    const content = '<p>They rode toward Vex at dawn. She drew Vex. A man named Vex.</p>';
    const at = (word: string, nth = 0) => {
      let index = -1;
      for (let count = 0; count <= nth; count += 1) index = content.indexOf(word, index + 1);
      return issue({span: {start: index, end: index + word.length}});
    };
    expect(suggestUnknownCategory({surface: 'Vex', issue: at('Vex', 0), documentContent: content})).toBe('location');
    expect(suggestUnknownCategory({surface: 'Vex', issue: at('Vex', 1), documentContent: content})).toBe('item');
    expect(suggestUnknownCategory({surface: 'Vex', issue: at('Vex', 2), documentContent: content})).toBe('character');
    expect(suggestUnknownCategory({surface: 'Vex', issue: at('Vex', 0), documentContent: null})).toBeNull();
  });

  it('maps a kind to the closest project category by slug', () => {
    const categories = [category('c1', 'npcs'), category('c2', 'characters'), category('c3', 'places')];
    expect(findCategoryIdForSuggestedKind(categories, 'character')).toBe('c1');
    expect(findCategoryIdForSuggestedKind(categories, 'location')).toBe('c3');
    expect(findCategoryIdForSuggestedKind(categories, 'flora')).toBeUndefined();
    expect(findCategoryIdForSuggestedKind(categories, null)).toBeUndefined();
  });
});

describe('scene review helpers', () => {
  it('downgrades only unknown names to warnings', () => {
    const [unknown, conflict] = downgradeUnknownIssuesToWarnings([
      issue(),
      {code: 'STATE_CONFLICT', severity: 'blocking', message: 'Conflict'}
    ]);
    expect(unknown).toMatchObject({severity: 'warning', message: expect.stringContaining('Review "Vex"')});
    expect(conflict).toMatchObject({severity: 'blocking', message: 'Conflict'});
  });

  it('keeps small helpers stable', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
    expect(canonicalizeUnknownSurface('  The VAULT ')).toBe(canonicalizeUnknownSurface('the vault'));
    expect(getReviewSourceForDocument({consistencyReviewMode: 'deferred'} as never)).toBe('import');
    expect(getReviewSourceForDocument({} as never)).toBe('workspace-save');
  });

  it('finds a close character in the same category, never the exact name', () => {
    const entity = (id: string, name: string, categoryId = 'chars') => ({id, name, categoryId}) as WorldEntity;
    const entities = [entity('a', 'Sera Kestrel'), entity('b', 'Sera'), entity('c', 'Seraphine', 'places'), entity('d', 'Tam')];
    expect(findCloseCharacterEntityMatch({entities, categoryId: 'chars', normalizedCharacterName: 'sera'})?.id).toBe('a');
    expect(findCloseCharacterEntityMatch({entities, categoryId: 'chars', normalizedCharacterName: 'brannic'})).toBeNull();
  });
});
