import {describe, expect, it} from 'vitest';
import {
  buildWorldCategory,
  buildWorldCategorySlug,
  categorySlugForName,
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

describe('category keys from any script (3.65)', () => {
  it('builds a type named only in non-Latin letters, which it used to refuse', () => {
    expect(buildWorldCategorySlug('人物')).toBe('人物');
    expect(buildWorldCategorySlug('Café & Bar')).toBe('café-bar');
    expect(buildWorldCategory({projectId: 'p', name: '人物'}).slug).toBe('人物');
    expect(() => buildWorldCategory({projectId: 'p', name: '!!!'})).toThrow(
      'Use at least one letter or number in the World Bible type name.'
    );
  });

  it('keeps a stored key while the name is unchanged, and never gives an empty key', () => {
    const stored = {name: "Problems Power Can't Solve", slug: 'problems-power-cannot-solve'};
    expect(categorySlugForName("  Problems Power Can't Solve ", stored)).toBe('problems-power-cannot-solve');
    expect(categorySlugForName('Secret Societies & Orders', stored)).toBe('secret-societies-orders');
    expect(categorySlugForName('!!!')).toBe('custom');
  });
});

