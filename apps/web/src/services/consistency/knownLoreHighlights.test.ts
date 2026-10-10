import {describe, expect, it} from 'vitest';
import type {EntityCategory, WorldEntity} from '../../entityTypes';
import type {ConsistencyAlias} from './aliasStorage';
import {buildKnownLoreHighlights} from './knownLoreHighlights';

const category = (id: string, kind: EntityCategory['kind']): EntityCategory => ({
  id,
  projectId: 'p1',
  kind,
  name: id,
  slug: id,
  fieldSchema: [],
  createdAt: 0
});

const entity = (id: string, categoryId: string, name: string): WorldEntity => ({
  id,
  projectId: 'p1',
  categoryId,
  name,
  fields: {},
  links: [],
  createdAt: 0,
  updatedAt: 0
});

const alias = (targetId: string, value: string): ConsistencyAlias => ({
  id: `alias-${value}`,
  projectId: 'p1',
  targetId,
  targetType: 'entity',
  alias: value,
  createdAt: 0,
  updatedAt: 0
});

describe('buildKnownLoreHighlights', () => {
  const categories = [category('characters', 'character'), category('races', 'general')];

  it('adds number variants for non-character records and their aliases', () => {
    const surfaces = buildKnownLoreHighlights({
      entities: [entity('dhemons', 'races', 'Dhemons')],
      aliases: [alias('dhemons', 'Shadowkin')],
      categories
    }).map((highlight) => highlight.surface);

    expect(surfaces).toEqual(['Dhemons', 'Shadowkin', 'Dhemon', 'Shadowkins']);
  });

  it('keeps character names and aliases exact', () => {
    const surfaces = buildKnownLoreHighlights({
      entities: [entity('elias', 'characters', 'Elias')],
      aliases: [alias('elias', 'Eli')],
      categories
    }).map((highlight) => highlight.surface);

    expect(surfaces).toEqual(['Elias', 'Eli']);
  });

  it('ignores aliases whose record is missing', () => {
    expect(
      buildKnownLoreHighlights({
        entities: [],
        aliases: [alias('gone', 'Ghost')],
        categories
      })
    ).toEqual([]);
  });
});
