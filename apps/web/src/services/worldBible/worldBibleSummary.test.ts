import {describe, expect, it} from 'vitest';
import type {EntityCategory, WorldEntity} from '../../entityTypes';
import {
  buildEntityCardSummary,
  isCharacterCategory
} from './worldBibleSummary';

const category: EntityCategory = {
  id: 'characters',
  projectId: 'project-1',
  name: 'Characters',
  slug: 'characters',
  fieldSchema: [
    {key: 'description', label: 'Description', type: 'textarea'},
    {key: 'role', label: 'Role', type: 'text'},
    {key: 'age', label: 'Age', type: 'number'},
    {key: 'notes', label: 'Notes', type: 'textarea'},
    {key: 'status', label: 'Status', type: 'checkbox'}
  ],
  createdAt: 1
};

const entity: WorldEntity = {
  id: 'entity-1',
  projectId: 'project-1',
  categoryId: category.id,
  name: 'Mira Vale',
  fields: {
    description: '<p>A patient scout with a careful eye.</p>',
    role: 'Scout',
    age: 31,
    notes: '<p>Trusts the northern guide.</p>',
    status: true
  },
  links: [],
  createdAt: 1,
  updatedAt: 1
};

describe('isCharacterCategory', () => {
  it('recognizes character-like slugs and names', () => {
    expect(isCharacterCategory(category)).toBe(true);
    expect(
      isCharacterCategory({...category, slug: 'cast', name: 'Important People'})
    ).toBe(true);
  });

  it('rejects unrelated categories', () => {
    expect(
      isCharacterCategory({...category, slug: 'locations', name: 'Locations'})
    ).toBe(false);
  });
});

describe('buildEntityCardSummary', () => {
  it('uses category priority for the primary summary', () => {
    const summary = buildEntityCardSummary(entity, category);

    expect(summary.primarySummary).toBe('A patient scout with a careful eye.');
    expect(summary.summarySourceLabel).toBe('Description');
    expect(summary.summaryIsTruncated).toBe(false);
    expect(summary.secondaryFields).toEqual([
      {label: 'Role', value: 'Scout'},
      {label: 'Age', value: '31'},
      {label: 'Notes', value: 'Trusts the northern guide.'}
    ]);
    expect(summary.hiddenFieldCount).toBe(1);
  });

  it('combines stored and canonical aliases in secondary fields', () => {
    const summary = buildEntityCardSummary(
      {
        ...entity,
        fields: {
          description: entity.fields.description,
          alternativeNames: 'M. Vale'
        }
      },
      category,
      ['The Scout', 'M. Vale']
    );

    expect(summary.secondaryFields).toContainEqual({
      label: 'Alternative names',
      value: 'M. Vale, The Scout'
    });
  });

  it('falls back to an available rich-text field and truncates long summaries', () => {
    const longSummary = 'A'.repeat(220);
    const summary = buildEntityCardSummary(
      {...entity, fields: {history: `<p>${longSummary}</p>`}},
      {
        ...category,
        slug: 'custom',
        fieldSchema: [{key: 'history', label: 'History', type: 'textarea'}]
      }
    );

    expect(summary.primarySummary).toHaveLength(183);
    expect(summary.primarySummary?.endsWith('...')).toBe(true);
    expect(summary.summarySourceLabel).toBe('History');
    expect(summary.summaryIsTruncated).toBe(true);
  });
});
