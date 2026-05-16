import {describe, expect, it} from 'vitest';
import type {WorldEntity} from '../../entityTypes';
import {ALTERNATIVE_NAMES_KEY, normalizeName, parseAlternativeNames} from './worldBibleEntityHelpers';
import {
  buildCanonicalAliasList,
  buildEntityMergePlan,
  getAliasConversionPlan,
  mergeEntityFields
} from './worldBibleCanonicalization';

const makeEntity = (overrides: Partial<WorldEntity>): WorldEntity => ({
  id: overrides.id ?? crypto.randomUUID(),
  projectId: overrides.projectId ?? 'project-1',
  categoryId: overrides.categoryId ?? 'characters',
  name: overrides.name ?? 'Kael',
  fields: overrides.fields ?? {},
  isNew: overrides.isNew ?? false,
  needsCompletion: overrides.needsCompletion ?? false,
  links: overrides.links ?? [],
  createdAt: overrides.createdAt ?? 1,
  updatedAt: overrides.updatedAt ?? 1,
  aliasesReviewedAt: overrides.aliasesReviewedAt
});

describe('worldBibleCanonicalization', () => {
  it('preserves the previous name as an alias when renaming', () => {
    expect(
      buildCanonicalAliasList({
        previousName: 'Kael',
        nextName: 'Kaelor',
        aliases: [' Wanderer ', 'kael', 'WANDERER']
      })
    ).toEqual(['kael', 'WANDERER']);
  });

  it('fills empty fields and merges alternative names without clobbering populated data', () => {
    const merged = mergeEntityFields(
      {
        description: 'Existing summary',
        notes: '',
        tags: [],
        [ALTERNATIVE_NAMES_KEY]: 'Kael'
      },
      {
        description: 'Incoming summary',
        notes: 'Fresh notes',
        tags: ['chosen'],
        [ALTERNATIVE_NAMES_KEY]: 'Wanderer, kael'
      },
      ALTERNATIVE_NAMES_KEY
    );

    expect(merged).toEqual({
      description: 'Existing summary',
      notes: 'Fresh notes',
      tags: ['chosen'],
      [ALTERNATIVE_NAMES_KEY]: 'kael, Wanderer'
    });
  });

  it('plans a merge that keeps the target canonical and transfers source aliases', () => {
    const source = makeEntity({
      id: 'source',
      name: 'Kael',
      fields: {
        notes: 'Source notes',
        [ALTERNATIVE_NAMES_KEY]: 'Wanderer'
      },
      links: ['scene-1']
    });
    const target = makeEntity({
      id: 'target',
      name: 'Kaelor',
      fields: {
        description: 'Known scout',
        notes: ''
      },
      links: ['scene-2']
    });

    const plan = buildEntityMergePlan({
      source,
      target,
      sourceName: 'Kael',
      sourceFields: source.fields,
      targetFields: target.fields,
      sourceIndexedAliases: ['The Scout'],
      targetIndexedAliases: ['Bladeborn'],
      alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
      normalizeName,
      parseAlternativeNames,
      aliasesReviewedAt: 42
    });

    expect(plan.mergedEntity).toMatchObject({
      id: 'target',
      name: 'Kaelor',
      fields: {
        description: 'Known scout',
        notes: 'Source notes'
      },
      links: ['scene-2', 'scene-1'],
      isNew: false,
      needsCompletion: false,
      aliasesReviewedAt: 42
    });
    expect(plan.aliases).toEqual(['Bladeborn', 'The Scout', 'Wanderer', 'Kael']);
  });

  it('builds an alias-conversion plan only when the source has no unique field content', () => {
    const convertible = getAliasConversionPlan({
      sourceName: 'Kael',
      sourceFields: {
        [ALTERNATIVE_NAMES_KEY]: 'Wanderer'
      },
      sourceLinks: ['doc-1'],
      targetName: 'Kaelor',
      targetFields: {
        summary: 'Known scout'
      },
      targetLinks: [],
      sourceIndexedAliases: ['The Scout'],
      targetIndexedAliases: ['Bladeborn'],
      alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
      normalizeName,
      parseAlternativeNames
    });

    expect(convertible.transferAliases).toEqual([
      'Bladeborn',
      'The Scout',
      'Wanderer',
      'Kael'
    ]);
    expect(convertible.mergedLinks).toEqual(['doc-1']);
    expect(convertible.canDeleteSource).toBe(true);
    expect(convertible.blockingFieldKeys).toEqual([]);
    expect(convertible.hasLinkChanges).toBe(true);

    const blocked = getAliasConversionPlan({
      sourceName: 'Kael',
      sourceFields: {
        summary: 'Unique backstory',
        [ALTERNATIVE_NAMES_KEY]: 'Wanderer'
      },
      sourceLinks: [],
      targetName: 'Kaelor',
      targetFields: {
        summary: ''
      },
      targetLinks: [],
      sourceIndexedAliases: [],
      targetIndexedAliases: [],
      alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
      normalizeName,
      parseAlternativeNames
    });

    expect(blocked.canDeleteSource).toBe(false);
    expect(blocked.blockingFieldKeys).toEqual(['summary']);
  });
});
