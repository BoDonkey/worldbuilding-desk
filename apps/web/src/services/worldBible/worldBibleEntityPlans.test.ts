import {describe, expect, it} from 'vitest';
import type {EntityCategory, WorldEntity} from '../../entityTypes';
import type {ReviewQueueItem} from '../consistency';
import {formatAlternativeNames, normalizeName, parseAlternativeNames} from './worldBibleEntityHelpers';
import {
  getCategorySlug,
  inferCompendiumDomain,
  isCharacterLikeEntity,
  isLocationLikeEntity,
  pickNextReviewItem,
  planEntityDraft,
  type EntityDraftInput
} from './worldBibleEntityPlans';

const category = (id: string, slug: string, name = slug, fieldSchema: EntityCategory['fieldSchema'] = []): EntityCategory =>
  ({id, projectId: 'p', slug, name, fieldSchema, createdAt: 1}) as EntityCategory;

const entity = (id: string, categoryId: string, overrides: Partial<WorldEntity> = {}): WorldEntity =>
  ({id, projectId: 'p', categoryId, name: id, fields: {}, links: [], createdAt: 1, updatedAt: 1, ...overrides}) as WorldEntity;

const CATEGORIES = [
  category('c-npc', 'npcs'),
  category('c-cast', 'cast', 'Main People'),
  category('c-place', 'places'),
  category('c-beast', 'creatures'),
  category('c-herb', 'herbalism'),
  category('c-rock', 'ores'),
  category('c-relic', 'relics'),
  category('c-misc', 'misc')
];

describe('category classification', () => {
  it('treats a record as character-like by category slug or name, and location-like by slug only', () => {
    expect(isCharacterLikeEntity(CATEGORIES, entity('a', 'c-npc'))).toBe(true);
    expect(isCharacterLikeEntity(CATEGORIES, entity('a', 'c-cast'))).toBe(true);
    expect(isCharacterLikeEntity(CATEGORIES, entity('a', 'c-place'))).toBe(false);
    expect(isCharacterLikeEntity(CATEGORIES, entity('a', 'missing'))).toBe(false);
    expect(isLocationLikeEntity(CATEGORIES, entity('a', 'c-place'))).toBe(true);
    expect(isLocationLikeEntity([category('c-x', 'misc', 'Places')], entity('a', 'c-x'))).toBe(false);
  });

  it('infers a compendium domain from the category slug', () => {
    expect(inferCompendiumDomain(CATEGORIES, entity('a', 'c-beast'))).toBe('beast');
    expect(inferCompendiumDomain(CATEGORIES, entity('a', 'c-herb'))).toBe('flora');
    expect(inferCompendiumDomain(CATEGORIES, entity('a', 'c-rock'))).toBe('mineral');
    expect(inferCompendiumDomain(CATEGORIES, entity('a', 'c-relic'))).toBe('artifact');
    expect(inferCompendiumDomain(CATEGORIES, entity('a', 'c-misc'))).toBe('custom');
    // Quirk: substring matching, so "stores" reads as a mineral ("ore").
    expect(inferCompendiumDomain([category('c-s', 'stores')], entity('a', 'c-s'))).toBe('mineral');
  });

  it('looks up a category slug, or an empty string', () => {
    expect(getCategorySlug(CATEGORIES, 'c-place')).toBe('places');
    expect(getCategorySlug(CATEGORIES, 'gone')).toBe('');
  });
});

describe('pickNextReviewItem', () => {
  const queue = ['a', 'b', 'c'].map((id) => ({entity: entity(id, 'c-misc')}) as ReviewQueueItem);

  it('prefers the next item, then the previous one, and returns null for a single item', () => {
    expect(pickNextReviewItem(queue, 'a')?.entity.id).toBe('b');
    expect(pickNextReviewItem(queue, 'c')?.entity.id).toBe('b');
    expect(pickNextReviewItem(queue.slice(0, 1), 'a')).toBeNull();
    // Quirk: an id not in the queue resolves to the first item.
    expect(pickNextReviewItem(queue, 'zzz')?.entity.id).toBe('a');
  });
});

