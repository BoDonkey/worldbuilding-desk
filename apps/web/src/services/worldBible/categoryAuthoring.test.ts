import {describe, expect, it} from 'vitest';
import {
  buildWorldCategory,
  buildWorldCategorySlug,
  normalizeWorldCategoryName
} from './categoryAuthoring';

describe('World Bible category authoring', () => {
  it('builds an author-named general category with the standard description field', () => {
    expect(
      buildWorldCategory({
        projectId: 'project-1',
        name: '  Factions  ',
        id: 'factions',
        createdAt: 1
      })
    ).toEqual({
      id: 'factions',
      projectId: 'project-1',
      kind: 'general',
      name: 'Factions',
      slug: 'factions',
      fieldSchema: [
        {key: 'description', label: 'Description', type: 'textarea'}
      ],
      createdAt: 1
    });
  });

  it('normalizes spacing and punctuation for identity and slugs', () => {
    expect(normalizeWorldCategoryName('  Secret   Societies ')).toBe('Secret Societies');
    expect(buildWorldCategorySlug('Secret Societies & Orders')).toBe(
      'secret-societies-orders'
    );
  });
});
