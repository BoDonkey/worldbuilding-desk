import type {CompendiumDomain, EntityCategory, WorldEntity} from '../../entityTypes';
import type {ReviewQueueItem} from '../consistency';
import {buildCanonicalAliasList, deriveFirstNameAlias} from './worldBibleCanonicalization';
import {normalizeRichTextValue} from './worldBibleEntityHelpers';

/*
 * Pure World Bible record logic moved from useWorldBibleEntityActions (3.22):
 * category classification, review-queue navigation, and the record a saved
 * draft produces. The hook keeps persistence, indexing, and React state.
 */

const CHARACTER_CATEGORY_HINTS = ['character', 'characters', 'npc', 'person', 'people'];
const LOCATION_CATEGORY_HINTS = ['location', 'locations', 'place', 'places', 'region', 'zone'];

const findCategory = (categories: EntityCategory[], entity: WorldEntity) =>
  categories.find((item) => item.id === entity.categoryId);

/** Character-like by slug or name; used for wording, not for capability gating. */
export const isCharacterLikeEntity = (categories: EntityCategory[], entity: WorldEntity): boolean => {
  const category = findCategory(categories, entity);
  const slug = (category?.slug ?? '').toLowerCase();
  const categoryName = (category?.name ?? '').toLowerCase();
  return CHARACTER_CATEGORY_HINTS.some((hint) => slug.includes(hint) || categoryName.includes(hint));
};

/** Location-like by slug only. */
export const isLocationLikeEntity = (categories: EntityCategory[], entity: WorldEntity): boolean => {
  const slug = (findCategory(categories, entity)?.slug ?? '').toLowerCase();
  return LOCATION_CATEGORY_HINTS.some((hint) => slug.includes(hint));
};

export const inferCompendiumDomain = (categories: EntityCategory[], entity: WorldEntity): CompendiumDomain => {
  const slug = (findCategory(categories, entity)?.slug ?? '').toLowerCase();
  if (slug.includes('monster') || slug.includes('beast') || slug.includes('creature')) {
    return 'beast';
  }
  if (slug.includes('plant') || slug.includes('flora') || slug.includes('herb')) {
    return 'flora';
  }
  if (slug.includes('ore') || slug.includes('mineral') || slug.includes('rock')) {
    return 'mineral';
  }
  if (slug.includes('artifact') || slug.includes('relic')) {
    return 'artifact';
  }
  return 'custom';
};

export const getCategorySlug = (categories: EntityCategory[], categoryId: string): string =>
  categories.find((category) => category.id === categoryId)?.slug ?? '';

/** The next review item after the current one, else the one before it. */
export const pickNextReviewItem = (queue: ReviewQueueItem[], currentEntityId: string): ReviewQueueItem | null => {
  const currentIndex = queue.findIndex((item) => item.entity.id === currentEntityId);
  return queue[currentIndex + 1] ?? queue[currentIndex - 1] ?? null;
};

export interface EntityDraftInput {
  id: string;
  now: number;
  projectId: string;
  category: EntityCategory;
  existing: WorldEntity | undefined;
  name: string;
  fieldValues: Record<string, string>;
  systemNegativeSpace?: WorldEntity['systemNegativeSpace'];
  /** Aliases currently indexed for this record. */
  indexedAliases: string[];
  /** Saving from the review queue counts as reviewing the aliases. */
  reviewingFromQueue: boolean;
  alternativeNamesKey: string;
  normalizeName: (value: string) => string;
  parseAlternativeNames: (value: string) => string[];
  formatAlternativeNames: (names: string[]) => string;
}

/**
 * The record a saved World Bible draft produces, and the aliases to store for
 * it. A character category suggests a first-name alias until aliases have been
 * reviewed; changing aliases, renaming, or saving from review marks them reviewed.
 */
export const planEntityDraft = (input: EntityDraftInput): {entity: WorldEntity; aliases: string[]} => {
  const {id, now, existing, name, fieldValues, alternativeNamesKey, normalizeName, parseAlternativeNames} = input;
  const manualAlternativeNames = parseAlternativeNames(fieldValues[alternativeNamesKey] || '');
  const activeCategorySlug = input.category.slug.toLowerCase();
  const shouldSuggestFirstNameAlias =
    CHARACTER_CATEGORY_HINTS.some((hint) => activeCategorySlug.includes(hint)) &&
    (!existing || !existing.aliasesReviewedAt);
  const suggestedAliases = shouldSuggestFirstNameAlias
    ? [deriveFirstNameAlias(name)].filter((alias): alias is string => typeof alias === 'string')
    : [];
  const alternativeNames = buildCanonicalAliasList({
    previousName: existing?.name,
    nextName: name,
    aliases: manualAlternativeNames,
    suggestedAliases
  });
  const persistedAlternativeNames = [
    ...parseAlternativeNames(
      typeof existing?.fields?.[alternativeNamesKey] === 'string' ? String(existing.fields[alternativeNamesKey]) : ''
    ),
    ...input.indexedAliases
  ]
    .map((alias) => normalizeName(alias))
    .filter(Boolean)
    .filter((alias) => alias !== normalizeName(name));
  const nextAlternativeNamesNormalized = alternativeNames
    .map((alias) => normalizeName(alias))
    .filter(Boolean)
    .filter((alias) => alias !== normalizeName(name));
  const aliasesChanged =
    persistedAlternativeNames.length !== nextAlternativeNamesNormalized.length ||
    persistedAlternativeNames.some((alias, index) => alias !== nextAlternativeNamesNormalized[index]);
  const nextFields = {...fieldValues};
  input.category.fieldSchema.forEach((field) => {
    if (field.type !== 'textarea') return;
    nextFields[field.key] = normalizeRichTextValue(nextFields[field.key] || '');
  });
  if (alternativeNames.length > 0) {
    nextFields[alternativeNamesKey] = input.formatAlternativeNames(alternativeNames);
  } else {
    delete nextFields[alternativeNamesKey];
  }
  const canonicalRename =
    typeof existing?.name === 'string' &&
    existing.name.trim().length > 0 &&
    existing.name.trim().toLowerCase() !== name.trim().toLowerCase();

  const entity: WorldEntity = {
    id,
    projectId: input.projectId,
    categoryId: input.category.id,
    name,
    fields: nextFields,
    systemNegativeSpace: input.systemNegativeSpace,
    isNew: false,
    needsCompletion: false,
    aliasesReviewedAt:
      aliasesChanged || input.reviewingFromQueue ? now : canonicalRename ? now : existing?.aliasesReviewedAt,
    links: existing?.links ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  return {
    entity,
    aliases: alternativeNames.filter((alias) => alias.trim().toLowerCase() !== entity.name.trim().toLowerCase())
  };
};