describe('planEntityDraft', () => {
  const KEY = 'alternativeNames';
  const characters = category('c-npc', 'npcs', 'NPCs', [{key: 'bio', label: 'Bio', type: 'textarea'}] as EntityCategory['fieldSchema']);
  const places = category('c-place', 'places');
  const base = (overrides: Partial<EntityDraftInput> = {}): EntityDraftInput => ({
    id: 'e1',
    now: 1000,
    projectId: 'p',
    category: characters,
    existing: undefined,
    name: 'Sera Kestrel',
    fieldValues: {},
    indexedAliases: [],
    reviewingFromQueue: false,
    alternativeNamesKey: KEY,
    normalizeName,
    parseAlternativeNames,
    formatAlternativeNames,
    ...overrides
  });

  it('creates a new character with a suggested first-name alias, which counts as an alias change', () => {
    const {entity: created, aliases} = planEntityDraft(base({fieldValues: {bio: 'Line one'}}));
    expect(aliases).toEqual(['Sera']);
    expect(created).toMatchObject({
      id: 'e1', projectId: 'p', categoryId: 'c-npc', name: 'Sera Kestrel', isNew: false, needsCompletion: false,
      links: [], createdAt: 1000, updatedAt: 1000, aliasesReviewedAt: 1000
    });
    expect(created.fields[KEY]).toBe('Sera');
    expect(typeof created.fields.bio).toBe('string');
  });

  it('suggests no alias outside character categories, and drops the alternative-names field when empty', () => {
    const {entity: created, aliases} = planEntityDraft(base({category: places, name: 'Salt Door', fieldValues: {[KEY]: ''}}));
    expect(aliases).toEqual([]);
    expect(KEY in created.fields).toBe(false);
    expect(created.aliasesReviewedAt).toBeUndefined();
  });

  it('keeps the old name as an alias on rename and marks aliases reviewed', () => {
    const existing = entity('e1', 'c-place', {name: 'Old Gate', createdAt: 5, aliasesReviewedAt: 7, links: ['linked-scene']});
    const {entity: renamed, aliases} = planEntityDraft(base({category: places, existing, name: 'Salt Door'}));
    expect(aliases).toEqual(['Old Gate']);
    expect(renamed).toMatchObject({createdAt: 5, aliasesReviewedAt: 1000, links: existing.links});
  });

  it('keeps the previous review time when nothing about aliases changed, unless saved from the review queue', () => {
    const existing = entity('e1', 'c-npc', {name: 'Sera Kestrel', aliasesReviewedAt: 7, fields: {[KEY]: 'Sera'}});
    const input = base({existing, fieldValues: {[KEY]: 'Sera'}});
    expect(planEntityDraft(input).entity.aliasesReviewedAt).toBe(7);
    expect(planEntityDraft({...input, reviewingFromQueue: true}).entity.aliasesReviewedAt).toBe(1000);
    // Reviewed records no longer get a suggested alias.
    expect(planEntityDraft({...input, fieldValues: {}}).aliases).toEqual([]);
  });

  it('compares against indexed aliases too, and never stores the record’s own name as an alias', () => {
    const existing = entity('e1', 'c-npc', {name: 'Sera Kestrel', aliasesReviewedAt: 7});
    const unchanged = planEntityDraft(base({existing, fieldValues: {[KEY]: 'Ash, Sera Kestrel'}, indexedAliases: ['Ash']}));
    expect(unchanged.aliases).toEqual(['Ash']);
    expect(unchanged.entity.aliasesReviewedAt).toBe(7);
    expect(planEntityDraft(base({existing, fieldValues: {[KEY]: 'Ash'}, indexedAliases: ['Ash', 'Ember']})).entity.aliasesReviewedAt).toBe(1000);
  });
});
