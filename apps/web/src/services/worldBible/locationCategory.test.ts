import {describe, expect, it} from 'vitest';
import type {EntityCategory} from '../../entityTypes';
import {findCategoryIdForSuggestedKind} from '../consistency/unknownCategorySuggestion';
import {isLocationCategory} from './locationCategory';
import {mapCategoryToLens} from './worldCanvasDerived';

const category = (slug: string): EntityCategory =>
  ({id: `cat-${slug}`, projectId: 'p', name: slug, slug, kind: 'custom', fieldSchema: [], createdAt: 0, updatedAt: 0}) as unknown as EntityCategory;

describe('the one location-category hint list', () => {
  it('agrees across containment, the Canvas, and the unknown-name suggestion', () => {
    for (const slug of ['locations', 'zone', 'cities', 'landmarks']) {
      expect(isLocationCategory(category(slug))).toBe(true);
      expect(mapCategoryToLens(category(slug))).toBe('places');
      expect(findCategoryIdForSuggestedKind([category('items'), category(slug)], 'location')).toBe(`cat-${slug}`);
    }
    expect(isLocationCategory(category('items'))).toBe(false);
    expect(mapCategoryToLens(category('items'))).toBeNull();
  });
});
