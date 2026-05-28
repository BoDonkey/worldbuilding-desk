import {describe, expect, it} from 'vitest';
import type {EntityCategory, WorldEntity} from '../../entityTypes';
import {
  buildEntityMatchKey,
  buildPotentialEntityMatches,
  buildReviewEntityInsightsById,
  getRecommendedMatchResolution,
  getReviewResolutionLabel,
  getMissingRequiredFieldLabels
} from './worldBibleReviewHelpers';
import {
  ALTERNATIVE_NAMES_KEY,
  normalizeName,
  parseAlternativeNames
} from './worldBibleEntityHelpers';

const projectId = 'project-1';
const categoryId = 'cat-1';

const category: EntityCategory = {
  id: categoryId,
  projectId,
  name: 'People',
  slug: 'people',
  fieldSchema: [
    {key: 'summary', label: 'Summary', type: 'textarea', required: true},
    {key: 'titles', label: 'Titles', type: 'multiselect', required: true},
    {key: 'isCanon', label: 'Canon', type: 'checkbox', required: true}
  ],
  createdAt: 1
};

const makeEntity = (overrides: Partial<WorldEntity>): WorldEntity => ({
  id: 'entity',
  projectId,
  categoryId,
  name: 'Unnamed',
  fields: {},
  links: [],
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

describe('worldBibleReviewHelpers', () => {
  it('maps overlap reasons to stable recommended resolutions', () => {
    expect(getRecommendedMatchResolution(['Same name as an existing record'])).toBe('merge');
    expect(getRecommendedMatchResolution(['Current name already exists as an alias'])).toBe('alias');
    expect(
      getRecommendedMatchResolution([
        'Current name looks like a short form of an existing record'
      ])
    ).toBe('alias');
    expect(
      getRecommendedMatchResolution(['One or more aliases overlap with another record'])
    ).toBe('ignore');
    expect(getReviewResolutionLabel('alias')).toBe('Convert to alias');
  });

  it('detects only truly missing required fields', () => {
    const entity = makeEntity({
      fields: {
        summary: '  ',
        titles: [],
        isCanon: false
      }
    });

    expect(getMissingRequiredFieldLabels(entity, category)).toEqual(['Summary', 'Titles']);
  });

  it('finds duplicate and alias overlaps for the current draft', () => {
    const entities = [
      makeEntity({id: '1', name: 'Kael'}),
      makeEntity({id: '2', name: 'Archivist'}),
      makeEntity({id: '3', name: 'Mira'})
    ];
    const aliasMapByEntityId = new Map<string, string[]>([
      ['2', ['Ember Archive']],
      ['3', ['Wanderer']]
    ]);

    const matches = buildPotentialEntityMatches({
      entities,
      aliasMapByEntityId,
      editingId: null,
      name: 'Ember Archive',
      fieldValues: {
        [ALTERNATIVE_NAMES_KEY]: 'Kael, Wanderer'
      },
      alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
      ignoredEntityMatchKeys: new Set(),
      normalizeName,
      parseAlternativeNames
    });

    expect(matches).toEqual([
      {
        entity: entities[1],
        matchKey: null,
        reasons: ['Current name already exists as an alias'],
        recommendedResolution: 'alias'
      },
      {
        entity: entities[0],
        matchKey: null,
        reasons: ['One of your aliases matches an existing record name'],
        recommendedResolution: 'ignore'
      },
      {
        entity: entities[2],
        matchKey: null,
        reasons: ['One or more aliases overlap with another record'],
        recommendedResolution: 'ignore'
      }
    ]);
  });

  it('finds first-name drafts that should become aliases of full-name canon', () => {
    const entities = [
      makeEntity({id: '1', name: 'Garcia de Terra'}),
      makeEntity({id: '2', name: 'Mira Voss'})
    ];

    const matches = buildPotentialEntityMatches({
      entities,
      aliasMapByEntityId: new Map(),
      editingId: null,
      name: 'Garcia',
      fieldValues: {},
      alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
      ignoredEntityMatchKeys: new Set(),
      normalizeName,
      parseAlternativeNames
    });

    expect(matches).toEqual([
      {
        entity: entities[0],
        matchKey: null,
        reasons: ['Current name looks like a short form of an existing record'],
        recommendedResolution: 'alias'
      }
    ]);
  });

  it('filters ignored match pairs out of draft matches and review insights', () => {
    const entities = [
      makeEntity({
        id: '1',
        name: 'Kael',
        fields: {
          summary: '',
          titles: ['Scout'],
          isCanon: false,
          [ALTERNATIVE_NAMES_KEY]: 'Wanderer'
        }
      }),
      makeEntity({
        id: '2',
        name: 'Wanderer',
        fields: {
          summary: 'Known traveler',
          titles: ['Guide'],
          isCanon: true
        }
      }),
      makeEntity({
        id: '3',
        name: 'Mira',
        fields: {
          summary: 'Scholar',
          titles: ['Archivist'],
          isCanon: true
        }
      })
    ];
    const aliasMapByEntityId = new Map<string, string[]>([['3', ['Kael']]]);
    const ignoredEntityMatchKeys = new Set([buildEntityMatchKey('1', '2')]);

    const matches = buildPotentialEntityMatches({
      entities,
      aliasMapByEntityId,
      editingId: '1',
      name: 'Kael',
      fieldValues: {
        [ALTERNATIVE_NAMES_KEY]: 'Wanderer'
      },
      alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
      ignoredEntityMatchKeys,
      normalizeName,
      parseAlternativeNames
    });

    expect(matches).toEqual([
      {
        entity: entities[2],
        matchKey: buildEntityMatchKey('1', '3'),
        reasons: ['Current name already exists as an alias'],
        recommendedResolution: 'alias'
      }
    ]);

    const insights = buildReviewEntityInsightsById({
      entities,
      categories: [category],
      aliasMapByEntityId,
      alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
      ignoredEntityMatchKeys,
      normalizeName,
      parseAlternativeNames
    });

    expect(insights.get('1')).toEqual({
      matchCount: 1,
      missingRequiredFields: ['Summary'],
      recommendedResolution: 'complete'
    });
  });

  it('builds review insights with overlap counts and required-field gaps', () => {
    const entities = [
      makeEntity({
        id: '1',
        name: 'Kael',
        fields: {
          summary: '',
          titles: ['Scout'],
          isCanon: false,
          [ALTERNATIVE_NAMES_KEY]: 'Wanderer'
        }
      }),
      makeEntity({
        id: '2',
        name: 'Wanderer',
        fields: {
          summary: 'Known traveler',
          titles: ['Guide'],
          isCanon: true
        }
      }),
      makeEntity({
        id: '3',
        name: 'Mira',
        fields: {
          summary: 'Scholar',
          titles: ['Archivist'],
          isCanon: true
        }
      })
    ];
    const aliasMapByEntityId = new Map<string, string[]>([['3', ['Kael']]]);

    const insights = buildReviewEntityInsightsById({
      entities,
      categories: [category],
      aliasMapByEntityId,
      alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
      ignoredEntityMatchKeys: new Set(),
      normalizeName,
      parseAlternativeNames
    });

    expect(insights.get('1')).toEqual({
      matchCount: 2,
      missingRequiredFields: ['Summary'],
      recommendedResolution: 'complete'
    });
    expect(insights.get('2')).toEqual({
      matchCount: 1,
      missingRequiredFields: [],
      recommendedResolution: 'alias'
    });
    expect(insights.get('3')).toEqual({
      matchCount: 1,
      missingRequiredFields: [],
      recommendedResolution: 'alias'
    });
  });
});
